/**
 * API Route: GET /api/dashboard
 * Mengambil data dashboard untuk user yang login
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "wali_kelas";

    // Data dashboard dummy (akan diganti dengan query database nanti)
    const dashboardData = {
      role,
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
          description: "28 siswa hadir, 2 sakit, 1izin",
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

    return new Response(
      JSON.stringify({
        success: true,
        data: dashboardData,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}