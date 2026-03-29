/**
 * Request interceptor for Supabase function calls
 * Adds CSRF tokens and ensures credentials are included
 */

import { getCSRFToken } from "@/lib/csrf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Headers Supabase Edge Functions expect (same as supabase.functions.invoke for anon calls). */
function supabaseFunctionHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (SUPABASE_ANON_KEY) {
    h.apikey = SUPABASE_ANON_KEY;
    h.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  return h;
}

/**
 * State-changing HTTP methods that require CSRF protection
 */
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Enhanced fetch wrapper that adds CSRF tokens and credentials
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const isStateChanging = options.method && STATE_CHANGING_METHODS.includes(options.method.toUpperCase());

  // Get CSRF token for state-changing requests
  let csrfToken: string | null = null;
  if (isStateChanging) {
    csrfToken = await getCSRFToken();
  }

  // Prepare headers
  const headers = new Headers(options.headers);

  // Add CSRF token header for state-changing requests
  if (isStateChanging && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  // Ensure credentials are included for cookie transmission
  const enhancedOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include" as RequestCredentials,
  };

  // Make the request
  const response = await fetch(url, enhancedOptions);

  // If CSRF token is invalid/missing, try to refresh it
  if (response.status === 403 && isStateChanging) {
    const errorText = await response.text();
    if (errorText.includes("CSRF") || errorText.includes("csrf")) {
      // Try refreshing CSRF token and retry once
      const newToken = await getCSRFToken();
      if (newToken && newToken !== csrfToken) {
        headers.set("X-CSRF-Token", newToken);
        return fetch(url, {
          ...enhancedOptions,
          headers,
        });
      }
    }
  }

  return response;
}

/**
 * Invoke Supabase function with CSRF protection
 * Wrapper around supabase.functions.invoke() that adds CSRF tokens
 */
export async function invokeFunctionWithCSRF(
  functionName: string,
  options: {
    body?: unknown;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  } = {}
): Promise<{ data: unknown; error: { message: string; status?: number } | null }> {
  const method = options.method || (options.body ? "POST" : "GET");
  const isStateChanging = STATE_CHANGING_METHODS.includes(method);

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  async function doFetch(csrfToken: string | null): Promise<Response> {
    const headers = supabaseFunctionHeaders(
      isStateChanging && csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    );
    return fetch(url, {
      method,
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }

  let csrfToken: string | null = null;
  if (isStateChanging) {
    csrfToken = await getCSRFToken();
  }

  try {
    let response = await doFetch(csrfToken);

    // One retry on CSRF failure (fresh token + cookie from csrf-token endpoint)
    if (!response.ok && response.status === 403 && isStateChanging) {
      const errText = await response.clone().text();
      if (errText.includes("CSRF") || errText.includes("csrf")) {
        csrfToken = await getCSRFToken();
        if (csrfToken) {
          response = await doFetch(csrfToken);
        }
      }
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: typeof data.error === "string" ? data.error : "Request failed",
          status: response.status,
        },
      };
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

