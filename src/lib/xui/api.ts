// ─── 3x-ui panel API client ──────────────────────────────────────────────────
// Targets the v2.x API (/panel/api/inbounds/...) which also works on v3 panels.
// Key gotchas handled here (verified against 3x-ui source):
//  - `settings`/`streamSettings` on inbounds are JSON-encoded STRINGS → parse/stringify
//  - HTTP 200 with {success:false} for logical errors; 404 when unauthenticated
//  - addClient body: { id: inboundId, settings: "<json string with clients[]>" }
//  - updateClient is a FULL REPLACE keyed by client uuid in the path
//  - totalGB is BYTES; expiryTime is epoch MILLISECONDS (negative = start on first use)
//  - email is panel-globally unique; uuid + subId must be generated client-side

import { randomUUID } from "crypto";
import { Agent, fetch as undiciFetch } from "undici";

export interface XuiConfig {
  baseUrl: string; // e.g. https://1.2.3.4:2053/Xr2fK9dQ  (includes webBasePath, no trailing /)
  username: string;
  password: string;
  /** allow self-signed panel certs */
  insecureTls?: boolean;
}

export interface XuiClient {
  id: string; // uuid
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
  private cookie: string | null = null;
  private loginPromise: Promise<void> | null = null;
  private writeMutex = new Mutex();
  private dispatcher?: Agent;

  constructor(private cfg: XuiConfig) {
    if (cfg.insecureTls) {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }
  }

  private url(p: string): string {
    return this.cfg.baseUrl.replace(/\/+$/, "") + p;
  }

  private async rawFetch(p: string, init: { method?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    let body: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    return undiciFetch(this.url(p), {
      method: init.method ?? "GET",
      headers,
      body,
      dispatcher: this.dispatcher,
    });
  }

  private async login(): Promise<void> {
    // dedupe concurrent login attempts
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = (async () => {
      const res = await this.rawFetch("/login", {
        method: "POST",
        body: { username: this.cfg.username, password: this.cfg.password },
      });
      const setCookie = res.headers.getSetCookie?.() ?? [];
      const data = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
      if (!data?.success) {
        throw new XuiError(`ورود به پنل ناموفق: ${data?.msg ?? res.status}`, res.status);
      }
      const session = setCookie.find((c) => c.startsWith("3x-ui=")) ?? setCookie[0];
      if (!session) throw new XuiError("پنل کوکی نشست برنگرداند");
      this.cookie = session.split(";")[0];
    })();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  /**
   * Authenticated request with automatic re-login.
   * 3x-ui returns 404 (deliberately) or 401 when the session is invalid,
   * and 200 with {success:false} for logical errors.
   */
  private async request<T>(p: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
    if (!this.cookie) await this.login();
    const res = await this.rawFetch(p, init);
    if ((res.status === 404 || res.status === 401) && !retried) {
      this.cookie = null;
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
      await this.request("/panel/api/inbounds/addClient", {
        method: "POST",
        // NOTE: settings must be a JSON-encoded STRING (v2 API quirk)
        body: { id: inboundId, settings: JSON.stringify({ clients: [full] }) },
      });
      return { uuid, subId };
    });
  }

  /** Read-modify-write update of one client (updateClient is a full replace). */
  updateClient(inboundId: number, uuid: string, patch: Partial<XuiClient>): Promise<XuiClient> {
    return this.writeMutex.run(async () => {
      const inbound = await this.getInbound(inboundId);
      const settings = JSON.parse(inbound.settings) as { clients: XuiClient[] };
      const existing = settings.clients.find((c) => c.id === uuid);
      if (!existing) throw new XuiError(`کلاینت ${uuid} در اینباند ${inboundId} یافت نشد`);
      const updated: XuiClient = { ...existing, ...patch, id: patch.id ?? existing.id };
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
      await this.request(`/panel/api/inbounds/${inboundId}/delClient/${uuid}`, { method: "POST" });
    });
  }

  resetClientTraffic(inboundId: number, email: string): Promise<void> {
    return this.writeMutex.run(async () => {
      await this.request(`/panel/api/inbounds/${inboundId}/resetClientTraffic/${encodeURIComponent(email)}`, {
        method: "POST",
      });
    });
  }

  getClientTraffic(email: string): Promise<ClientTraffic | null> {
    return this.request<ClientTraffic | null>(
      `/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`,
    );
  }

  /** Emails of currently-connected clients. */
  getOnlines(): Promise<string[]> {
    return this.request<string[]>("/panel/api/inbounds/onlines", { method: "POST" });
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
  const ss = JSON.parse(inbound.streamSettings) as StreamSettings;
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
