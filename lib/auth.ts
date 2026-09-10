import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type { UserRow } from "./store";

export const SESSION_COOKIE = "wk_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 hari

function secret(): string {
  const s = process.env.AUTH_SECRET || "";
  if (!s) {
    throw new Error("AUTH_SECRET belum di-set. Set variabel env dulu (lihat .env.example).");
  }
  return s;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(String(pw), 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(String(pw), hash);
  } catch {
    return false;
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export interface SessionPayload {
  sub: string;
  role: string;
  exp: number;
}

export function signSession(user: Pick<UserRow, "id" | "role">): string {
  const payload: SessionPayload = {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const expected = createHmac("sha256", secret()).update(body).digest();
    const given = Buffer.from(sig, "base64url");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${
    secure ? "; Secure" : ""
  }`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookieHeader(request: Request): string {
  return request.headers.get("cookie") || "";
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export interface SessionUser {
  sub: string;
  role: string;
}

export function getSessionUser(request: Request): SessionUser | null {
  const token = parseCookies(readCookieHeader(request))[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  return { sub: payload.sub, role: payload.role };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}