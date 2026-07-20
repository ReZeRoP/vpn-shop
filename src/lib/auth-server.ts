import { cookies } from "next/headers";
import { getUserByToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth";

/** Current user in a Next.js server component / route handler. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return getUserByToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u || u.banned) throw new Response("Unauthorized", { status: 401 });
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u || u.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return u;
}
