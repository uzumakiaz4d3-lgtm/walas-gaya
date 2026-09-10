import { readUsers, writeUsers, hashPassword, isAdminRequest } from "../users-lib";

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    kelas: u.kelas || null,
    status: u.status || "aktif",
  };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ success: false, error: "Tidak diizinkan" }, { status: 403 });
  }
  const users = await readUsers();
  return Response.json({ success: true, users: users.map(publicUser) });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ success: false, error: "Tidak diizinkan" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    const password = String(body.password || "").trim();
    const role = body.role === "admin" ? "admin" : "wali_kelas";
    const kelas = body.kelas || null;

    if (!email || !name || !password) {
      return Response.json({ success: false, error: "Nama, email, dan password wajib diisi" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ success: false, error: "Password minimal 6 karakter" }, { status: 400 });
    }

    const users = await readUsers();
    if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      return Response.json({ success: false, error: "Email sudah terdaftar" }, { status: 409 });
    }

    const user = {
      id: `u-${Date.now()}`,
      email,
      passwordHash: hashPassword(password),
      name,
      role,
      kelas,
      status: "aktif",
    };
    users.push(user);
    await writeUsers(users);

    return Response.json({ success: true, user: publicUser(user) });
  } catch {
    return Response.json({ success: false, error: "Terjadi kesalahan server" }, { status: 500 });
  }
}