import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

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

async function checkUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal });
    const ct = res.headers.get("content-type") || "";
    return res.ok && ct.startsWith("image/");
  } catch {
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = Deno.env.get("LOGO_DEV_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "LOGO_DEV_TOKEN not configured" }), { status: 500, headers: corsHeaders });
    }

    // Smaller batch to avoid CPU timeout
    const { data: listings, error: fetchError } = await supabaseAdmin
      .from("opportunities")
      .select("id, website")
      .is("logo_url", null)
      .not("website", "is", null)
      .limit(10);

    if (fetchError) throw fetchError;
    if (!listings || listings.length === 0) {
      return new Response(JSON.stringify({ processed: 0, success: 0, failed: 0 }), { headers: corsHeaders });
    }

    let success = 0;
    let failed = 0;

    for (const listing of listings) {
      const domain = extractDomain(listing.website);
      if (!domain) { failed++; continue; }

      let logoUrl: string | null = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      try {
        // Try logo.dev
        const logoDevUrl = `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
        if (await checkUrl(logoDevUrl, controller.signal)) {
          logoUrl = logoDevUrl;
        }

        // Google favicon fallback
        if (!logoUrl) {
          const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          if (await checkUrl(googleUrl, controller.signal)) {
            logoUrl = googleUrl;
          }
        }
      } catch {
        // timeout or network error
      } finally {
        clearTimeout(timeout);
      }

      if (logoUrl) {
        const { error: updateError } = await supabaseAdmin
          .from("opportunities")
          .update({ logo_url: logoUrl })
          .eq("id", listing.id);
        if (updateError) { failed++; } else { success++; }
      } else {
        // Mark as checked so we don't retry endlessly — set logo_url to empty string
        await supabaseAdmin
          .from("opportunities")
          .update({ logo_url: "" })
          .eq("id", listing.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: listings.length, success, failed }),
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("batch-fetch-logos error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

serve(handler);
