import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(root, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const TOKEN = process.env.ANALYTICS_API_TOKEN;

function endpoint(): string {
  if (!SUPABASE_URL) {
    throw new Error(
      "Missing SUPABASE_URL or VITE_SUPABASE_URL in .env (e.g. https://sysbtcikrbrrgafffody.supabase.co)",
    );
  }
  if (!TOKEN) {
    throw new Error(
      "Missing ANALYTICS_API_TOKEN in .env — set the same secret used by the student-analytics edge function",
    );
  }
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/student-analytics`;
}

export async function analyticsRequest(
  params: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const url = new URL(endpoint());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { "x-api-token": TOKEN! },
  });

  const body: unknown = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : res.statusText;
    throw new Error(`Analytics API ${res.status}: ${message}`);
  }
  return body;
}

export function asJsonText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
