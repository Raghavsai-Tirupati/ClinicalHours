import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find profiles where email_verified is false/null and created more than 24 hours ago
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: unverifiedProfiles, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, created_at")
      .or("email_verified.is.null,email_verified.eq.false")
      .lt("created_at", cutoff);

    if (fetchError) {
      console.error("Error fetching unverified profiles:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!unverifiedProfiles || unverifiedProfiles.length === 0) {
      return new Response(JSON.stringify({ deleted: 0, message: "No unverified users to clean up" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deleted = 0;
    const errors: string[] = [];

    for (const profile of unverifiedProfiles) {
      try {
        // Skip users who might be hospital accounts (they get email_verified = true on signup)
        // Double-check they aren't a hospital member
        const { data: memberCheck } = await supabaseAdmin
          .from("hospital_members")
          .select("id")
          .eq("user_id", profile.id)
          .limit(1);

        if (memberCheck && memberCheck.length > 0) {
          console.log(`Skipping user ${profile.id} — hospital member`);
          continue;
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
        if (deleteError) {
          console.error(`Failed to delete user ${profile.id}:`, deleteError);
          errors.push(`${profile.id}: ${deleteError.message}`);
        } else {
          deleted++;
          console.log(`Deleted unverified user ${profile.id} (${profile.full_name})`);
        }
      } catch (err) {
        console.error(`Error processing user ${profile.id}:`, err);
        errors.push(`${profile.id}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        deleted,
        total_found: unverifiedProfiles.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cleanup function error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
