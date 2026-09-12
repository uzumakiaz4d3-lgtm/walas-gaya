import { getStore, publicUser } from "../../../lib/store";
import { verifyPassword, signSession, buildSessionCookie, json } from "../../../lib/auth";
import { appendAudit } from "../../../lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return json({ success: false, error: "Email dan kata sandi wajib diisi" }, 400);
    }

    const store = getStore();
    await store.ensureReady();

    const user = await store.findUserByEmail(email);
    const valid =
      user && user.status !== "nonaktif" && (await verifyPassword(password, user.passwordHash));

    if (!valid || !user) {
      return json({ success: false, error: "Email atau kata sandi salah" }, 401);
    }

    const token = signSession(user);
    const redirect = user.role === "admin" ? "/src/admin/admin.html" : "/src/dashboard/dashboard.html";

    appendAudit({
      user: user.name,
      role: user.role,
      aksi: "Login",
      detail: "Login berhasil",
      kelas: user.kelas,
      sumber: "server",
    }).catch(() => undefined);

    return new Response(
      JSON.stringify({ success: true, user: publicUser(user), redirect }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildSessionCookie(token),
        },
      }
    );
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}