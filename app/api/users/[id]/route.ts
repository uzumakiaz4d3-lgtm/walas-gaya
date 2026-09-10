import { getSessionUser, json, hashPassword } from "../../../../lib/auth";
import { getStore, publicUser } from "../../../../lib/store";
import type { Role, UserStatus } from "../../../../lib/store";

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await params;
    const store = getStore();
    await store.ensureReady();

    const current = await store.findUserById(id);
    if (!current) {
      return json({ success: false, error: "Pengguna tidak ditemukan" }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    if (!email || !name) {
      return json({ success: false, error: "Nama dan email wajib diisi" }, 400);
    }

    const duplicate = await store.findUserByEmail(email);
    if (duplicate && duplicate.id !== id) {
      return json({ success: false, error: "Email sudah terdaftar" }, 409);
    }

    const patch: Partial<Omit<any, "id">> = {
      email,
      name,
      role: body.role === "admin" ? ("admin" as Role) : ("wali_kelas" as Role),
      kelas: body.kelas || null,
    };
    if (body.status === "aktif" || body.status === "nonaktif") {
      patch.status = body.status as UserStatus;
    }
    if (body.password) {
      patch.passwordHash = await hashPassword(String(body.password));
    }

    const updated = await store.updateUser(id, patch);
    if (!updated) {
      return json({ success: false, error: "Pengguna tidak ditemukan" }, 404);
    }
    return json({ success: true, user: publicUser(updated) });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await params;
    const store = getStore();
    await store.ensureReady();

    const target = await store.findUserById(id);
    if (!target) {
      return json({ success: false, error: "Pengguna tidak ditemukan" }, 404);
    }
    if (target.role === "admin") {
      return json({ success: false, error: "Akun admin tidak dapat dihapus" }, 400);
    }
    await store.deleteUser(id);
    return json({ success: true });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await params;
    const store = getStore();
    await store.ensureReady();

    if (!(await store.findUserById(id))) {
      return json({ success: false, error: "Pengguna tidak ditemukan" }, 404);
    }
    await store.updateUser(id, { passwordHash: await hashPassword("wali123") });
    return json({ success: true, message: "Password direset ke wali123" });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}