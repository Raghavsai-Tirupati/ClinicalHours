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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkLogoExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const ct = res.headers.get("content-type") || "";
    // Consume body to prevent resource leak
    await res.arrayBuffer();
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

    const { data: listings, error: fetchError } = await supabaseAdmin
      .from("opportunities")
      .select("id, website")
      .is("logo_url", null)
      .not("website", "is", null)
      .limit(30);

    if (fetchError) throw fetchError;
    if (!listings || listings.length === 0) {
      return new Response(JSON.stringify({ processed: 0, success: 0, failed: 0 }), { headers: corsHeaders });
    }

    let success = 0;
    let failed = 0;

    for (const listing of listings) {
      const domain = extractDomain(listing.website);
      if (!domain) {
        failed++;
        continue;
      }

      let logoUrl: string | null = null;

      // Try logo.dev first
      const logoDevUrl = `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
      if (await checkLogoExists(logoDevUrl)) {
        logoUrl = logoDevUrl;
      }

      // Google favicon fallback
      if (!logoUrl) {
        const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        if (await checkLogoExists(googleUrl)) {
          logoUrl = googleUrl;
        }
      }

      if (logoUrl) {
        const { error: updateError } = await supabaseAdmin
          .from("opportunities")
          .update({ logo_url: logoUrl })
          .eq("id", listing.id);

        if (updateError) {
          console.error(`Failed to update ${listing.id}:`, updateError);
          failed++;
        } else {
          success++;
          console.log(`Logo set for ${listing.id}: ${domain}`);
        }
      } else {
        failed++;
        console.log(`No logo found for ${domain}`);
      }

      await delay(200);
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
