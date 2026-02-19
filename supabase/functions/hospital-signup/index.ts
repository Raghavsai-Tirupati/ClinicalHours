import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: "email, password, and fullName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to create a pre-confirmed user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user with email_confirm = true so they skip verification
    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError) {
      // Check for duplicate email
      const msg = createError.message?.toLowerCase() || "";
      if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists. Please sign in instead." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw createError;
    }

    // Also mark the profile as email_verified so the login check passes
    if (userData.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", userData.user.id);
    }

    return new Response(
      JSON.stringify({ success: true, userId: userData.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("hospital-signup error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
