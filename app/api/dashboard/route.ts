import { getSessionUser, json } from "../../../lib/auth";
import { getStore, publicUser } from "../../../lib/store";

/**
 * GET /api/dashboard — data dashboard hanya untuk user yang login (sesi cookie)
 */
export async function GET(request: Request) {
  const session = getSessionUser(request);
  if (!session) {
    return json({ success: false, error: "Tidak diizinkan" }, 401);
  }
  try {
    const store = getStore();
    await store.ensureReady();
    const user = await store.findUserById(session.sub);
    if (!user || user.status === "nonaktif") {
      return json({ success: false, error: "Sesi tidak valid" }, 401);
    }

    const dashboardData = {
      role: user.role,
      user: publicUser(user),
      totalStudents: 32,
      todayAttendance: {
        hadir: 28,
        sakit: 2,
        izin: 1,
        alpha: 3,
      },
      kpi: {
        attendanceRate: "87.5%",
        successRate: "95%",
        pendingLeave: 1,
      },
      recentActivities: [
        {
          id: "1",
          title: "Absensi hari ini",
          description: "28 siswa hadir, 2 sakit, 1 izin",
          time: "07-09-2026",
        },
        {
          id: "2",
          title: "Catatan pembinaan",
          description: "Ahmad Fauzan - Pembinaan langsung",
          time: "07-09-2026",
        },
      ],
    };

    return json({ success: true, data: dashboardData });
  } catch {
    return json({ success: false, error: "Terjadi kesalahan server" }, 500);
  }
}