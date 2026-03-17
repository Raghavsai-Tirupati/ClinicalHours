import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

function extractDomain(url: string): string | null {
  try {
    let cleaned = url.trim();
    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      cleaned = "https://" + cleaned;
    }
    const parsed = new URL(cleaned);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(
      JSON.stringify({ error: "Invalid origin" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: corsHeaders },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: corsHeaders },
      );
    }

    const { isAdmin } = await checkAdminRole(user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: corsHeaders },
      );
    }

    const { website, listing_id } = await req.json();

    if (!website || !listing_id) {
      return new Response(
        JSON.stringify({ success: false, error: "website and listing_id are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = Deno.env.get("LOGO_DEV_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "LOGO_DEV_TOKEN not configured" }), { status: 500, headers: corsHeaders });
    }

    const domain = extractDomain(website);
    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid website URL" }),
        { status: 400, headers: corsHeaders }
      );
    }

    let logoUrl: string | null = null;

    // Try logo.dev
    const logoDevUrl = `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
    try {
      const res = await fetch(logoDevUrl, { method: "HEAD" });
      if (res.ok) {
        logoUrl = logoDevUrl;
      }
    } catch {
      // fallback
    }

    // Google favicon fallback
    if (!logoUrl) {
      const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      try {
        const res = await fetch(googleUrl, { method: "HEAD" });
        if (res.ok) {
          logoUrl = googleUrl;
        }
      } catch {
        // both failed
      }
    }

    if (!logoUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No logo found for this domain" }),
        { headers: corsHeaders }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("opportunities")
      .update({ logo_url: logoUrl })
      .eq("id", listing_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, logo_url: logoUrl }),
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("fetch-logo error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

serve(handler);
