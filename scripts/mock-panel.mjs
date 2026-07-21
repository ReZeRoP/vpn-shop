// Mock 3x-ui panel for local E2E testing.
// Reproduces v2 API quirks: cookie login, {success,msg,obj} envelope,
// settings as JSON-encoded string, 404 when unauthenticated.
//
// Modes (env):
//   (default)      v2 panel: plain cookie login.
//   MOCK_V3=1      v3 panel: POST /login returns 403 unless X-CSRF-Token
//                  (from GET /csrf-token) is present. Exercises the CSRF flow.
//   MOCK_TOKEN=xyz accept Authorization: Bearer xyz on any request (v3 API token).
// Usage: node scripts/mock-panel.mjs   (listens on :20530, base path /mock)
import { createServer } from "http";

const BASE = "/mock";
const V3 = process.env.MOCK_V3 === "1";
const API_TOKEN = process.env.MOCK_TOKEN || "";
// MOCK_CLIENTS_API=1 → emulate newer panels: the old /panel/api/inbounds/addClient
// (and sibling client-mutation routes) are GONE (404); clients live under
// /panel/api/clients/*, and inbound settings are returned as nested OBJECTS.
const CLIENTS_API = process.env.MOCK_CLIENTS_API === "1";
let clientIdSeq = 100;
let sessionCounter = 0;
const sessions = new Set();
const csrfTokens = new Set();

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
  // v3 API token bypasses cookies entirely.
  if (API_TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth === `Bearer ${API_TOKEN}`) return true;
  }
  const cookie = req.headers.cookie || "";
  const m = /3x-ui=([^;]+)/.exec(cookie);
  return m && sessions.has(m[1]);
}

createServer(async (req, res) => {
  const url = req.url || "";
  console.log(`[mock-panel] ${req.method} ${url}`);

  // v3 CSRF token issuer
  if (url === `${BASE}/csrf-token`) {
    const token = `csrf${++sessionCounter}`;
    csrfTokens.add(token);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `x-csrf-token=${token}; Path=${BASE}; HttpOnly`,
    });
    res.end(JSON.stringify({ success: true, msg: "", obj: token }));
    return;
  }

  if (url === `${BASE}/login` && req.method === "POST") {
    // v3: reject login that arrives without a valid CSRF token.
    if (V3) {
      const csrf = req.headers["x-csrf-token"];
      if (!csrf || !csrfTokens.has(String(csrf))) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, msg: "CSRF token missing", obj: null }));
        return;
      }
    }
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

  // Newer panels return settings/streamSettings as nested objects, not strings.
  const shapeInbound = (ib) =>
    CLIENTS_API
      ? { ...ib, settings: JSON.parse(ib.settings), streamSettings: JSON.parse(ib.streamSettings) }
      : ib;

  if (url === `${BASE}/panel/api/inbounds/list`) {
    return json(res, 200, { success: true, msg: "", obj: [shapeInbound(inbound)] });
  }
  if (url === `${BASE}/panel/api/inbounds/get/1`) {
    return json(res, 200, { success: true, msg: "", obj: shapeInbound(inbound) });
  }

  // ── Clients API (newer panels) ──
  if (CLIENTS_API) {
    if (url === `${BASE}/panel/api/clients/list`) {
      const clients = JSON.parse(inbound.settings).clients;
      return json(res, 200, { success: true, msg: "", obj: clients });
    }
    if (url === `${BASE}/panel/api/clients/add` && req.method === "POST") {
      const body = await readBody(req);
      const c = body.client;
      const existing = JSON.parse(inbound.settings);
      if (existing.clients.some((e) => e.email === c.email)) {
        return json(res, 200, { success: false, msg: "Duplicate email", obj: null });
      }
      // server assigns numeric id; keeps uuid (client `id`) + subId
      existing.clients.push({ ...c, dbId: ++clientIdSeq });
      inbound.settings = JSON.stringify(existing);
      console.log(`[mock-panel] (clients API) client added: ${c.email} inboundIds=${body.inboundIds}`);
      return json(res, 200, { success: true, msg: "Client added", obj: null });
    }
    const cget = url.match(new RegExp(`^${BASE}/panel/api/clients/get/(.+)$`));
    if (cget && req.method === "GET") {
      const email = decodeURIComponent(cget[1]);
      const c = JSON.parse(inbound.settings).clients.find((x) => x.email === email);
      if (!c) return json(res, 200, { success: true, msg: "", obj: null });
      // clients API separates numeric id from the VLESS uuid (which is client.id here)
      return json(res, 200, {
        success: true,
        msg: "",
        obj: { ...c, id: c.dbId ?? 1, uuid: c.id, subId: c.subId },
      });
    }
    const cupd = url.match(new RegExp(`^${BASE}/panel/api/clients/update/(.+)$`));
    if (cupd && req.method === "POST") {
      const email = decodeURIComponent(cupd[1]);
      const body = await readBody(req);
      const existing = JSON.parse(inbound.settings);
      const idx = existing.clients.findIndex((c) => c.email === email);
      if (idx === -1) return json(res, 200, { success: false, msg: "client not found", obj: null });
      existing.clients[idx] = { ...existing.clients[idx], ...body };
      inbound.settings = JSON.stringify(existing);
      console.log(`[mock-panel] (clients API) client updated: ${email} enable=${body.enable}`);
      return json(res, 200, { success: true, msg: "Client updated", obj: null });
    }
    const cdel = url.match(new RegExp(`^${BASE}/panel/api/clients/del/(.+)$`));
    if (cdel && req.method === "POST") {
      const email = decodeURIComponent(cdel[1]);
      const existing = JSON.parse(inbound.settings);
      existing.clients = existing.clients.filter((c) => c.email !== email);
      inbound.settings = JSON.stringify(existing);
      console.log(`[mock-panel] (clients API) client deleted: ${email}`);
      return json(res, 200, { success: true, msg: "Client deleted", obj: null });
    }
    const ctraf = url.match(new RegExp(`^${BASE}/panel/api/clients/traffic/(.+)$`));
    if (ctraf && req.method === "GET") {
      const email = decodeURIComponent(ctraf[1]);
      const c = JSON.parse(inbound.settings).clients.find((x) => x.email === email);
      if (!c) return json(res, 200, { success: true, msg: "", obj: null });
      return json(res, 200, {
        success: true,
        msg: "",
        obj: {
          id: c.dbId ?? 1, inboundId: 1, enable: c.enable, email,
          up: 123 * 1024 ** 2, down: 456 * 1024 ** 2,
          total: c.totalGB, expiryTime: c.expiryTime, reset: 0,
        },
      });
    }
    if (url === `${BASE}/panel/api/clients/onlines` && req.method === "POST") {
      return json(res, 200, { success: true, msg: "", obj: [] });
    }
    // On newer panels the old inbound-scoped client routes are GONE → 404.
    if (/\/panel\/api\/inbounds\/(addClient|updateClient|delClient|resetClientTraffic|getClientTraffics|onlines)/.test(url)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: false, msg: "not found", obj: null }));
    }
  }

  // The clients-API probe hits this on legacy panels → 404 (route absent).
  if (!CLIENTS_API && url === `${BASE}/panel/api/clients/list`) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: false, msg: "not found", obj: null }));
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
  const del = url.match(new RegExp(`^${BASE}/panel/api/inbounds/\\d+/delClient/(.+)$`));
  if (del && req.method === "POST") {
    const uuid = decodeURIComponent(del[1]);
    const existing = JSON.parse(inbound.settings);
    existing.clients = existing.clients.filter((c) => c.id !== uuid);
    inbound.settings = JSON.stringify(existing);
    console.log(`[mock-panel] client deleted: ${uuid}`);
    return json(res, 200, { success: true, msg: "deleted", obj: null });
  }
  const rst = url.match(new RegExp(`^${BASE}/panel/api/inbounds/\\d+/resetClientTraffic/(.+)$`));
  if (rst && req.method === "POST") {
    return json(res, 200, { success: true, msg: "reset", obj: null });
  }
  if (url === `${BASE}/panel/api/inbounds/onlines` && req.method === "POST") {
    return json(res, 200, { success: true, msg: "", obj: [] });
  }

  json(res, 404, { success: false, msg: "not found", obj: null });
}).listen(20530, () => console.log("[mock-panel] listening on http://127.0.0.1:20530" + BASE));
