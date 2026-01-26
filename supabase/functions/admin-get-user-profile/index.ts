import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface GetUserProfileRequest {
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Origin
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed: ${originValidation.error}`);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const { isAdmin, error: adminError } = await checkAdminRole(user.id);
    if (!isAdmin) {
      console.warn(`Non-admin user ${user.email} attempted to access user profile`);
      return new Response(
        JSON.stringify({ success: false, error: adminError || "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    let payload: GetUserProfileRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userId } = payload;
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch full profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch profile" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch activity counts
    const [
      savedResult,
      reviewsResult,
      questionsResult,
      answersResult,
      trackingResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("saved_opportunities")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabaseAdmin
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabaseAdmin
        .from("opportunity_questions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabaseAdmin
        .from("question_answers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabaseAdmin
        .from("tracking_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    // Fetch last activity from tracking_events
    const { data: lastActivity } = await supabaseAdmin
      .from("tracking_events")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Fetch saved opportunities with status
    const { data: savedOpportunities } = await supabaseAdmin
      .from("saved_opportunities")
      .select(`
        created_at,
        applied,
        contacted,
        heard_back,
        scheduled_interview,
        opportunities:opportunity_id (name)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch reviews with opportunity names
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select(`
        rating,
        created_at,
        opportunities:opportunity_id (name)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent tracking events
    const { data: recentEvents } = await supabaseAdmin
      .from("tracking_events")
      .select("event_type, page_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Format saved opportunities
    const formattedSaved = (savedOpportunities || []).map((s: any) => {
      let status = "Saved";
      if (s.scheduled_interview) status = "Interview Scheduled";
      else if (s.heard_back) status = "Heard Back";
      else if (s.applied) status = "Applied";
      else if (s.contacted) status = "Contacted";
      
      return {
        name: s.opportunities?.name || "Unknown",
        status,
        created_at: s.created_at,
      };
    });

    // Format reviews
    const formattedReviews = (reviews || []).map((r: any) => ({
      opportunity_name: r.opportunities?.name || "Unknown",
      rating: r.rating,
      created_at: r.created_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        activity: {
          saved_opportunities: savedResult.count || 0,
          reviews: reviewsResult.count || 0,
          questions: questionsResult.count || 0,
          answers: answersResult.count || 0,
          tracking_events: trackingResult.count || 0,
          last_activity: lastActivity?.created_at || null,
        },
        savedOpportunities: formattedSaved,
        reviews: formattedReviews,
        recentEvents: recentEvents || [],
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in admin-get-user-profile:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user profile",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
