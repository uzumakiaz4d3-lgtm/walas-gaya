import { getSessionUser, json } from "../../../lib/auth";
import { getStore } from "../../../lib/store";
import type { SessionUser } from "../../../lib/auth";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * GET  /api/kelas-data?kelas=7A  — ambil dokumen data kelas (wali_kelas: kelasnya sendiri; admin: semua)
 * PUT  /api/kelas-data            — simpan { kelas, key, value } (update satu key) atau { kelas, data } (dokumen penuh)
 */
async function authorize(request: Request, kelas: string): Promise<{ ok: true; session: SessionUser } | Response> {
  const session = getSessionUser(request);
  if (!session) {
    return json({ success: false, error: "Sesi tidak valid, silakan login ulang" }, 401);
  }
  const store = getStore();
  await store.ensureReady();
  const user = await store.findUserById(session.sub);
  if (!user || user.status === "nonaktif") {
    return json({ success: false, error: "Sesi tidak valid" }, 401);
  }
  if (session.role === "admin") return { ok: true, session };
  if (user.kelas !== String(kelas || "")) {
    return json({ success: false, error: "Tidak diizinkan" }, 403);
  }
  return { ok: true, session };
}

export async function GET(request: Request) {
  try {
    const kelas = new URL(request.url).searchParams.get("kelas") || "";
    if (!kelas) return json({ success: false, error: "Parameter kelas wajib diisi" }, 400);
    const auth = await authorize(request, kelas);
    if (auth instanceof Response) return auth;

    const store = getStore();
    const rec = await store.getAppData("kelas:" + kelas);
    return json({
      success: true,
      kelas,
      data: rec ? rec.data : {},
      updatedAt: rec ? rec.updatedAt : null,
    });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const kelas = String(body.kelas || "").trim();
    if (!kelas) return json({ success: false, error: "Parameter kelas wajib diisi" }, 400);
    const auth = await authorize(request, kelas);
    if (auth instanceof Response) return auth;

    const store = getStore();
    const record = await store.getAppData("kelas:" + kelas);
    let doc: Record<string, unknown> = record ? record.data : {};

    if (body.data !== undefined && body.data !== null && typeof body.data === "object" && !Array.isArray(body.data)) {
      doc = body.data as Record<string, unknown>;
    } else if (typeof body.key === "string" && body.key && body.value !== undefined) {
      doc[body.key] = body.value;
    } else {
      return json({ success: false, error: "Body tidak valid: kirim { kelas, key, value } atau { kelas, data }" }, 400);
    }

    const size = Buffer.byteLength(JSON.stringify(doc));
    if (size > MAX_BYTES) {
      return json({ success: false, error: "Data terlalu besar (maks 2 MB)" }, 413);
    }

    await store.setAppData("kelas:" + kelas, doc);
    return json({ success: true, kelas, updatedAt: new Date().toISOString() });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}