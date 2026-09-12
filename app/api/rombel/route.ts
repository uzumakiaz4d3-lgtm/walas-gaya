import { getSessionUser, json } from "../../../lib/auth";
import { getStore } from "../../../lib/store";

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
    const rombel = await store.listRombel();
    return json({ success: true, rombel });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function POST(request: Request) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const body = await request.json().catch(() => ({}));
    const nama = String(body.nama || "").trim();
    if (!nama) {
      return json({ success: false, error: "Nama rombel wajib diisi" }, 400);
    }
    const store = getStore();
    await store.ensureReady();

    if (await store.findRombelByNama(nama)) {
      return json({ success: false, error: "Rombel sudah terdaftar" }, 409);
    }

    const rombel = await store.createRombel(nama);
    return json({ success: true, rombel });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}