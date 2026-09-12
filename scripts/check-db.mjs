#!/usr/bin/env node
/*
 * Verifikasi koneksi database + seed pengguna awal.
 *
 * Membaca .env (Next.js format / KEY=VALUE), lalu:
 * 1. Tes koneksi pg ke DATABASE_URL (transaction pooler Supabase / Neon).
 * 2. Buat tabel `users` jika belum ada.
 * 3. Seed 5 pengguna default (bcrypt, password wali123) jika tabel kosong
 *    atau hash lama masih SHA-256 (bukan prefix $2).
 * 4. Cetak daftar email + role (tanpa hash/password).
 *
 * Jalankan: npm run db:check
 */
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  for (const envFile of [path.join(ROOT, ".env"), path.join(ROOT, ".env.local")]) {
    if (!existsSync(envFile)) continue;
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
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
}

function readSeedUsers() {
  try {
    const file = path.join(ROOT, "data", "users.json");
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    if (Array.isArray(parsed.users) && parsed.users.length) {
      return parsed.users.map((u) => ({
        email: String(u.email || "").toLowerCase(),
        name: String(u.name || ""),
        role: u.role === "admin" ? "admin" : "wali_kelas",
        kelas: u.kelas || null,
      }));
    }
  } catch {
    /* fallback ke bawaan */
  }
  return [
    { email: "admin@sekolah.id", name: "Admin Sekolah", role: "admin", kelas: null },
    { email: "ahmad@walikelas.sch.id", name: "Ahmad Fauzan", role: "wali_kelas", kelas: "7A" },
    { email: "siti@walikelas.sch.id", name: "Siti Aminah", role: "wali_kelas", kelas: "7B" },
    { email: "budi@walikelas.sch.id", name: "Budi Santoso", role: "wali_kelas", kelas: "8A" },
    { email: "dewi@walikelas.sch.id", name: "Dewi Lestari", role: "wali_kelas", kelas: "8B" },
  ];
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("FAIL: DATABASE_URL tidak ditemukan di .env");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log("OK   koneksi: DATABASE_URL terhubung");

  await client.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'wali_kelas',
    kelas TEXT,
    status TEXT NOT NULL DEFAULT 'aktif'
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS walas (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    nip TEXT,
    no_telp TEXT,
    status TEXT NOT NULL DEFAULT 'aktif'
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS rombel (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aktif'
  )`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS rombel_nama_lower ON rombel (LOWER(nama))`);
  console.log("OK   skema: tabel users, walas, dan rombel siap");

  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM users`);
  const count = rows[0].n;
  const password = process.env.WK_SEED_PASSWORD || "wali123";
  const passwordHash = bcrypt.hashSync(password, 10);

  if (count === 0) {
    for (const s of readSeedUsers()) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, kelas, status)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'aktif')`,
        [s.email, passwordHash, s.name, s.role, s.kelas]
      );
      console.log(`OK   seed: ${s.email} (${s.role})`);
    }
    console.log(`     Password awal semua pengguna: ${password}`);
  } else {
    console.log(`SKIP seed: tabel sudah berisi ${count} pengguna.`);
  }

  const { rows: all } = await client.query(
    `SELECT email, name, role, kelas, status,
            (password_hash LIKE '$2%') AS hashed_bcrypt
       FROM users ORDER BY role DESC, name ASC`
  );
  console.log(`Rekap ${all.length} pengguna:`);
  for (const u of all) {
    const mark = u.hashed_bcrypt ? "[bcrypt]" : "[!! SHA-256 — segera direset]";
    console.log(`  - ${u.email} | ${u.name} | ${u.role} | kelas=${u.kelas || "-"} | ${u.status} | ${mark}`);
  }

  const oldHash = all.filter((u) => !u.hashed_bcrypt);
  if (oldHash.length) {
    console.log("Catatan: ada pengguna dengan hash lama. Jalankan `npm run db:seed` untuk mengupgrade, atau reset password via halaman Pengguna.");
  }

  await client.end();
  console.log("\nVERIFIKASI DATABASE SELESAI");
  process.exit(oldHash.length ? 1 : 0);
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});