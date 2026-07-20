// Mock 3x-ui panel for local E2E testing.
// Reproduces v2 API quirks: cookie login, {success,msg,obj} envelope,
// settings as JSON-encoded string, 404 when unauthenticated.
// Usage: node scripts/mock-panel.mjs   (listens on :20530, base path /mock)
import { createServer } from "http";

const BASE = "/mock";
let sessionCounter = 0;
const sessions = new Set();

const inbound = {
  id: 1,
  up: 0,
  down: 0,
  total: 0,
  remark: "VLESS-TEST",
  enable: true,
  expiryTime: 0,
  listen: "",
  port: 443,
  protocol: "vless",
  settings: JSON.stringify({ clients: [], decryption: "none", fallbacks: [] }),
  streamSettings: JSON.stringify({
    network: "tcp",
    security: "reality",
    realitySettings: {
      serverNames: ["yahoo.com"],
      shortIds: ["03bd"],
      settings: { publicKey: "TEST_PUBKEY", fingerprint: "chrome", spiderX: "/" },
    },
  }),
  sniffing: "{}",
  clientStats: [],
};

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function authed(req) {
  const cookie = req.headers.cookie || "";
  const m = /3x-ui=([^;]+)/.exec(cookie);
  return m && sessions.has(m[1]);
}

createServer(async (req, res) => {
  const url = req.url || "";
  console.log(`[mock-panel] ${req.method} ${url}`);

  if (url === `${BASE}/login` && req.method === "POST") {
    const body = await readBody(req);
    if (body.username === "admin" && body.password === "admin") {
      const token = `sess${++sessionCounter}`;
      sessions.add(token);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `3x-ui=${token}; Path=${BASE}; HttpOnly`,
      });
      res.end(JSON.stringify({ success: true, msg: "Login successfully", obj: null }));
    } else {
      // 3x-ui returns 200 even on bad creds
      json(res, 200, { success: false, msg: "Invalid credentials", obj: null });
    }
    return;
  }

  // everything else requires auth; unauthenticated → 404 (3x-ui behavior)
  if (!authed(req)) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (url === `${BASE}/panel/api/inbounds/list`) {
    return json(res, 200, { success: true, msg: "", obj: [inbound] });
  }
  if (url === `${BASE}/panel/api/inbounds/get/1`) {
    return json(res, 200, { success: true, msg: "", obj: inbound });
  }
  if (url === `${BASE}/panel/api/inbounds/addClient` && req.method === "POST") {
    const body = await readBody(req);
    if (typeof body.settings !== "string") {
      return json(res, 200, { success: false, msg: "settings must be a JSON string", obj: null });
    }
    const parsed = JSON.parse(body.settings);
    const existing = JSON.parse(inbound.settings);
    for (const c of parsed.clients) {
      if (existing.clients.some((e) => e.email === c.email)) {
        return json(res, 200, { success: false, msg: "Duplicate email", obj: null });
      }
      existing.clients.push(c);
    }
    inbound.settings = JSON.stringify(existing);
    console.log(`[mock-panel] client added: ${parsed.clients.map((c) => c.email).join(",")}`);
    return json(res, 200, { success: true, msg: "Client(s) added", obj: null });
  }
  const upd = url.match(new RegExp(`^${BASE}/panel/api/inbounds/updateClient/(.+)$`));
  if (upd && req.method === "POST") {
    const body = await readBody(req);
    const parsed = JSON.parse(body.settings);
    const existing = JSON.parse(inbound.settings);
    const idx = existing.clients.findIndex((c) => c.id === decodeURIComponent(upd[1]));
    if (idx === -1) return json(res, 200, { success: false, msg: "client not found", obj: null });
    existing.clients[idx] = parsed.clients[0];
    inbound.settings = JSON.stringify(existing);
    console.log(`[mock-panel] client updated: ${parsed.clients[0].email} enable=${parsed.clients[0].enable}`);
    return json(res, 200, { success: true, msg: "updated", obj: null });
  }
  const traffic = url.match(new RegExp(`^${BASE}/panel/api/inbounds/getClientTraffics/(.+)$`));
  if (traffic) {
    const email = decodeURIComponent(traffic[1]);
    const c = JSON.parse(inbound.settings).clients.find((x) => x.email === email);
    if (!c) return json(res, 200, { success: true, msg: "", obj: null });
    return json(res, 200, {
      success: true,
      msg: "",
      obj: {
        id: 1,
        inboundId: 1,
        enable: c.enable,
        email,
        up: 123 * 1024 ** 2,
        down: 456 * 1024 ** 2,
        total: c.totalGB,
        expiryTime: c.expiryTime,
        reset: 0,
      },
    });
  }
  if (url === `${BASE}/panel/api/inbounds/onlines` && req.method === "POST") {
    return json(res, 200, { success: true, msg: "", obj: [] });
  }

  json(res, 404, { success: false, msg: "not found", obj: null });
}).listen(20530, () => console.log("[mock-panel] listening on http://127.0.0.1:20530" + BASE));
