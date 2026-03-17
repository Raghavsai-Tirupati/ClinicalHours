import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron: deletes unverified users (24h old). Use ?full=true for one-time delete of ALL unverified.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return new Response(
      JSON.stringify({ error: "Server misconfiguration" }),
      { status: 500, headers: corsHeaders },
    );
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const url = new URL(req.url);
    const fullCleanup = url.searchParams.get("full") === "true";

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .or("email_verified.is.null,email_verified.eq.false");

    if (!fullCleanup) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.lt("created_at", cutoff);
    }

    const { data: unverifiedProfiles, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching unverified profiles:", fetchError);
      throw fetchError;
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const profile of unverifiedProfiles ?? []) {
      if (!fullCleanup) {
        const { data: memberCheck } = await supabaseAdmin
          .from("hospital_members")
          .select("id")
          .eq("user_id", profile.id)
          .limit(1);

        if (memberCheck && memberCheck.length > 0) {
          console.log(`Skipping user ${profile.id} — hospital member`);
          continue;
        }
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
      if (deleteError) {
        console.error(`Failed to delete user ${profile.id}:`, deleteError);
        errors.push(`${profile.id}: ${deleteError.message}`);
      } else {
        deletedCount++;
        console.log(`Deleted unverified user ${profile.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        fullCleanup,
        total_found: unverifiedProfiles?.length ?? 0,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("cleanup-unverified-users error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

serve(handler);
