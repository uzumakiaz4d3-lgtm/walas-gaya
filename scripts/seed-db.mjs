#!/usr/bin/env node
/*
 * Seed database Postgres dengan pengguna awal (data/users.json atau bawaan).
 * Cara pakai:
 *   npm run db:seed                # memakai DATABASE_URL dari env/.env
 *   WK_SEED_PASSWORD="rahasia" npm run db:seed
 */
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error("FAIL: set DATABASE_URL dulu (lihat .env.example)");
  process.exit(1);
}

function readSeedUsers() {
  try {
    const file = path.join(ROOT, "data", "users.json");
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    if (Array.isArray(parsed.users) && parsed.users.length) {
      return parsed.users.map((u) => ({ email: u.email, name: u.name, role: u.role, kelas: u.kelas || null }));
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

const password = process.env.WK_SEED_PASSWORD || "wali123";
const passwordHash = bcrypt.hashSync(password, 10);

const client = new Client({ connectionString: URL });

async function main() {
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'wali_kelas',
    kelas TEXT,
    status TEXT NOT NULL DEFAULT 'aktif'
  )`);

  const seeds = readSeedUsers();
  for (const s of seeds) {
    const email = String(s.email).toLowerCase();
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, kelas, status)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'aktif')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = CASE
           WHEN users.password_hash NOT LIKE '$2%' THEN EXCLUDED.password_hash
           ELSE users.password_hash
         END,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         kelas = EXCLUDED.kelas`,
      [email, passwordHash, s.name, s.role, s.kelas]
    );
    console.log(`OK   seeded: ${email} (${s.role})`);
  }

  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM users`);
  console.log(`Total pengguna di database: ${rows[0].n}`);
  console.log(`Password awal pengguna: ${password} (satu-satunya yang dilewati upsert = yang sudah bcrypt)`);
  await client.end();
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});