/**
 * OpenDataSoft US-Hospitals API Client
 *
 * Dataset: us-hospitals
 * Docs: https://help.opendatasoft.com/apis/ods-search-v1/
 *
 * The ODS Search v1 API returns JSON shaped like:
 *   { nhits: number, parameters: {...}, records: ODSRecord[] }
 *
 * Each record has:
 *   - recordid   – stable hash (use as dedup key)
 *   - fields     – all column data
 *   - geometry   – GeoJSON Point { type, coordinates: [lon, lat] }
 */

const BASE_URL =
  "https://discovery.opendatasoft.com/api/records/1.0/search/";
const DATASET = "us-hospitals";
const MAX_RETRIES = 3;
const INITIAL_RETRY_MS = 1_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ODSGeometry {
  type: string;
  coordinates: [number, number]; // [lon, lat]
}

/** Every known field in the us-hospitals dataset. */
export interface ODSHospitalFields {
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  zip4: string;
  telephone: string;
  type: string;
  owner: string;
  beds: number;
  trauma: string;
  helipad: string;
  county: string;
  status: string;
  website: string;
  naics_code: string;
  naics_desc: string;
  population: number;
  ttl_staff: number;
  source: string;
  alt_name: string;
  country: string;
  id: string;
  fid: number;
  st_fips: number;
  countyfips: string;
  state_id: string;
  val_method: string;
  val_date: string;
  source_dat: string;
  date_creat: string;
  geo_point: [number, number]; // [lat, lon]
  geo_shape: ODSGeometry;
  [key: string]: unknown; // future-proof
}

export interface ODSRecord {
  datasetid: string;
  recordid: string;
  fields: ODSHospitalFields;
  geometry: ODSGeometry;
  record_timestamp: string;
}

export interface ODSResponse {
  nhits: number;
  parameters: Record<string, unknown>;
  records: ODSRecord[];
}

// ─── Param interfaces ─────────────────────────────────────────────────────────

export interface SearchParams {
  q?: string;
  state?: string;
  city?: string;
  rows?: number;
  start?: number;
}

export interface NearbyParams {
  lat: number;
  lon: number;
  radiusMeters: number;
  q?: string;
  rows?: number;
  start?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildURL(params: Record<string, string | number | undefined>): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("dataset", DATASET);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchWithRetry(url: string): Promise<ODSResponse> {
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);

      // Retry on transient server errors or rate-limiting
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`ODS API ${res.status} ${res.statusText}`);
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_MS * 2 ** (attempt - 1);
          console.warn(
            `  [odsClient] attempt ${attempt}/${MAX_RETRIES} → ${res.status}, retrying in ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        throw new Error(`ODS API error: ${res.status} ${res.statusText}`);
      }

      return (await res.json()) as ODSResponse;
    } catch (err) {
      lastErr = err as Error;
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_MS * 2 ** (attempt - 1);
        console.warn(
          `  [odsClient] attempt ${attempt}/${MAX_RETRIES} → ${lastErr.message}, retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastErr ?? new Error("fetchWithRetry: unknown failure");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full-text + filter search.
 *
 * @param q     - Full-text query (matches all text fields)
 * @param state - Exact state code filter, e.g. "TX"
 * @param city  - Exact city name filter
 * @param rows  - Page size, 1-100 (ODS hard max)
 * @param start - Offset for pagination
 */
export async function searchHospitals(
  params: SearchParams = {},
): Promise<ODSResponse> {
  const { q, state, city, rows = 100, start = 0 } = params;

  if (rows < 1 || rows > 100) {
    throw new RangeError("rows must be between 1 and 100");
  }
  if (start < 0) {
    throw new RangeError("start must be >= 0");
  }

  const urlParams: Record<string, string | number | undefined> = {
    rows,
    start,
    q,
    "refine.state": state,
    "refine.city": city,
  };

  return fetchWithRetry(buildURL(urlParams));
}

/**
 * Geospatial proximity search.
 *
 * @param lat          - Center latitude
 * @param lon          - Center longitude
 * @param radiusMeters - Search radius in meters
 */
export async function nearbyHospitals(
  params: NearbyParams,
): Promise<ODSResponse> {
  const { lat, lon, radiusMeters, q, rows = 100, start = 0 } = params;

  if (lat < -90 || lat > 90) throw new RangeError("lat must be -90..90");
  if (lon < -180 || lon > 180) throw new RangeError("lon must be -180..180");
  if (radiusMeters < 1) throw new RangeError("radiusMeters must be >= 1");
  if (rows < 1 || rows > 100) throw new RangeError("rows must be 1..100");
  if (start < 0) throw new RangeError("start must be >= 0");

  const urlParams: Record<string, string | number | undefined> = {
    rows,
    start,
    q,
    "geofilter.distance": `${lat},${lon},${radiusMeters}`,
  };

  return fetchWithRetry(buildURL(urlParams));
}
