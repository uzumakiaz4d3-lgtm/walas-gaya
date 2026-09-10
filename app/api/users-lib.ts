import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export function hashPassword(pwd: string) {
  return createHash("sha256").update(String(pwd)).digest("hex");
}

export async function readUsers(): Promise<any[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

export async function writeUsers(users: any[]) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify({ users }, null, 2), "utf-8");
}

export function isAdminRequest(request: Request) {
  return request.headers.get("x-user-role") === "admin";
}