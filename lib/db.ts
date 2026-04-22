/**
 * Postgres connection pool singleton.
 *
 * Reads DATABASE_URL from env.
 * Auto-detects remote Supabase URLs and enables SSL.
 * Shared by the ingestion script and the Vercel serverless function.
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/clinicalhours";

const isRemote =
  DATABASE_URL.includes("supabase.co") ||
  DATABASE_URL.includes("pooler.supabase.com");

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 10,
      ...(isRemote ? { ssl: { rejectUnauthorized: true } } : {}),
    });
  }
  return _pool;
}

/** Check if PostGIS is available (cached per process). */
let _hasPostGIS: boolean | null = null;
export async function hasPostGIS(): Promise<boolean> {
  if (_hasPostGIS !== null) return _hasPostGIS;
  try {
    await getPool().query("SELECT PostGIS_Version()");
    _hasPostGIS = true;
  } catch {
    _hasPostGIS = false;
  }
  return _hasPostGIS;
}
