import { getSessionUser, json } from "../../../lib/auth";
import { getStore } from "../../../lib/store";

/**
 * GET /api/settings   — profil sekolah (monggokan global), siapa pun yang login boleh baca
 * PUT /api/settings   — hanya admin yang boleh menyimpan (body { data })
 */
export async function GET(request: Request) {
  const session = getSessionUser(request);
  if (!session) return json({ success: false, error: "Sesi tidak valid, silakan login ulang" }, 401);
  try {
    const store = getStore();
    const rec = await store.getAppData("settings");
    return json({ success: true, data: rec ? rec.data : {}, updatedAt: rec ? rec.updatedAt : null });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function PUT(request: Request) {
  const session = getSessionUser(request);
  if (!session) return json({ success: false, error: "Sesi tidak valid, silakan login ulang" }, 401);
  if (session.role !== "admin") return json({ success: false, error: "Tidak diizinkan" }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const data = body && typeof body === "object" ? body.data : null;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json({ success: false, error: "Body tidak valid: kirim { data: {...} }" }, 400);
    }
    const store = getStore();
    await store.setAppData("settings", data as Record<string, unknown>);
    return json({ success: true, updatedAt: new Date().toISOString() });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}