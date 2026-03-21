import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to production and trusted preview environments
const ALLOWED_ORIGINS = [
  "https://clinicalhours.org",
  "https://www.clinicalhours.org",
  "https://clinicalhours.lovable.app",
  "https://id-preview--c5bbc95b-0f92-42a3-b816-bdce54759b81.lovable.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8086",
];

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  return ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.clinicalhours.org');
}

export interface AuthResult {
  success: boolean;
  user?: { id: string; email?: string };
  error?: string;
  statusCode?: number;
}

export interface CSRFResult {
  valid: boolean;
  error?: string;
}

/**
 * Parse cookies from request headers
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });

  return cookies;
}

/**
 * Get session cookie from request
 */
export function getSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies.session || null;
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies["csrf-token"] || null;
}

/**
 * Get CSRF token from header (double-submit pattern)
 */
export function getCSRFTokenFromHeader(req: Request): string | null {
  return req.headers.get("x-csrf-token");
}

/**
 * Validate CSRF token using double-submit cookie pattern
 */
export function validateCSRFToken(req: Request): CSRFResult {
  // Only validate CSRF for state-changing methods
  const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!stateChangingMethods.includes(req.method)) {
    return { valid: true };
  }

  const cookieToken = getCSRFTokenFromCookie(req);
  const headerToken = getCSRFTokenFromHeader(req);

  if (!cookieToken || !headerToken) {
    return {
      valid: false,
      error: "CSRF token missing"
    };
  }

  if (cookieToken !== headerToken) {
    return {
      valid: false,
      error: "CSRF token mismatch"
    };
  }

  return { valid: true };
}

/**
 * Validate Origin/Referer headers
 */
export function validateOrigin(req: Request): { valid: boolean; error?: string } {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // For same-origin requests, origin might be null (browsers don't always send it)
  // In that case, check referer
  const source = origin || (referer ? new URL(referer).origin : null);

  if (!source) {
    // Allow requests without origin/referer for same-origin requests
    // This handles cases where browsers don't send these headers
    return { valid: true };
  }

  // Check if origin matches allowed origins
  const isAllowed = ALLOWED_ORIGINS.some(allowed =>
    source === allowed ||
    source.endsWith('.clinicalhours.org')
  );

  if (!isAllowed) {
    return {
      valid: false,
      error: `Origin ${source} is not allowed`
    };
  }

  return { valid: true };
}

/**
 * Authenticate user from session cookie
 */
export async function authenticateFromCookie(req: Request): Promise<AuthResult> {
  // Try Authorization header first (supabase.functions.invoke sends this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return {
        success: false,
        error: "Invalid token",
        statusCode: 401
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
      }
    };
  }

  // Fallback: session cookie
  const sessionId = getSessionCookie(req);
  if (!sessionId) {
    return {
      success: false,
      error: "No authorization header or session cookie found",
      statusCode: 401
    };
  }

  return {
    success: false,
    error: "Session cookie validation not implemented. Please use Authorization header.",
    statusCode: 401
  };
}

/**
 * Get CORS headers with proper origin
 * IMPORTANT: With credentials: 'include', Access-Control-Allow-Origin MUST be the exact origin, not '*'
 * This function should only be called after validating the origin is allowed
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed =>
    origin === allowed ||
    origin.endsWith('.clinicalhours.org')
  );

  // For credentials: 'include', we MUST return the exact origin, not '*' or a fallback
  // If origin is not allowed, return the first allowed origin as fallback (but this should be validated before calling)
  // NEVER return '*' when credentials are included
  const allowedOrigin = isAllowed && origin ? origin : ALLOWED_ORIGINS[0];

  return {
    // CORS headers
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-csrf-token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    // Security headers - prevent clickjacking
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // Enforce HTTPS (1 year)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Prevent XSS attacks in older browsers
    "X-XSS-Protection": "1; mode=block",
  };
}

/**
 * Check if user has admin role
 */
export async function checkAdminRole(userId: string): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return { isAdmin: false, error: "Admin access required" };
    }

    return { isAdmin: true };
  } catch (error) {
    console.error("Error checking admin role:", error);
    return { isAdmin: false, error: "Failed to verify admin role" };
  }
}

