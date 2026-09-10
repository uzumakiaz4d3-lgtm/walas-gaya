import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

async function getUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw).users || [];
  } catch {
    return [];
  }
}

function hashPassword(pwd: string) {
  return createHash("sha256").update(String(pwd)).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const users = await getUsers();
    const user = users.find(
      (u: any) => u.email.toLowerCase() === String(email || "").trim().toLowerCase()
    );

    if (user && user.passwordHash === hashPassword(password) && user.status !== "nonaktif") {
      return Response.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          kelas: user.kelas || null,
        },
        redirect: user.role === "admin" ? "/src/admin/admin.html" : "/src/dashboard/dashboard.html",
      });
    }

    return Response.json(
      { success: false, error: "Email atau kata sandi salah" },
      { status: 401 }
    );
  } catch {
    return Response.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}