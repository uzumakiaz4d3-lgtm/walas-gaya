import { getSessionUser, json, hashPassword } from "../../../lib/auth";
import { getStore, publicUser } from "../../../lib/store";
import type { Role } from "../../../lib/store";

function requireAdmin(request: Request): { sub: string; role: string } | Response {
  const session = getSessionUser(request);
  if (!session) {
    return json({ success: false, error: "Sesi tidak valid, silakan login ulang" }, 401);
  }
  if (session.role !== "admin") {
    return json({ success: false, error: "Tidak diizinkan" }, 403);
  }
  return session;
}

export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const store = getStore();
    await store.ensureReady();
    const users = await store.listUsers();
    return json({ success: true, users: users.map(publicUser) });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function POST(request: Request) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const role: Role = body.role === "admin" ? "admin" : "wali_kelas";
    const kelas = body.kelas || null;

    if (!email || !name || !password) {
      return json({ success: false, error: "Nama, email, dan password wajib diisi" }, 400);
    }
    if (password.length < 6) {
      return json({ success: false, error: "Password minimal 6 karakter" }, 400);
    }

    const store = getStore();
    await store.ensureReady();

    if (await store.findUserByEmail(email)) {
      return json({ success: false, error: "Email sudah terdaftar" }, 409);
    }

    const user = await store.createUser({
      email,
      passwordHash: await hashPassword(password),
      name,
      role,
      kelas,
      status: "aktif",
    });

    return json({ success: true, user: publicUser(user) });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}