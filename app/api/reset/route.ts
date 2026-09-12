import { getSessionUser, json } from "../../../lib/auth";
import { getStore } from "../../../lib/store";

export async function POST(request: Request) {
  const session = getSessionUser(request);
  if (!session) {
    return json({ success: false, error: "Sesi tidak valid, silakan login ulang" }, 401);
  }
  if (session.role !== "admin") {
    return json({ success: false, error: "Tidak diizinkan" }, 403);
  }
  try {
    const store = getStore();
    await store.ensureReady();
    await store.resetAll();
    const users = await store.listUsers();
    return json({ success: true, reset: true, users: users.length });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}