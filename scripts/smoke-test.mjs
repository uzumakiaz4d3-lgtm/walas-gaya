#!/usr/bin/env node
/*
 * Smoke test for WaliKelas App.
 * 1. Verifies environment variables are readable (from process env or .env file).
 * 2. Boots the production server (next start) and probes key endpoints.
 * Exits non-zero on any failure so `npm test` and `docker build` fail loudly.
 *
 * Safe to run against a locally built app (npm run build) or inside a Docker
 * builder stage. A missing .env file is NOT an error here: Docker Compose /
 * runtime provides the variables. A malformed or non-empty-but-broken env IS.
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
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_APP_URL",
];

const DEFAULTS = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/walikelas?schema=public",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/walikelas?schema=public",
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

async function api(pathname, options) {
  return fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    ...options,
    headers: { "Content-Type": "application/json", ...(options && options.headers) },
  });
}

async function main() {
  ensureEnv();
  const required = ["build", "next build"];
  const built = existsSync(path.join(ROOT, ".next", "BUILD_ID"));
  if (!built) {
    console.error(
      `FAIL build: .next/BUILD_ID tidak ada. Jalankan ${required.join(" ")} sebelum ${required.slice(1).join(" ") === "next build" ? "npm test" : ""}!`
    );
    process.exit(1);
  }
  console.log("OK   build: artefak .next ditemukan");

  const nextBin = path.join(
    ROOT,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );
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
    const checks = {
      "env NEXT_PUBLIC_APP_NAME terbaca": () =>
        process.env.NEXT_PUBLIC_APP_NAME === "WaliKelas",
    };
    for (const [name, fn] of Object.entries(checks)) check(name, fn());

    let res = await api("/");
    check(
      "GET / redirect ke /src/login.html",
      (res.status === 302 || res.status === 307) &&
        res.headers.get("location") === "/src/login.html",
      `status=${res.status}`
    );

    res = await api("/api/auth/status");
    const statusJson = await res.json().catch(() => ({}));
    check("GET /api/auth/status 200", res.status === 200, `status=${res.status}`);
    check("auth status loggedIn=false", statusJson.loggedIn === false);

    res = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sekolah.id", password: "wali123" }),
    });
    const loginJson = await res.json().catch(() => ({}));
    check("POST /api/login admin berhasil", res.status === 200 && loginJson.success === true && loginJson.user.role === "admin", `status=${res.status}`);

    res = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sekolah.id", password: "salah123" }),
    });
    check("POST /api/login password salah ditolak", res.status === 401, `status=${res.status}`);

    res = await api("/api/users", { headers: { "x-user-role": "wali_kelas" } });
    check("GET /api/users non-admin ditolak", res.status === 403, `status=${res.status}`);

    res = await api("/api/users", { headers: { "x-user-role": "admin" } });
    const usersJson = await res.json().catch(() => ({}));
    check("GET /api/users admin sukses", res.status === 200 && usersJson.success === true && Array.isArray(usersJson.users), `status=${res.status}`);
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