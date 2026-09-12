import { getSessionUser, json } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";

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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await params;
    const store = getStore();
    await store.ensureReady();

    const rombel = await store.listRombel();
    const target = rombel.find((r) => r.id === id);
    if (!target) {
      return json({ success: false, error: "Rombel tidak ditemukan" }, 404);
    }
    const users = await store.listUsers();
    const used = users.find((u) => u.kelas === target.nama);
    if (used) {
      return json({ success: false, error: `Rombel ${target.nama} masih dipakai akun ${used.name}` }, 400);
    }
    await store.deleteRombel(id);
    return json({ success: true });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}