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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Fetch listings that have a website but no logo_url yet (null only, not empty string)
    const { data: listings, error: fetchError } = await supabaseAdmin
      .from("opportunities")
      .select("id, website")
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
        console.log(`Invalid domain for listing ${listing.id}: ${listing.website}`);
        // Mark as checked
        await supabaseAdmin.from("opportunities").update({ logo_url: "" }).eq("id", listing.id);
        failed++;
        continue;
      }

      let logoUrl: string | null = null;

      try {
        // Try logo.dev - just build the URL and do a quick HEAD check
        const logoDevUrl = `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
        console.log(`Checking logo.dev for ${domain}...`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        try {
          const res = await fetch(logoDevUrl, { 
            method: "HEAD", 
            redirect: "follow", 
            signal: controller.signal 
          });
          const ct = res.headers.get("content-type") || "";
          console.log(`logo.dev response for ${domain}: status=${res.status}, content-type=${ct}`);
          if (res.ok && ct.startsWith("image/")) {
            logoUrl = logoDevUrl;
          }
        } catch (e) {
          console.log(`logo.dev timeout/error for ${domain}: ${e}`);
        } finally {
          clearTimeout(timeout);
        }

        // Google favicon fallback
        if (!logoUrl) {
          const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 3000);
          
          try {
            const res = await fetch(googleUrl, { 
              method: "HEAD", 
              redirect: "follow", 
              signal: controller2.signal 
            });
            const ct = res.headers.get("content-type") || "";
            console.log(`Google favicon response for ${domain}: status=${res.status}, content-type=${ct}`);
            if (res.ok && ct.startsWith("image/")) {
              logoUrl = googleUrl;
            }
          } catch (e) {
            console.log(`Google favicon timeout/error for ${domain}: ${e}`);
          } finally {
            clearTimeout(timeout2);
          }
        }
      } catch (e) {
        console.error(`Unexpected error for ${domain}: ${e}`);
      }

      if (logoUrl) {
        console.log(`✅ Found logo for ${domain}: ${logoUrl}`);
        const { error: updateError } = await supabaseAdmin
          .from("opportunities")
          .update({ logo_url: logoUrl })
          .eq("id", listing.id);
        if (updateError) {
          console.error(`DB update error for ${listing.id}: ${updateError.message}`);
          failed++;
        } else {
          success++;
        }
      } else {
        console.log(`❌ No logo found for ${domain}, marking as checked`);
        await supabaseAdmin
          .from("opportunities")
          .update({ logo_url: "" })
          .eq("id", listing.id);
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
