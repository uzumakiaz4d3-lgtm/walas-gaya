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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await params;
    const store = getStore();
    await store.ensureReady();

    const current = await store.findWalasById(id);
    if (!current) {
      return json({ success: false, error: "Profil wali kelas tidak ditemukan" }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const nama = String(body.nama || current.nama).trim();
    if (!nama) {
      return json({ success: false, error: "Nama tidak boleh kosong" }, 400);
    }

    const updated = await store.updateWalas(id, {
      nama,
      nip: body.nip !== undefined ? String(body.nip).trim() || null : current.nip,
      no_telp: body.no_telp !== undefined ? String(body.no_telp).trim() || null : current.no_telp,
      status: body.status === "nonaktif" ? "nonaktif" : "aktif",
    });

    return json({ success: true, walas: updated });
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

    const target = await store.findWalasById(id);
    if (!target) {
      return json({ success: false, error: "Profil wali kelas tidak ditemukan" }, 404);
    }
    await store.deleteWalas(id);
    return json({ success: true });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}