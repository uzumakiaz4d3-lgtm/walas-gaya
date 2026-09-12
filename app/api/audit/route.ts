import { getSessionUser, json } from "../../../lib/auth";
import { getStore } from "../../../lib/store";
import { appendAudit, listAudit } from "../../../lib/audit";

async function sessionUser(request: Request): Promise<
  { ok: true; name: string; role: string; kelas: string | null } | Response
> {
  const session = getSessionUser(request);
  if (!session) return json({ success: false, error: "Sesi tidak valid, silakan login ulang" }, 401);
  const store = getStore();
  await store.ensureReady();
  const user = await store.findUserById(session.sub);
  if (!user || user.status === "nonaktif") {
    return json({ success: false, error: "Sesi tidak valid" }, 401);
  }
  return { ok: true, name: user.name, role: user.role, kelas: user.kelas };
}

export async function GET(request: Request) {
  try {
    const who = await sessionUser(request);
    if (who instanceof Response) return who;
    if (who.role !== "admin") return json({ success: false, error: "Tidak diizinkan" }, 403);

    const url = new URL(request.url);
    const kelas = url.searchParams.get("kelas") || "";
    const limit = Math.min(Number(url.searchParams.get("limit") || "200") || 200, 500);

    let entries = await listAudit();
    if (kelas) entries = entries.filter((e) => e.kelas === String(kelas));
    return json({ success: true, entries: entries.slice(0, limit) });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const who = await sessionUser(request);
    if (who instanceof Response) return who;

    const body = await request.json().catch(() => ({}));
    const aksi = String(body.aksi || "").trim();
    if (!aksi) return json({ success: false, error: "Aksi wajib diisi" }, 400);

    await appendAudit({
      user: who.name,
      role: who.role,
      aksi,
      detail: String(body.detail || "").trim(),
      kelas: body.kelas ? String(body.kelas) : who.kelas,
      sumber: String(body.sumber || "web").slice(0, 30),
    });
    return json({ success: true });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}