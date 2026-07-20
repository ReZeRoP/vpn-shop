// Custom server: Next.js handler + Socket.IO public chat in one process.
// Run with: node server.js  (PM2 in production)
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Register ts paths for the shared chat module (compiled to .next in prod is
  // not available to server.js, so chat logic lives in plain JS here + a tiny
  // DB bridge below).
  const Database = require("better-sqlite3");
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const db = new Database(path.join(dataDir, "shop.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
    // long-polling fallback stays enabled — matters on Iranian ISPs
    maxHttpBufferSize: 4096,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ── auth bridge: session cookie → user row ──
  const sessionStmt = db.prepare(`
    SELECT u.id, u.username, u.role, u.banned, u.chat_muted_until AS chatMutedUntil
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `);
  function userFromCookie(cookieHeader) {
    if (!cookieHeader) return null;
    const m = /(?:^|;\s*)shop_session=([0-9a-f]{64})/.exec(cookieHeader);
    if (!m) return null;
    return sessionStmt.get(m[1], Date.now()) || null;
  }

  // ── chat state ──
  const HISTORY_SIZE = 200;
  const MAX_MSG_LEN = 500;
  const history = []; // ring buffer of {id, userId, username, body, createdAt}
  const insertMsg = db.prepare(
    "INSERT INTO chat_messages (user_id, username, body, created_at) VALUES (?, ?, ?, ?)",
  );
  const markDeleted = db.prepare("UPDATE chat_messages SET deleted = 1 WHERE id = ?");
  const muteUser = db.prepare("UPDATE users SET chat_muted_until = ? WHERE id = ?");

  // preload last messages from DB so history survives restarts
  try {
    const rows = db
      .prepare(
        `SELECT id, user_id AS userId, username, body, created_at AS createdAt
         FROM chat_messages WHERE deleted = 0 ORDER BY id DESC LIMIT ?`,
      )
      .all(HISTORY_SIZE)
      .reverse();
    history.push(...rows);
  } catch (e) {
    console.warn("chat history preload skipped:", e.message);
  }

  // per-socket token bucket + per-IP connection cap
  const ipConnections = new Map();
  const IP_CAP = 5;

  io.on("connection", (socket) => {
    const ip =
      socket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      socket.handshake.address;
    const user = userFromCookie(socket.handshake.headers.cookie);
    socket.data.user = user;
    // memory-efficiency: drop the retained initial HTTP request now that
    // handshake data has been consumed (documented Socket.IO tuning)
    socket.conn.request = null;

    const count = (ipConnections.get(ip) || 0) + 1;
    if (count > IP_CAP) {
      socket.disconnect(true);
      return;
    }
    ipConnections.set(ip, count);
    socket.on("disconnect", () => {
      const c = (ipConnections.get(ip) || 1) - 1;
      if (c <= 0) ipConnections.delete(ip);
      else ipConnections.set(ip, c);
    });

    // everyone (guests included) can read
    socket.emit("chat:history", history);
    io.emit("chat:online", io.engine.clientsCount);
    socket.on("disconnect", () => io.emit("chat:online", io.engine.clientsCount));

    // token bucket: 3 burst, refill 1/sec
    let tokens = 3;
    let lastRefill = Date.now();
    let lastBody = "";

    socket.on("chat:send", (raw, ack) => {
      const u = socket.data.user;
      if (!u) return ack?.({ error: "برای ارسال پیام وارد شوید" });
      if (u.banned) return ack?.({ error: "حساب شما مسدود است" });
      if (u.chatMutedUntil && u.chatMutedUntil > Date.now()) {
        return ack?.({ error: "شما موقتاً از ارسال پیام منع شده‌اید" });
      }

      const now = Date.now();
      tokens = Math.min(3, tokens + (now - lastRefill) / 1000);
      lastRefill = now;
      if (tokens < 1) return ack?.({ error: "آهسته‌تر! چند لحظه صبر کنید" });
      tokens -= 1;

      const body = String(raw ?? "").trim().slice(0, MAX_MSG_LEN);
      if (!body) return ack?.({ error: "پیام خالی است" });
      if (body === lastBody) return ack?.({ error: "پیام تکراری" });
      lastBody = body;

      const createdAt = Date.now();
      const info = insertMsg.run(u.id, u.username, body, createdAt);
      const msg = { id: Number(info.lastInsertRowid), userId: u.id, username: u.username, body, createdAt };
      history.push(msg);
      if (history.length > HISTORY_SIZE) history.shift();
      io.emit("chat:new", msg);
      ack?.({ ok: true });
    });

    // ── admin moderation ──
    socket.on("chat:delete", (msgId) => {
      const u = socket.data.user;
      if (!u || u.role !== "admin") return;
      markDeleted.run(msgId);
      const idx = history.findIndex((m) => m.id === msgId);
      if (idx !== -1) history.splice(idx, 1);
      io.emit("chat:deleted", msgId);
    });

    socket.on("chat:mute", ({ userId, minutes }) => {
      const u = socket.data.user;
      if (!u || u.role !== "admin") return;
      muteUser.run(Date.now() + (minutes || 60) * 60_000, userId);
    });
  });

  // ── maintenance: expire unpaid orders + purge stale sessions ──
  const paymentWindowStmt = db.prepare("SELECT value FROM settings WHERE key = 'payment_window_min'");
  const expireOrdersStmt = db.prepare(
    "UPDATE orders SET status = 'expired' WHERE status = 'pending_payment' AND created_at < ?",
  );
  const purgeSessionsStmt = db.prepare("DELETE FROM sessions WHERE expires_at < ?");

  function maintenanceTick() {
    try {
      // read the window every tick so admin changes apply without a restart
      const row = paymentWindowStmt.get();
      const minutes = parseInt(row?.value, 10);
      const windowMs = (Number.isFinite(minutes) && minutes > 0 ? minutes : 45) * 60_000;
      const expired = expireOrdersStmt.run(Date.now() - windowMs);
      if (expired.changes > 0) console.log(`maintenance: expired ${expired.changes} unpaid order(s)`);
      purgeSessionsStmt.run(Date.now());
    } catch (e) {
      console.warn("maintenance tick failed:", e.message);
    }
  }
  maintenanceTick();
  setInterval(maintenanceTick, 10 * 60_000).unref();

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
  });
});
