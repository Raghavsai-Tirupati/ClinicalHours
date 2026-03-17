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

async function checkImageUrl(url: string, timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Use GET with a range header to only fetch the first few bytes
    const res = await fetch(url, { 
      method: "GET", 
      redirect: "follow", 
      signal: controller.signal,
      headers: { "Range": "bytes=0-63" },
    });
    const ct = res.headers.get("content-type") || "";
    // Accept 200 or 206 (partial content)
    const isImage = (res.status === 200 || res.status === 206) && ct.startsWith("image/");
    // Consume body to avoid leak
    await res.arrayBuffer();
    return isImage;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500, headers: corsHeaders });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = Deno.env.get("LOGO_DEV_TOKEN");
    if (!token) {
      console.error("LOGO_DEV_TOKEN not configured");
      return new Response(JSON.stringify({ error: "LOGO_DEV_TOKEN not configured" }), { status: 500, headers: corsHeaders });
    }

    console.log("Starting batch-fetch-logos...");

    const { data: listings, error: fetchError } = await supabaseAdmin
      .from("opportunities")
      .select("id, website, name")
      .is("logo_url", null)
      .not("website", "is", null)
      .limit(5);

    if (fetchError) {
      console.error("Fetch error:", fetchError.message);
      throw fetchError;
    }

    console.log(`Found ${listings?.length ?? 0} listings to process`);

    if (!listings || listings.length === 0) {
      return new Response(JSON.stringify({ processed: 0, success: 0, failed: 0 }), { headers: corsHeaders });
    }

    let success = 0;
    let failed = 0;

    for (const listing of listings) {
      const domain = extractDomain(listing.website);
      if (!domain) {
        console.log(`Invalid domain for ${listing.name}: ${listing.website}`);
        await supabaseAdmin.from("opportunities").update({ logo_url: "" }).eq("id", listing.id);
        failed++;
        continue;
      }

      let logoUrl: string | null = null;

      // 1) Try logo.dev
      const logoDevUrl = `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
      console.log(`[${listing.name}] Trying logo.dev: ${domain}`);
      
      if (await checkImageUrl(logoDevUrl)) {
        logoUrl = logoDevUrl;
        console.log(`[${listing.name}] ✅ logo.dev hit`);
      } else {
        console.log(`[${listing.name}] logo.dev miss`);
      }

      // 2) Google favicon fallback  
      if (!logoUrl) {
        const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        if (await checkImageUrl(googleUrl)) {
          logoUrl = googleUrl;
          console.log(`[${listing.name}] ✅ Google favicon hit`);
        } else {
          console.log(`[${listing.name}] Google favicon miss`);
        }
      }

      if (logoUrl) {
        const { error: updateError } = await supabaseAdmin
          .from("opportunities")
          .update({ logo_url: logoUrl })
          .eq("id", listing.id);
        if (updateError) {
          console.error(`DB update error: ${updateError.message}`);
          failed++;
        } else {
          success++;
        }
      } else {
        console.log(`[${listing.name}] ❌ No logo, marking checked`);
        await supabaseAdmin.from("opportunities").update({ logo_url: "" }).eq("id", listing.id);
        failed++;
      }
    }

    const result = { processed: listings.length, success, failed };
    console.log("Batch result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    console.error("batch-fetch-logos error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
};

serve(handler);
