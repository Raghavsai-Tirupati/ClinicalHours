import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

interface VerifyEmailRequest {
  token: string;
}

// Rate limiting for token verification attempts
const rateLimitMap = new Map<string, { count: number; resetTime: number; failedAttempts: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP
const MAX_FAILED_ATTEMPTS = 5; // Block after 5 failed attempts
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minute block after too many failures

function getRateLimitStatus(clientIp: string): { blocked: boolean; reason?: string } {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS, failedAttempts: 0 });
    return { blocked: false };
  }

  // Check if blocked due to too many failed attempts
  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return { blocked: true, reason: "Too many failed attempts. Please try again later." };
  }

  // Check rate limit
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { blocked: true, reason: "Too many requests. Please try again later." };
  }

  record.count++;
  return { blocked: false };
}

function recordFailedAttempt(clientIp: string): void {
  const record = rateLimitMap.get(clientIp);
  if (record) {
    record.failedAttempts++;
    // Extend block time on failures
    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      record.resetTime = Date.now() + BLOCK_DURATION_MS;
    }
  }
}

// Clean up old entries periodically
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Origin header
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed: ${originValidation.error}`);
    return new Response(
      JSON.stringify({ error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Note: CSRF validation is intentionally skipped for email verification
  // The verification token itself acts as a secure, one-time secret that protects against CSRF
  // Users clicking email links won't have CSRF cookies set in their new browser context

  // Get client IP for rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";

  // Check rate limit
  const rateLimitStatus = getRateLimitStatus(clientIp);
  if (rateLimitStatus.blocked) {
    console.warn(`Rate limit/block for IP ${clientIp}: ${rateLimitStatus.reason}`);
    return new Response(
      JSON.stringify({ error: rateLimitStatus.reason }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  try {
    const { token }: VerifyEmailRequest = await req.json();

    console.log(`Verifying email with token: ${token?.substring(0, 8)}...`);

    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 200) {
      recordFailedAttempt(clientIp);
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("email_verification_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token not found:", tokenError);
      recordFailedAttempt(clientIp);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already verified
    if (tokenData.verified_at) {
      return new Response(
        JSON.stringify({ error: "Email already verified", alreadyVerified: true }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.error("Token expired");
      return new Response(
        JSON.stringify({ error: "Verification link has expired. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark token as verified
    const { error: updateTokenError } = await supabaseAdmin
      .from("email_verification_tokens")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    if (updateTokenError) {
      console.error("Error updating token:", updateTokenError);
      throw new Error("Failed to verify email");
    }

    // Update user profile to mark email as verified
    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", tokenData.user_id);

    if (updateProfileError) {
      console.error("Error updating profile:", updateProfileError);
      // Don't throw - token is already marked verified
    }

    console.log(`Email verified successfully for user ${tokenData.user_id}`);

    return new Response(
      JSON.stringify({ success: true, email: tokenData.email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-email function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
