/**
 * localStorage-backed data store for premium features.
 * Used for local testing before DB migration is applied.
 * Each "table" is a JSON array stored under a key.
 */

function generateId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getTable<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setTable<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded, etc */ }
}

// ─── Generic CRUD ──────────────────────────────────────────────────────────

export function localInsert<T extends { id?: string }>(table: string, row: T): T & { id: string } {
  const rows = getTable<T & { id: string }>(table);
  const newRow = { ...row, id: row.id || generateId(), created_at: new Date().toISOString() } as T & { id: string };
  rows.unshift(newRow);
  setTable(table, rows);
  return newRow;
}

export function localSelect<T extends { id: string }>(table: string): T[] {
  return getTable<T>(table);
}

export function localSelectById<T extends { id: string }>(table: string, id: string): T | null {
  return getTable<T>(table).find((r) => r.id === id) || null;
}

export function localUpdate<T extends { id: string }>(table: string, id: string, updates: Partial<T>): T | null {
  const rows = getTable<T>(table);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...updates, updated_at: new Date().toISOString() } as T;
  setTable(table, rows);
  return rows[idx];
}

export function localDelete(table: string, id: string): boolean {
  const rows = getTable<{ id: string }>(table);
  const filtered = rows.filter((r) => r.id !== id);
  if (filtered.length === rows.length) return false;
  setTable(table, filtered);
  return true;
}

// ─── Table keys ────────────────────────────────────────────────────────────

export const TABLES = {
  ACTIVITY_LOGS: "ch_activity_logs",
  REFLECTIONS: "ch_reflections",
  AMCAS_DRAFTS: "ch_amcas_drafts",
  LOR_CONTACTS: "ch_lor_contacts",
  QUIZ_RESPONSES: "ch_quiz_responses",
  QUIZ_MATCHES: "ch_quiz_matches",
} as const;
