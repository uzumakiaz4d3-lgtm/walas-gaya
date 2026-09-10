import { readUsers, writeUsers, hashPassword, isAdminRequest } from "../../users-lib";

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return Response.json({ success: false, error: "Tidak diizinkan" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const users = await readUsers();
    const idx = users.findIndex((u: any) => u.id === id);
    if (idx === -1) {
      return Response.json({ success: false, error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    const body = await request.json();
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    if (!email || !name) {
      return Response.json({ success: false, error: "Nama dan email wajib diisi" }, { status: 400 });
    }
    if (email.toLowerCase() !== users[idx].email.toLowerCase() && users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      return Response.json({ success: false, error: "Email sudah terdaftar" }, { status: 409 });
    }

    users[idx].email = email;
    users[idx].name = name;
    users[idx].role = body.role === "admin" ? "admin" : "wali_kelas";
    users[idx].kelas = body.kelas || null;
    if (body.status === "aktif" || body.status === "nonaktif") {
      users[idx].status = body.status;
    }
    if (body.password) {
      users[idx].passwordHash = hashPassword(body.password);
    }
    await writeUsers(users);

    return Response.json({ success: true, user: publicUser(users[idx]) });
  } catch {
    return Response.json({ success: false, error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return Response.json({ success: false, error: "Tidak diizinkan" }, { status: 403 });
  }
  const { id } = await params;
  const users = await readUsers();
  const target = users.find((u: any) => u.id === id);
  if (!target) {
    return Response.json({ success: false, error: "Pengguna tidak ditemukan" }, { status: 404 });
  }
  if (target.role === "admin") {
    return Response.json({ success: false, error: "Akun admin tidak dapat dihapus" }, { status: 400 });
  }
  await writeUsers(users.filter((u: any) => u.id !== id));
  return Response.json({ success: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return Response.json({ success: false, error: "Tidak diizinkan" }, { status: 403 });
  }
  const { id } = await params;
  const users = await readUsers();
  const idx = users.findIndex((u: any) => u.id === id);
  if (idx === -1) {
    return Response.json({ success: false, error: "Pengguna tidak ditemukan" }, { status: 404 });
  }
  users[idx].passwordHash = hashPassword("wali123");
  await writeUsers(users);
  return Response.json({ success: true, message: "Password direset ke wali123" });
}