import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export type Role = "admin" | "wali_kelas";
export type UserStatus = "aktif" | "nonaktif";

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  kelas: string | null;
  status: UserStatus;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: Role;
  kelas: string | null;
  status: UserStatus;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  kelas: string | null;
  status: UserStatus;
}

export interface Store {
  ensureReady(): Promise<void>;
  listUsers(): Promise<UserRow[]>;
  findUserByEmail(email: string): Promise<UserRow | null>;
  findUserById(id: string): Promise<UserRow | null>;
  createUser(data: NewUser): Promise<UserRow>;
  updateUser(id: string, patch: Partial<UserRow>): Promise<UserRow | null>;
  deleteUser(id: string): Promise<boolean>;
  resetAll(): Promise<void>;
  close(): Promise<void>;
}

export function publicUser(u: UserRow): UserPublic {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    kelas: u.kelas,
    status: u.status,
  };
}

function uid(): string {
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface SeedUser {
  email: string;
  name: string;
  role: Role;
  kelas?: string | null;
}

async function readSeedUsers(): Promise<SeedUser[]> {
  const file = path.join(process.cwd(), "data", "users.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.users)) {
      return parsed.users.map((u: any) => ({
        email: String(u.email || ""),
        name: String(u.name || ""),
        role: u.role === "admin" ? "admin" : "wali_kelas",
        kelas: u.kelas || null,
      }));
    }
  } catch {
    /* file tidak ada — pakai daftar bawaan */
  }
  return [
    { email: "admin@sekolah.id", name: "Admin Sekolah", role: "admin", kelas: null },
    { email: "ahmad@walikelas.sch.id", name: "Ahmad Fauzan", role: "wali_kelas", kelas: "7A" },
    { email: "siti@walikelas.sch.id", name: "Siti Aminah", role: "wali_kelas", kelas: "7B" },
    { email: "budi@walikelas.sch.id", name: "Budi Santoso", role: "wali_kelas", kelas: "8A" },
    { email: "dewi@walikelas.sch.id", name: "Dewi Lestari", role: "wali_kelas", kelas: "8B" },
  ];
}

const DEFAULT_PASSWORD = "wali123";

function hashSync(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

async function seedAdmin(store: Store): Promise<void> {
  if (await store.findUserByEmail("admin@sekolah.id")) return;
  await store.createUser({
    email: "admin@sekolah.id",
    passwordHash: hashSync(DEFAULT_PASSWORD),
    name: "Admin Sekolah",
    role: "admin",
    kelas: null,
    status: "aktif",
  });
}

async function seedDefaults(store: Store): Promise<void> {
  const existing = await store.listUsers();
  if (existing.length > 0) return;
  const seeds = await readSeedUsers();
  for (const s of seeds) {
    await store.createUser({
      email: s.email.toLowerCase(),
      passwordHash: hashSync(DEFAULT_PASSWORD),
      name: s.name,
      role: s.role,
      kelas: s.kelas ?? null,
      status: "aktif",
    });
  }
}

/* ============================ MEMORY ============================ */

class MemoryStore implements Store {
  private rows = new Map<string, UserRow>();
  private ready = false;

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    this.ready = true;
    await seedDefaults(this);
  }

  async listUsers(): Promise<UserRow[]> {
    return Array.from(this.rows.values());
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const e = String(email || "").toLowerCase();
    for (const u of this.rows.values()) {
      if (u.email.toLowerCase() === e) return u;
    }
    return null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    return this.rows.get(id) || null;
  }

  async createUser(data: NewUser): Promise<UserRow> {
    const row: UserRow = {
      id: uid(),
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash || hashSync(DEFAULT_PASSWORD),
      name: data.name,
      role: data.role,
      kelas: data.kelas,
      status: data.status || "aktif",
    };
    this.rows.set(row.id, row);
    return row;
  }

  async updateUser(id: string, patch: Partial<UserRow>): Promise<UserRow | null> {
    const cur = this.rows.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    this.rows.set(id, next);
    return next;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async resetAll(): Promise<void> {
    this.rows.clear();
    await seedAdmin(this);
  }

  async close(): Promise<void> {
    this.rows.clear();
  }
}

/* ============================ POSTGRES ============================ */

const { Pool } = require("pg") as typeof import("pg");

class PostgresStore implements Store {
  private pool: import("pg").Pool;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.ensureSchema().then(async () => {
        await seedDefaults(this);
      });
    }
    return this.ready;
  }

  private async ensureSchema(): Promise<void> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'wali_kelas',
      kelas TEXT,
      status TEXT NOT NULL DEFAULT 'aktif'
    )`);
  }

  private rowToUser(r: any): UserRow {
    return {
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      name: r.name,
      role: r.role,
      kelas: r.kelas,
      status: r.status,
    };
  }

  async listUsers(): Promise<UserRow[]> {
    const res = await this.pool.query(`SELECT id, email, password_hash, name, role, kelas, status FROM users ORDER BY name ASC`);
    return res.rows.map((r) => this.rowToUser(r));
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const res = await this.pool.query(
      `SELECT id, email, password_hash, name, role, kelas, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [String(email || "")]
    );
    return res.rows.length ? this.rowToUser(res.rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const res = await this.pool.query(
      `SELECT id, email, password_hash, name, role, kelas, status FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows.length ? this.rowToUser(res.rows[0]) : null;
  }

  async createUser(data: NewUser): Promise<UserRow> {
    const id = uid();
    const res = await this.pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, kelas, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, password_hash, name, role, kelas, status`,
      [
        id,
        data.email.toLowerCase(),
        data.passwordHash || hashSync(DEFAULT_PASSWORD),
        data.name,
        data.role,
        data.kelas,
        data.status || "aktif",
      ]
    );
    return this.rowToUser(res.rows[0]);
  }

  async updateUser(id: string, patch: Partial<UserRow>): Promise<UserRow | null> {
    const cur = await this.findUserById(id);
    if (!cur) return null;
    const next: UserRow = { ...cur, ...patch };
    if (patch.email) next.email = patch.email.toLowerCase();
    await this.pool.query(
      `UPDATE users SET email=$1, password_hash=$2, name=$3, role=$4, kelas=$5, status=$6 WHERE id=$7`,
      [next.email, next.passwordHash, next.name, next.role, next.kelas, next.status, id]
    );
    return next;
  }

  async deleteUser(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    return (res.rowCount || 0) > 0;
  }

  async resetAll(): Promise<void> {
    await this.pool.query(`DELETE FROM users`);
    await seedAdmin(this);
  }

  async close(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}

/* ============================ SHARED ============================ */

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const mode = (process.env.WK_DATA_MODE || "postgres").toLowerCase();
  if (mode === "memory") {
    cached = new MemoryStore();
  } else {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL belum di-set. Set variabel env dulu (lihat .env.example).");
    }
    cached = new PostgresStore(url);
  }
  return cached;
}