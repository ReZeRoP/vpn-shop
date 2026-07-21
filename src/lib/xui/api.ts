// ─── 3x-ui panel API client ──────────────────────────────────────────────────
// Supports BOTH client APIs (auto-detected — see detectClientApi):
//  - legacy: clients nested in the inbound, mutated via /panel/api/inbounds/*
//    (addClient/updateClient/...). Works on v2.x and older v3 panels.
//  - clients: newer builds REMOVED those routes and expose clients as
//    first-class entities under /panel/api/clients/* (keyed by email).
// Read-only inbound routes (/panel/api/inbounds/list|get) exist on both.
// Key gotchas handled here (verified against 3x-ui source):
//  - `settings`/`streamSettings` on inbounds are JSON-encoded STRINGS → parse/stringify
//  - HTTP 200 with {success:false} for logical errors; 404 when unauthenticated
//  - legacy addClient body: { id: inboundId, settings: "<json with clients[]>" }
//  - legacy updateClient is a FULL REPLACE keyed by client uuid in the path
//  - clients API keys by email; uuid/subId are generated server-side, read back
//  - totalGB is BYTES; expiryTime is epoch MILLISECONDS (negative = start on first use)
//  - email is panel-globally unique

import { randomUUID } from "crypto";
import { Agent, fetch as undiciFetch } from "undici";

export interface XuiConfig {
  baseUrl: string; // e.g. https://1.2.3.4:2053/Xr2fK9dQ  (includes webBasePath, no trailing /)
  username: string;
  password: string;
  /** allow self-signed panel certs */
  insecureTls?: boolean;
  /** v3 API token — when set, login/cookies are skipped and Authorization: Bearer is sent */
  token?: string;
}

export interface XuiClient {
  id: string; // legacy API: this IS the VLESS uuid. clients API: numeric DB id (see uuid)
  /** clients API only: the VLESS uuid, separate from the numeric id */
  uuid?: string;
  flow: string;
  email: string;
  limitIp: number;
  totalGB: number; // BYTES despite the name
  expiryTime: number; // ms epoch, 0=never, negative=start-on-first-use countdown
  enable: boolean;
  tgId: number | string;
  subId: string;
  comment?: string;
  reset: number;
}

export interface ClientTraffic {
  id: number;
  inboundId: number;
  enable: boolean;
  email: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  reset: number;
  lastOnline?: number;
}

export interface Inbound {
  id: number;
  remark: string;
  enable: boolean;
  port: number;
  protocol: string;
  settings: string; // JSON string
  streamSettings: string; // JSON string
  clientStats: ClientTraffic[] | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  msg: string;
  obj: T;
}

export class XuiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "XuiError";
  }
}

/** Generate a 16-char [a-z0-9] subscription id (mirrors the panel web UI). */
export function genSubId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

export function gbToBytes(gb: number): number {
  return gb <= 0 ? 0 : Math.round(gb * 1024 ** 3);
}

/**
 * Parse an inbound's settings/streamSettings field. Legacy panels return these
 * as JSON-encoded STRINGS; newer (clients-API) panels return nested OBJECTS.
 * Accept either so we work across versions.
 */
export function parseInboundJson<T>(field: unknown): T {
  return typeof field === "string" ? (JSON.parse(field) as T) : (field as T);
}

/** Serialize async panel writes so we never race addClient/updateClient calls. */
class Mutex {
  private chain: Promise<void> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.chain.then(fn);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class XuiApi {
  /** Cookie jar: v3 panels set both a csrf cookie and the session cookie — keep them all */
  private cookies = new Map<string, string>();
  private csrfToken: string | null = null;
  private loginPromise: Promise<void> | null = null;
  private writeMutex = new Mutex();
  private dispatcher?: Agent;
  /** Which client API the panel speaks: probed once, then cached. */
  private clientApi: "legacy" | "clients" | null = null;
  private clientApiProbe: Promise<"legacy" | "clients"> | null = null;

  constructor(private cfg: XuiConfig) {
    if (cfg.insecureTls) {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }
  }

  private url(p: string): string {
    return this.cfg.baseUrl.replace(/\/+$/, "") + p;
  }

  /** Absorb every Set-Cookie header into the jar (name=value before the first ";"). */
  private absorbCookies(res: { headers: { getSetCookie?: () => string[] } }): void {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private async rawFetch(p: string, init: { method?: string; body?: unknown } = {}) {
    const method = init.method ?? "GET";
    // browser-like headers: some panels sit behind WAF/CDN that rejects bare clients
    const origin = new URL(this.cfg.baseUrl).origin;
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      Origin: origin,
      Referer: origin + "/",
    };
    if (this.cfg.token) {
      headers.Authorization = `Bearer ${this.cfg.token}`;
    } else if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    if (method !== "GET" && this.csrfToken) headers["X-CSRF-Token"] = this.csrfToken;
    let body: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    const res = await undiciFetch(this.url(p), {
      method,
      headers,
      body,
      dispatcher: this.dispatcher,
    });
    if (!this.cfg.token) this.absorbCookies(res);
    return res;
  }

  /**
   * v3 CSRF flow: GET {base}/csrf-token sets a csrf cookie and returns the token
   * (as {"success":true,"obj":"<token>"}, {token:"..."} or plain text — handle all).
   */
  private async ensureCsrf(): Promise<void> {
    const res = await this.rawFetch("/csrf-token");
    if (res.status !== 200) return;
    const text = await res.text();
    let token = text.trim();
    try {
      const data = JSON.parse(text) as { obj?: unknown; token?: unknown };
      if (typeof data?.obj === "string") token = data.obj;
      else if (typeof data?.token === "string") token = data.token;
    } catch {
      // plain-text token — use as-is
    }
    if (token) this.csrfToken = token;
  }

  private async login(): Promise<void> {
    // dedupe concurrent login attempts
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = (async () => {
      const credentials = { username: this.cfg.username, password: this.cfg.password };
      let res = await this.rawFetch("/login", { method: "POST", body: credentials });
      if (res.status === 403) {
        // v3 CSRF protection: fetch the token + csrf cookie, then retry once
        await this.ensureCsrf();
        res = await this.rawFetch("/login", { method: "POST", body: credentials });
        if (res.status === 403) {
          throw new XuiError(
            "پنل با کد 403 پاسخ داد — احتمالاً فایروال/CDN جلوی درخواست را می‌گیرد یا IP سرور سایت در پنل مجاز نیست. آدرس پنل و دسترسی IP سرور را بررسی کنید.",
            403,
          );
        }
      }
      const data = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
      if (!data?.success) {
        throw new XuiError(`ورود به پنل ناموفق: ${data?.msg ?? res.status}`, res.status);
      }
      if (!this.cookies.size) throw new XuiError("پنل کوکی نشست برنگرداند");
    })();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  /**
   * Authenticated request with automatic re-login.
   * 3x-ui returns 404 (deliberately), 401, or 403 (v3 csrf/session) when the
   * session is invalid, and 200 with {success:false} for logical errors.
   */
  private async request<T>(p: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
    if (this.cfg.token) {
      const res = await this.rawFetch(p, init);
      if (res.status === 401 || res.status === 403) {
        throw new XuiError("توکن API پنل نامعتبر است", res.status);
      }
      if (!res.ok) throw new XuiError(`خطای پنل: HTTP ${res.status} در ${p}`, res.status);
      const data = (await res.json()) as ApiEnvelope<T>;
      if (!data.success) throw new XuiError(`خطای پنل: ${data.msg}`);
      return data.obj;
    }
    if (!this.cookies.size) await this.login();
    const res = await this.rawFetch(p, init);
    if ((res.status === 404 || res.status === 401 || res.status === 403) && !retried) {
      this.cookies.clear();
      this.csrfToken = null;
      await this.login();
      return this.request<T>(p, init, true);
    }
    if (!res.ok) throw new XuiError(`خطای پنل: HTTP ${res.status} در ${p}`, res.status);
    const data = (await res.json()) as ApiEnvelope<T>;
    if (!data.success) throw new XuiError(`خطای پنل: ${data.msg}`);
    return data.obj;
  }

  // ── Inbounds ──
  listInbounds(): Promise<Inbound[]> {
    return this.request<Inbound[]>("/panel/api/inbounds/list");
  }

  getInbound(id: number): Promise<Inbound> {
    return this.request<Inbound>(`/panel/api/inbounds/get/${id}`);
  }

  // ── Client-API detection ──
  /**
   * Newer 3x-ui builds dropped /panel/api/inbounds/addClient and expose clients
   * under /panel/api/clients/*. Probe once (authenticated) and cache: a real
   * envelope from /panel/api/clients/list ⇒ "clients"; a 404 ⇒ legacy inbounds API.
   */
  /** Public: which client API the panel speaks (for diagnostics). */
  whichClientApi(): Promise<"legacy" | "clients"> {
    return this.detectClientApi();
  }

  private detectClientApi(): Promise<"legacy" | "clients"> {
    if (this.clientApi) return Promise.resolve(this.clientApi);
    if (this.clientApiProbe) return this.clientApiProbe;
    this.clientApiProbe = (async () => {
      const status = await this.probeStatus("/panel/api/clients/list");
      // 200 (route exists) ⇒ clients API; 404 ⇒ old inbound-scoped API.
      this.clientApi = status === 404 ? "legacy" : "clients";
      return this.clientApi;
    })().finally(() => {
      this.clientApiProbe = null;
    });
    return this.clientApiProbe;
  }

  /**
   * Authenticated GET that returns only the HTTP status (re-logging in once on
   * an auth-shaped 404/401/403), used to tell "route missing" from "not logged in".
   */
  private async probeStatus(p: string): Promise<number> {
    if (!this.cfg.token && !this.cookies.size) await this.login();
    let res = await this.rawFetch(p);
    if ((res.status === 404 || res.status === 401 || res.status === 403) && !this.cfg.token) {
      this.cookies.clear();
      this.csrfToken = null;
      await this.login();
      res = await this.rawFetch(p);
    }
    return res.status;
  }

  // ── Clients ──
  /** Add a client to an inbound. Generates uuid/subId if not supplied. */
  addClient(
    inboundId: number,
    client: Partial<XuiClient> & { email: string },
  ): Promise<{ uuid: string; subId: string }> {
    const uuid = client.id ?? randomUUID();
    const subId = client.subId ?? genSubId();
    const full: XuiClient = {
      id: uuid,
      flow: client.flow ?? "",
      email: client.email,
      limitIp: client.limitIp ?? 0,
      totalGB: client.totalGB ?? 0,
      expiryTime: client.expiryTime ?? 0,
      enable: client.enable ?? true,
      tgId: client.tgId ?? "",
      subId,
      comment: client.comment ?? "",
      reset: client.reset ?? 0,
    };
    return this.writeMutex.run(async () => {
      if ((await this.detectClientApi()) === "clients") {
        // clients API: { client: {...}, inboundIds: [id] }. uuid/subId are honored
        // when supplied (fields are writable); read them back to be safe.
        await this.request("/panel/api/clients/add", {
          method: "POST",
          body: { client: full, inboundIds: [inboundId] },
        });
        // Read back: the clients API separates uuid (VLESS id) from numeric id,
        // and generates uuid/subId server-side when omitted. Prefer the read value.
        const saved = await this.getClientByEmail(client.email);
        return { uuid: saved?.uuid ?? saved?.id ?? uuid, subId: saved?.subId ?? subId };
      }
      await this.request("/panel/api/inbounds/addClient", {
        method: "POST",
        // NOTE: settings must be a JSON-encoded STRING (legacy API quirk)
        body: { id: inboundId, settings: JSON.stringify({ clients: [full] }) },
      });
      return { uuid, subId };
    });
  }

  /** Read-modify-write update of one client (updateClient is a full replace). */
  updateClient(inboundId: number, uuid: string, patch: Partial<XuiClient>): Promise<XuiClient> {
    return this.writeMutex.run(async () => {
      const inbound = await this.getInbound(inboundId);
      const settings = parseInboundJson<{ clients: XuiClient[] }>(inbound.settings);
      const existing = settings.clients.find((c) => c.id === uuid || c.uuid === uuid);
      if (!existing) throw new XuiError(`کلاینت ${uuid} در اینباند ${inboundId} یافت نشد`);
      const updated: XuiClient = { ...existing, ...patch, id: patch.id ?? existing.id };
      if ((await this.detectClientApi()) === "clients") {
        // clients API keys by email; body is the flat client object.
        await this.request(`/panel/api/clients/update/${encodeURIComponent(updated.email)}`, {
          method: "POST",
          body: updated,
        });
        return updated;
      }
      await this.request(`/panel/api/inbounds/updateClient/${uuid}`, {
        method: "POST",
        body: { id: inboundId, settings: JSON.stringify({ clients: [updated] }) },
      });
      return updated;
    });
  }

  /** Suspend / re-enable a client (used for receipt revocation — reversible). */
  setClientEnable(inboundId: number, uuid: string, enable: boolean): Promise<XuiClient> {
    return this.updateClient(inboundId, uuid, { enable });
  }

  deleteClient(inboundId: number, uuid: string): Promise<void> {
    return this.writeMutex.run(async () => {
      if ((await this.detectClientApi()) === "clients") {
        // clients API deletes by email — resolve it from the inbound first.
        const inbound = await this.getInbound(inboundId);
        const settings = parseInboundJson<{ clients: XuiClient[] }>(inbound.settings);
        const target = settings.clients.find((c) => c.id === uuid || c.uuid === uuid);
        if (!target) return; // already gone
        await this.request(`/panel/api/clients/del/${encodeURIComponent(target.email)}`, {
          method: "POST",
        });
        return;
      }
      await this.request(`/panel/api/inbounds/${inboundId}/delClient/${uuid}`, { method: "POST" });
    });
  }

  resetClientTraffic(inboundId: number, email: string): Promise<void> {
    return this.writeMutex.run(async () => {
      if ((await this.detectClientApi()) === "clients") {
        await this.request(`/panel/api/clients/resetTraffic/${encodeURIComponent(email)}`, {
          method: "POST",
        });
        return;
      }
      await this.request(`/panel/api/inbounds/${inboundId}/resetClientTraffic/${encodeURIComponent(email)}`, {
        method: "POST",
      });
    });
  }

  /** Full client record by email (clients API only — used to read back uuid/subId). */
  private getClientByEmail(email: string): Promise<XuiClient | null> {
    return this.request<XuiClient | null>(`/panel/api/clients/get/${encodeURIComponent(email)}`);
  }

  async getClientTraffic(email: string): Promise<ClientTraffic | null> {
    if ((await this.detectClientApi()) === "clients") {
      return this.request<ClientTraffic | null>(`/panel/api/clients/traffic/${encodeURIComponent(email)}`);
    }
    return this.request<ClientTraffic | null>(
      `/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`,
    );
  }

  /** Emails of currently-connected clients. */
  async getOnlines(): Promise<string[]> {
    const base = (await this.detectClientApi()) === "clients" ? "/panel/api/clients" : "/panel/api/inbounds";
    return this.request<string[]>(`${base}/onlines`, { method: "POST" });
  }
}

// ─── Share-link building ─────────────────────────────────────────────────────

interface StreamSettings {
  network: string;
  security: string;
  tlsSettings?: {
    serverName?: string;
    settings?: { fingerprint?: string };
    alpn?: string[];
  };
  realitySettings?: {
    serverNames?: string[];
    shortIds?: string[];
    settings?: { publicKey?: string; fingerprint?: string; spiderX?: string };
  };
  wsSettings?: { path?: string; host?: string; headers?: Record<string, string> };
  grpcSettings?: { serviceName?: string };
}

/**
 * Build a vless:// share URI from inbound + client data.
 * `publicHost` must be the server's public address — inbound.listen is usually 0.0.0.0.
 */
export function buildVlessLink(
  inbound: Inbound,
  uuid: string,
  clientEmail: string,
  publicHost: string,
  flow?: string,
): string {
  const ss = parseInboundJson<StreamSettings>(inbound.streamSettings);
  const params = new URLSearchParams();
  params.set("type", ss.network || "tcp");
  params.set("security", ss.security || "none");
  params.set("encryption", "none");

  if (ss.security === "reality" && ss.realitySettings) {
    const r = ss.realitySettings;
    if (r.settings?.publicKey) params.set("pbk", r.settings.publicKey);
    if (r.settings?.fingerprint) params.set("fp", r.settings.fingerprint);
    if (r.serverNames?.[0]) params.set("sni", r.serverNames[0]);
    if (r.shortIds?.[0]) params.set("sid", r.shortIds[0]);
    if (r.settings?.spiderX) params.set("spx", r.settings.spiderX);
  } else if (ss.security === "tls" && ss.tlsSettings) {
    if (ss.tlsSettings.serverName) params.set("sni", ss.tlsSettings.serverName);
    if (ss.tlsSettings.settings?.fingerprint) params.set("fp", ss.tlsSettings.settings.fingerprint);
    if (ss.tlsSettings.alpn?.length) params.set("alpn", ss.tlsSettings.alpn.join(","));
  }

  if (ss.network === "ws" && ss.wsSettings) {
    if (ss.wsSettings.path) params.set("path", ss.wsSettings.path);
    const host = ss.wsSettings.host || ss.wsSettings.headers?.Host;
    if (host) params.set("host", host);
  }
  if (ss.network === "grpc" && ss.grpcSettings?.serviceName) {
    params.set("serviceName", ss.grpcSettings.serviceName);
  }
  if (flow && ss.network === "tcp" && (ss.security === "tls" || ss.security === "reality")) {
    params.set("flow", flow);
  }

  const remark = encodeURIComponent(`${inbound.remark}-${clientEmail}`);
  return `vless://${uuid}@${publicHost}:${inbound.port}?${params.toString()}#${remark}`;
}

/** Subscription URL: subBase like https://host:2096/sub/ (admin-configured). */
export function buildSubUrl(subBase: string, subId: string): string {
  return subBase.replace(/\/+$/, "") + "/" + subId;
}
