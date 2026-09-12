import { getStore } from "./store";

export interface AuditEntry {
  waktu: string;
  user: string;
  role: string;
  aksi: string;
  detail: string;
  kelas: string | null;
  sumber: string;
}

const KEY = "audit:log";
const MAX_ENTRIES = 500;

function clip(v: unknown, max: number): string {
  return String(v == null ? "" : v).trim().slice(0, max);
}

function asEntries(v: unknown): AuditEntry[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is AuditEntry => !!e && typeof e === "object");
}

export async function appendAudit(entry: Partial<AuditEntry>): Promise<void> {
  const store = getStore();
  await store.ensureReady();
  const rec = await store.getAppData(KEY);
  const entries = asEntries(rec && rec.data && rec.data.entries);
  entries.push({
    waktu: new Date().toISOString(),
    user: clip(entry.user, 100) || "?",
    role: clip(entry.role, 20) || "wali_kelas",
    aksi: clip(entry.aksi, 60) || "Aksi",
    detail: clip(entry.detail, 300),
    kelas: entry.kelas ? clip(entry.kelas, 40) : null,
    sumber: clip(entry.sumber, 30) || "web",
  });
  const trimmed = entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;
  await store.setAppData(KEY, { entries: trimmed });
}

export async function listAudit(): Promise<AuditEntry[]> {
  const store = getStore();
  await store.ensureReady();
  const rec = await store.getAppData(KEY);
  const entries = asEntries(rec && rec.data && rec.data.entries);
  return entries.sort((a, b) => (a.waktu < b.waktu ? 1 : a.waktu > b.waktu ? -1 : 0));
}