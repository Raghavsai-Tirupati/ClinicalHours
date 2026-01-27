import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

interface ClaimSessionRequest {
  sessionToken: string;
  userId: string;
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

  try {
    const { sessionToken, userId }: ClaimSessionRequest = await req.json();

    if (!sessionToken || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find and validate the session token
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("verification_sessions")
      .select("*")
      .eq("token", sessionToken)
      .eq("user_id", userId)
      .single();

    if (sessionError || !sessionData) {
      console.error("Session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already used
    if (sessionData.used_at) {
      return new Response(
        JSON.stringify({ error: "Session already used" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    const expiresAt = new Date(sessionData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark session as used
    await supabaseAdmin
      .from("verification_sessions")
      .update({ used_at: new Date().toISOString() })
      .eq("id", sessionData.id);

    // Get user email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData.user) {
      console.error("User not found:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a magic link for the user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
      options: {
        redirectTo: `${origin || 'https://clinicalhours.org'}/dashboard`,
      }
    });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract the token from the magic link and return it
    // The properties object contains the tokens we need
    const magicLinkUrl = new URL(linkData.properties.action_link);
    const accessToken = magicLinkUrl.hash.match(/access_token=([^&]+)/)?.[1];
    const refreshToken = magicLinkUrl.hash.match(/refresh_token=([^&]+)/)?.[1];

    // If we can't extract tokens from the hash, use the hashed_token to verify
    if (!accessToken) {
      // Alternative approach: return the magic link for client-side verification
      return new Response(
        JSON.stringify({
          success: true,
          magicLink: linkData.properties.action_link,
          email: userData.user.email
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        accessToken,
        refreshToken,
        email: userData.user.email
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in claim-verification-session:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
