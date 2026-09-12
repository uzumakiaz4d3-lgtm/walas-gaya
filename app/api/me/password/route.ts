import { getSessionUser, json, verifyPassword, hashPassword } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";
import { appendAudit } from "../../../../lib/audit";

/**
 * POST /api/me/password — ubah kata sandi akun sendiri (semua role yang login).
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json().catch(() => ({}));
    const current = String(body.currentPassword || "");
    const baru = String(body.newPassword || "");

    if (!current || !baru) {
      return json({ success: false, error: "Kata sandi lama dan baru wajib diisi" }, 400);
    }
    if (!(await verifyPassword(current, user.passwordHash))) {
      return json({ success: false, error: "Kata sandi saat ini salah" }, 400);
    }
    if (baru.length < 6) {
      return json({ success: false, error: "Kata sandi baru minimal 6 karakter" }, 400);
    }
    if (baru === current) {
      return json({ success: false, error: "Kata sandi baru harus berbeda dari kata sandi saat ini" }, 400);
    }

    await store.updateUser(user.id, { passwordHash: await hashPassword(baru) });

    appendAudit({
      user: user.name,
      role: user.role,
      aksi: "Ubah kata sandi",
      detail: "Akun mengubah kata sandi sendiri",
      kelas: user.kelas,
      sumber: "web",
    }).catch(() => undefined);

    return json({ success: true, message: "Kata sandi berhasil diubah" });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}