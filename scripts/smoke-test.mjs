#!/usr/bin/env node
/*
 * Smoke test untuk WaliKelas App.
 * 1. Verifikasi environment variables terbaca (dari process env atau file .env).
 * 2. Boot server produksi (next start) dalam MODE MEMORY (tanpa database) dan
 *    uji endpoint penting: login, sesi cookie, guard admin, CRUD pengguna.
 * Exits non-zero jika ada kegagalan sehingga `npm test` / `docker build` gagal tegas.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.SMOKE_PORT || 3105);
const BASE = `http://127.0.0.1:${PORT}`;

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_APP_URL",
];

const DEFAULTS = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/walikelas?schema=public",
  AUTH_SECRET: "change-this-secret-key",
  NEXT_PUBLIC_APP_NAME: "WaliKelas",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

function loadEnvFile() {
  const envFile = path.join(ROOT, ".env");
  if (!existsSync(envFile)) return { loaded: false, values: {} };
  const values = {};
  for (const line of readFileSync(envFile, "utf-8").split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const eq = clean.indexOf("=");
    if (eq === -1) continue;
    let key = clean.slice(0, eq).trim();
    let val = clean.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) values[key] = val;
  }
  return { loaded: true, values };
}

function ensureEnv() {
  const { loaded, values } = loadEnvFile();
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      process.env[key] = values[key] || DEFAULTS[key] || "";
    }
  }
  const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k].length === 0);
  if (missing.length) {
    console.error(`FAIL env: variabel berikut kosong/tidak terbaca: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`OK   env: file .env ${loaded ? "ditemukan & dibaca" : "tidak ada (pakai default/build-arg di Docker)"}`);
  for (const key of REQUIRED) {
    const shown = key.startsWith("NEXT_PUBLIC") || key === "AUTH_SECRET"
      ? process.env[key]
      : "[set]";
    console.log(`     ${key}=${shown}`);
  }
  if (!process.env.WK_DATA_MODE) process.env.WK_DATA_MODE = "memory";
  console.log(`     WK_DATA_MODE=${process.env.WK_DATA_MODE} (tes memakai memory store, tanpa DB)`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function untilReady(url, tries, delay) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.redirected) return true;
    } catch {}
    await sleep(delay);
  }
  return false;
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log(`PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

const COOKIES = {};
function pullCookies(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of set) {
    const eq = sc.indexOf("=");
    if (eq === -1) continue;
    const key = sc.slice(0, eq).trim();
    const val = sc.slice(eq + 1).split(";")[0].trim();
    COOKIES[key] = val;
  }
}
function cookieHeader() {
  return Object.keys(COOKIES)
    .map((k) => `${k}=${COOKIES[k]}`)
    .join("; ");
}

async function api(pathname, options) {
  const headers = { "Content-Type": "application/json", ...(options && options.headers) };
  return fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    ...options,
    headers,
  });
}

async function login(email, password) {
  const res = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  pullCookies(res);
  return res;
}

async function main() {
  ensureEnv();
  const built = existsSync(path.join(ROOT, ".next", "BUILD_ID"));
  if (!built) {
    console.error("FAIL build: artefak .next/BUILD_ID tidak ada. Jalankan `npm run build` dulu!");
    process.exit(1);
  }
  console.log("OK   build: artefak .next ditemukan");

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const isWin = process.platform === "win32";
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: isWin,
  });
  if (isWin) child.unref();

  const logLines = [];
  child.stderr.on("data", (d) => logLines.push(String(d)));
  child.stdout.on("data", (d) => logLines.push(String(d)));

  let up = false;
  try {
    up = await untilReady(`${BASE}/api/auth/status`, 60, 500);
  } finally {
    if (!up) {
      console.error("FAIL server: tidak bisa boot dalam 30 detik. Log server:");
      console.error(logLines.join(""));
    }
  }

  if (up) {
    console.log("OK   server: berhasil boot di " + BASE);
    check("env NEXT_PUBLIC_APP_NAME terbaca", process.env.NEXT_PUBLIC_APP_NAME === "WaliKelas");

    let res = await api("/");
    check(
      "GET / redirect ke /src/login.html",
      (res.status === 302 || res.status === 307) &&
        res.headers.get("location") === "/src/login.html",
      `status=${res.status}`
    );

    res = await api("/api/auth/status");
    const stNo = await res.json().catch(() => ({}));
    check("auth/status tanpa cookie loggedIn=false", res.status === 200 && stNo.loggedIn === false);

    res = await login("admin@sekolah.id", "wali123");
    const loginAdmin = await res.json().catch(() => ({}));
    check(
      "login admin sukses (cookie terpasang)",
      res.status === 200 && loginAdmin.success === true && loginAdmin.user.role === "admin",
      `status=${res.status} cookies=${Object.keys(COOKIES).length}`
    );

    res = await login("admin@sekolah.id", "salah123");
    check("login password salah ditolak", res.status === 401, `status=${res.status}`);

    res = await login("ahmad@walikelas.sch.id", "wali123");
    const loginWali = await res.json().catch(() => ({}));
    check(
      "login wali_kelas sukses",
      res.status === 200 && loginWali.success === true && loginWali.user.role === "wali_kelas",
      `status=${res.status}`
    );

    res = await api("/api/auth/status", { headers: { cookie: cookieHeader() } });
    const stWali = await res.json().catch(() => ({}));
    check(
      "auth/status dengan cookie wali → loggedIn=true role wali_kelas",
      res.status === 200 && stWali.loggedIn === true && stWali.user.role === "wali_kelas",
      `status=${res.status}`
    );

    /* ---- Sync data kelas & settings ---- */
    res = await api("/api/kelas-data?kelas=7A", { headers: { cookie: cookieHeader() } });
    let sync0 = await res.json().catch(() => ({}));
    check(
      "GET /api/kelas-data 7A (wali) sukses & masih kosong",
      res.status === 200 && sync0.success === true && Object.keys(sync0.data || {}).length === 0,
      `status=${res.status}`
    );

    res = await api("/api/kelas-data", {
      method: "PUT",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ kelas: "7A", key: "siswa", value: [{ nis: "001", nama: "Tes Sync", jk: "L", status: "Aktif", hp: "08123456789" }] }),
    });
    const putSync = await res.json().catch(() => ({}));
    check(
      "PUT /api/kelas-data 7A (wali) key=siswa sukses",
      res.status === 200 && putSync.success === true,
      `status=${res.status}`
    );

    res = await api("/api/kelas-data?kelas=7A", { headers: { cookie: cookieHeader() } });
    const sync1 = await res.json().catch(() => ({}));
    check(
      "GET /api/kelas-data 7A kembali berisi data siswa",
      res.status === 200 && sync1.success === true &&
        Array.isArray(sync1.data.siswa) && sync1.data.siswa[0].nama === "Tes Sync",
      `status=${res.status}`
    );

    res = await api("/api/kelas-data?kelas=8B", { headers: { cookie: cookieHeader() } });
    check("GET /api/kelas-data kelas lain (8B) oleh walas 7A ditolak 403", res.status === 403, `status=${res.status}`);
    res = await api("/api/kelas-data", {
      method: "PUT",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ kelas: "8B", key: "siswa", value: [] }),
    });
    check("PUT /api/kelas-data kelas lain (8B) oleh walas 7A ditolak 403", res.status === 403, `status=${res.status}`);

    res = await api("/api/settings", {
      method: "PUT",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ data: { sekolah: "SMP Uji" } }),
    });
    check("PUT /api/settings oleh walas ditolak 403", res.status === 403, `status=${res.status}`);

    res = await login("admin@sekolah.id", "wali123");
    res = await api("/api/settings", {
      method: "PUT",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ data: { sekolah: "SMP Negeri 1 Uji", npsn: "12345678", kepala: "Kepala Uji", tahun: "2026/2027" } }),
    });
    const setPut = await res.json().catch(() => ({}));
    check(
      "PUT /api/settings oleh admin sukses",
      res.status === 200 && setPut.success === true,
      `status=${res.status}`
    );

    res = await login("ahmad@walikelas.sch.id", "wali123");
    res = await api("/api/settings", { headers: { cookie: cookieHeader() } });
    const setGet = await res.json().catch(() => ({}));
    check(
      "GET /api/settings oleh walas terbaca",
      res.status === 200 && setGet.success === true && setGet.data.sekolah === "SMP Negeri 1 Uji",
      `status=${res.status} sekolah=${setGet.data && setGet.data.sekolah}`
    );
    res = await api("/api/kelas-data?kelas=7A", { headers: { cookie: cookieHeader() } });
    const syncAdmin = await res.json().catch(() => ({}));
    check(
      "GET /api/kelas-data 7A oleh admin diperbolehkan",
      res.status === 200 && syncAdmin.success === true && Array.isArray(syncAdmin.data.siswa),
      `status=${res.status}`
    );

    res = await api("/api/audit", {
      method: "POST",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ aksi: "Simpan absensi", detail: "Absensi tanggal 2026-09-11", kelas: "7A" }),
    });
    const auditPost = await res.json().catch(() => ({}));
    check(
      "POST /api/audit (wali_kelas) mencatat aktivitas",
      res.status === 200 && auditPost.success === true,
      `status=${res.status}`
    );

    res = await api("/api/audit", { headers: { cookie: cookieHeader() } });
    check("GET /api/audit (wali_kelas) ditolak 403", res.status === 403, `status=${res.status}`);

    res = await api("/api/users");
    check("GET /api/users tanpa cookie ditolak (401)", res.status === 401, `status=${res.status}`);

    const tampered = `${COOKIES[Object.keys(COOKIES)[0]] || ""}tampered`;
    res = await api("/api/users", { headers: { cookie: `${Object.keys(COOKIES)[0]}=${tampered}` } });
    check("cookie yang diubah-ubah ditolak (401)", res.status === 401, `status=${res.status}`);

    res = await api("/api/users", { headers: { cookie: cookieHeader() } });
    const usersWali = await res.json().catch(() => ({}));
    check(
      "GET /api/users (wali_kelas) ditolak 403",
      res.status === 403 && usersWali.success === false,
      `status=${res.status}`
    );

    res = await login("admin@sekolah.id", "wali123");
    res = await api("/api/users", { headers: { cookie: cookieHeader() } });
    const usersAdmin = await res.json().catch(() => ({}));
    check(
      "GET /api/users (admin) sukses — 5 pengguna default",
      res.status === 200 && usersAdmin.success === true && usersAdmin.users.length === 5,
      `status=${res.status} users=${usersAdmin.users && usersAdmin.users.length}`
    );

    res = await api("/api/audit", { headers: { cookie: cookieHeader() } });
    const auditAdmin = await res.json().catch(() => ({}));
    check(
      "GET /api/audit (admin) berisi aktivitas yang dicatat",
      res.status === 200 &&
        auditAdmin.success === true &&
        Array.isArray(auditAdmin.entries) &&
        auditAdmin.entries.length > 0 &&
        auditAdmin.entries.some((e) => e.aksi === "Simpan absensi" && e.kelas === "7A") &&
        auditAdmin.entries.some((e) => e.aksi === "Login"),
      `status=${res.status} n=${auditAdmin.entries && auditAdmin.entries.length}`
    );

    res = await api("/api/users", {
      method: "POST",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ email: "test@sekolah.id", name: "User Tes", password: "rahasiagakil" }),
    });
    const created = await res.json().catch(() => ({}));
    check(
      "POST /api/users (admin) membuat pengguna",
      res.status === 200 && created.success === true && created.user.role === "wali_kelas",
      `status=${res.status}`
    );

    res = await login("test@sekolah.id", "rahasiagakil");
    const loginNew = await res.json().catch(() => ({}));
    check(
      "login pengguna baru berhasil",
      res.status === 200 && loginNew.success === true,
      `status=${res.status}`
    );

    res = await api("/api/walas", { headers: { cookie: cookieHeader() } });
    check(
      "GET /api/walas (wali_kelas) ditolak 403",
      res.status === 403,
      `status=${res.status}`
    );
    res = await api("/api/rombel", { headers: { cookie: cookieHeader() } });
    check(
      "GET /api/rombel (wali_kelas) ditolak 403",
      res.status === 403,
      `status=${res.status}`
    );

    res = await login("admin@sekolah.id", "wali123");
    res = await api("/api/users/" + encodeURIComponent(created.user.id), {
      method: "DELETE",
      headers: { cookie: cookieHeader() },
    });
    const del = await res.json().catch(() => ({}));
    check("DELETE /api/users/:id (admin) sukses", res.status === 200 && del.success === true, `status=${res.status}`);

    res = await api("/api/walas", {
      method: "POST",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ nama: "Guru Uji", nip: "198001012000001" }),
    });
    const walasCreated = await res.json().catch(() => ({}));
    check(
      "POST /api/walas (admin) membuat profil walas",
      res.status === 200 && walasCreated.success === true && walasCreated.walas.nama === "Guru Uji",
      `status=${res.status}`
    );

    res = await api("/api/rombel", {
      method: "POST",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ nama: "7-1" }),
    });
    const rombelCreated = await res.json().catch(() => ({}));
    check(
      "POST /api/rombel (admin) membuat rombel manual",
      res.status === 200 && rombelCreated.success === true && rombelCreated.rombel.nama === "7-1",
      `status=${res.status}`
    );

    res = await api("/api/rombel", {
      method: "POST",
      headers: { cookie: cookieHeader() },
      body: JSON.stringify({ nama: "7-1" }),
    });
    check(
      "POST /api/rombel duplikat ditolak 409",
      res.status === 409,
      `status=${res.status}`
    );

    res = await api("/api/walas", { headers: { cookie: cookieHeader() } });
    const walasList = await res.json().catch(() => ({}));
    res = await api("/api/rombel", { headers: { cookie: cookieHeader() } });
    const rombelList = await res.json().catch(() => ({}));
    check(
      "GET /api/walas (admin) berisi profil yang dibuat",
      res.status === 200 &&
        (walasList.walas || []).some((w) => w.nama === "Guru Uji" && w.nip === "198001012000001"),
      `status=${res.status} walas=${walasList.walas && walasList.walas.length}`
    );
    check(
      "GET /api/rombel (admin) berisi rombel yang dibuat",
      (rombelList.rombel || []).some((r) => r.nama === "7-1"),
      `rombel=${rombelList.rombel && rombelList.rombel.length}`
    );

    res = await api("/api/reset", {
      method: "POST",
      headers: { cookie: cookieHeader() },
    });
    const rst = await res.json().catch(() => ({}));
    check(
      "POST /api/reset (admin) → reset, hanya admin yang tersisa (1 user)",
      res.status === 200 && rst.success === true && rst.reset === true && rst.users === 1,
      `status=${res.status} users=${rst.users}`
    );
    res = await login("ahmad@walikelas.sch.id", "wali123");
    check(
      "login walas setelah reset ditolak (akun walas terhapus)",
      res.status === 401,
      `status=${res.status}`
    );
    res = await login("admin@sekolah.id", "wali123");
    check(
      "login admin setelah reset masih jalan",
      res.status === 200,
      `status=${res.status}`
    );
    res = await api("/api/users", { headers: { cookie: cookieHeader() } });
    const usersAfterReset = await res.json().catch(() => ({}));
    check(
      "GET /api/users setelah reset → hanya admin",
      res.status === 200 && usersAfterReset.success === true && usersAfterReset.users.length === 1 && usersAfterReset.users[0].role === "admin",
      `status=${res.status} users=${usersAfterReset.users && usersAfterReset.users.length}`
    );
    res = await api("/api/walas", { headers: { cookie: cookieHeader() } });
    const walasAfterReset = await res.json().catch(() => ({}));
    res = await api("/api/rombel", { headers: { cookie: cookieHeader() } });
    const rombelAfterReset = await res.json().catch(() => ({}));
    check(
      "GET /api/walas setelah reset → kosong",
      res.status === 200 && (walasAfterReset.walas || []).length === 0,
      `status=${res.status} walas=${walasAfterReset.walas && walasAfterReset.walas.length}`
    );
    check(
      "GET /api/rombel setelah reset → kosong",
      res.status === 200 && (rombelAfterReset.rombel || []).length === 0,
      `status=${res.status} rombel=${rombelAfterReset.rombel && rombelAfterReset.rombel.length}`
    );

    res = await api("/api/dashboard", { headers: { cookie: cookieHeader() } });
    const dash = await res.json().catch(() => ({}));
    check(
      "GET /api/dashboard (sesi) sukses",
      res.status === 200 && dash.success === true && dash.data.role === "admin",
      `status=${res.status}`
    );

    res = await api("/api/settings", { headers: { cookie: cookieHeader() } });
    const setReset = await res.json().catch(() => ({}));
    check(
      "GET /api/settings setelah reset → kosong",
      res.status === 200 && setReset.success === true && Object.keys(setReset.data || {}).length === 0,
      `status=${res.status}`
    );
    res = await api("/api/kelas-data?kelas=7A", { headers: { cookie: cookieHeader() } });
    const kdReset = await res.json().catch(() => ({}));
    check(
      "GET /api/kelas-data 7A setelah reset → kosong",
      res.status === 200 && kdReset.success === true && Object.keys(kdReset.data || {}).length === 0,
      `status=${res.status}`
    );
  }

  try {
    if (isWin) {
      try {
        child.stdout.destroy();
        child.stderr.destroy();
      } catch {}
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
      } catch {}
    } else {
      await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        child.once("exit", done);
        try {
          child.kill();
        } catch {
          done();
        }
        setTimeout(() => {
          try {
            child.kill();
          } catch {}
        }, 200);
        setTimeout(done, 3000);
      });
    }
  } catch {}

  console.log(failures === 0 ? "\nSEMUA TES LULUS" : `\n${failures} TES GAGAL`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});