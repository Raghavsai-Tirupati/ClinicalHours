import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const originCheck = validateOrigin(req);
  if (!originCheck.valid) {
    return new Response(JSON.stringify({ error: originCheck.error }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Authenticate user from Bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Find hospital membership joined with hospital_accounts
    const { data: member, error: memberError } = await supabaseAdmin
      .from("hospital_members")
      .select("account_id, hospital_accounts(hospital_id)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error("Error querying hospital_members:", memberError);
      throw new Error("Failed to query hospital membership");
    }

    if (!member) {
      return new Response(JSON.stringify({ error: "No hospital membership found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get hospital_id from hospital_accounts
    // deno-lint-ignore no-explicit-any
    const hospitalId = (member.hospital_accounts as any)?.hospital_id;
    if (!hospitalId) {
      return new Response(JSON.stringify({ error: "No hospital linked to your account" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Find opportunity linked to that hospital
    const { data: opp, error: oppError } = await supabaseAdmin
      .from("opportunities")
      .select("id")
      .eq("hospital_id", hospitalId)
      .limit(1)
      .maybeSingle();

    if (oppError) {
      console.error("Error querying opportunities:", oppError);
      throw new Error("Failed to query opportunities");
    }

    if (!opp) {
      return new Response(JSON.stringify({ error: "No opportunity found for your hospital" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Check if hospital_pages record already exists
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id")
      .eq("hospital_id", opp.id)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking hospital_pages:", existingError);
      throw new Error("Failed to check hospital page");
    }

    if (existing) {
      return new Response(JSON.stringify({ success: true, page_id: existing.id, created: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Insert new hospital_pages record
    const { data: page, error: insertError } = await supabaseAdmin
      .from("hospital_pages")
      .insert({
        hospital_id: opp.id,
        admin_email: user.email.toLowerCase().trim(),
        is_claimed: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      // Handle race condition (unique constraint on hospital_id)
      if (insertError.code === "23505") {
        const { data: raceResult } = await supabaseAdmin
          .from("hospital_pages")
          .select("id")
          .eq("hospital_id", opp.id)
          .maybeSingle();

        return new Response(JSON.stringify({ success: true, page_id: raceResult?.id, created: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Error inserting hospital_pages:", insertError);
      throw new Error("Failed to create hospital page");
    }

    return new Response(JSON.stringify({ success: true, page_id: page.id, created: true }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Error in ensure-hospital-page:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
