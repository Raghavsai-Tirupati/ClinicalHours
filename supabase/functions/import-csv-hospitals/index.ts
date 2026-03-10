import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to production and development
const ALLOWED_ORIGINS = [
  "https://clinicalhours.org",
  "https://www.clinicalhours.org",
  "https://clinicalhours.org",
  "https://www.clinicalhours.org",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8080",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed =>
    origin === allowed ||
    origin.endsWith('.clinicalhours.org')
  );

  const allowedOrigin = isAllowed && origin ? origin : ALLOWED_ORIGINS[0];

  return {
    // CORS headers
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-csrf-token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    // Security headers - prevent clickjacking
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // Enforce HTTPS (1 year)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Prevent XSS attacks in older browsers
    "X-XSS-Protection": "1; mode=block",
  };
}

interface OpportunityInsert {
  name: string;
  type: 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer';
  location: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  hours_required: string;
  acceptance_likelihood: 'high' | 'medium' | 'low';
  requirements: string[];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  console.log("Import function called, method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing env vars");
      throw new Error("Missing Supabase configuration");
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Authenticate user from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("Invalid token:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error("Role check error:", roleError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to verify admin role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.error("User is not admin:", user.id);
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin role verified for user:", user.id);

    const body = await req.json();
    const { opportunities, clearExisting } = body as { 
      opportunities: OpportunityInsert[]; 
      clearExisting?: boolean 
    };
    
    console.log(`Received ${opportunities?.length || 0} opportunities, clearExisting: ${clearExisting}`);

    if (clearExisting) {
      const { error: deleteError } = await supabaseAdmin
        .from("opportunities")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      
      if (deleteError) {
        console.error("Error clearing opportunities:", deleteError);
        throw new Error(`Failed to clear existing data: ${deleteError.message}`);
      }
      console.log("Cleared existing opportunities (admin:", user.id, ")");
    }

    if (!opportunities || opportunities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, message: "No opportunities to import" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the batch
    const { error: insertError } = await supabaseAdmin
      .from("opportunities")
      .insert(opportunities);

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    console.log(`Imported ${opportunities.length} opportunities (admin: ${user.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: opportunities.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
