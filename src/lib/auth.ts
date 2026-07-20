import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db, tables } from "@/db";
import { eq, lt } from "drizzle-orm";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "shop_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Passwords (scrypt N=16384, stored as salt:hash hex) ──
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// ── Sessions ──
export function createSession(userId: number): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.insert(tables.sessions).values({ id: token, userId, expiresAt }).run();
  return { token, expiresAt };
}

export interface SessionUser {
  id: number;
  username: string;
  role: "user" | "admin";
  banned: boolean;
  verifiedBuyer: boolean;
  chatMutedUntil: number | null;
}

/** Validate a session token → user, or null. Works from Next routes AND server.js. */
export function getUserByToken(token: string | undefined | null): SessionUser | null {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      role: tables.users.role,
      banned: tables.users.banned,
      verifiedBuyer: tables.users.verifiedBuyer,
      chatMutedUntil: tables.users.chatMutedUntil,
      expiresAt: tables.sessions.expiresAt,
    })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(eq(tables.sessions.id, token))
    .get();
  if (!row || row.expiresAt < Date.now()) return null;
  const { expiresAt: _e, ...user } = row;
  return user;
}

export function deleteSession(token: string): void {
  db.delete(tables.sessions).where(eq(tables.sessions.id, token)).run();
}

/** Occasional cleanup of expired sessions. */
export function pruneSessions(): void {
  db.delete(tables.sessions).where(lt(tables.sessions.expiresAt, Date.now())).run();
}

/** Parse the session cookie out of a raw Cookie header (for Socket.IO handshake). */
export function tokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([0-9a-f]{64})`));
  return m ? m[1] : null;
}
