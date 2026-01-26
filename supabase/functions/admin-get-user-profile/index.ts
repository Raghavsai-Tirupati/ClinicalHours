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

    // Fetch all saved opportunities with full details for stats
    const { data: allSavedOpportunities } = await supabaseAdmin
      .from("saved_opportunities")
      .select(`
        id,
        created_at,
        updated_at,
        applied,
        contacted,
        heard_back,
        scheduled_interview,
        is_active_experience,
        notes,
        deadline,
        opportunities:opportunity_id (id, name, type, location)
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    // Calculate saved opportunities breakdown
    const savedOpps = allSavedOpportunities || [];
    const savedStats = {
      total: savedOpps.length,
      active_experiences: savedOpps.filter(s => s.is_active_experience).length,
      applied: savedOpps.filter(s => s.applied).length,
      contacted: savedOpps.filter(s => s.contacted).length,
      heard_back: savedOpps.filter(s => s.heard_back).length,
      interviews_scheduled: savedOpps.filter(s => s.scheduled_interview).length,
    };

    // Fetch experience entries (actual hours logged)
    const { data: experienceEntries } = await supabaseAdmin
      .from("experience_entries")
      .select(`
        id,
        entry_date,
        hours,
        moment,
        created_at,
        opportunities:opportunity_id (id, name, type)
      `)
      .eq("user_id", userId)
      .order("entry_date", { ascending: false });

    // Calculate total hours from experience entries
    const entries = experienceEntries || [];
    const totalHoursLogged = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

    // Fetch reviews
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select(`
        id,
        rating,
        comment,
        created_at,
        opportunities:opportunity_id (name, type)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Fetch questions asked
    const { data: questions } = await supabaseAdmin
      .from("opportunity_questions")
      .select(`
        id,
        title,
        created_at,
        opportunities:opportunity_id (name)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch answers given
    const { data: answers } = await supabaseAdmin
      .from("question_answers")
      .select("id, created_at")
      .eq("user_id", userId);

    // Fetch reminders
    const { data: reminders } = await supabaseAdmin
      .from("reminders")
      .select(`
        id,
        remind_at,
        sent,
        opportunities:opportunity_id (name)
      `)
      .eq("user_id", userId)
      .order("remind_at", { ascending: false })
      .limit(5);

    // Determine last activity from multiple sources
    const activityDates: Date[] = [];
    
    if (profile.updated_at) {
      activityDates.push(new Date(profile.updated_at));
    }
    if (entries.length > 0 && entries[0].created_at) {
      activityDates.push(new Date(entries[0].created_at));
    }
    if (savedOpps.length > 0 && savedOpps[0].updated_at) {
      activityDates.push(new Date(savedOpps[0].updated_at));
    }
    if (reviews && reviews.length > 0 && reviews[0].created_at) {
      activityDates.push(new Date(reviews[0].created_at));
    }

    const lastActivity = activityDates.length > 0
      ? new Date(Math.max(...activityDates.map(d => d.getTime()))).toISOString()
      : null;

    // Format saved opportunities for display (recent 15)
    const formattedSaved = savedOpps.slice(0, 15).map((s: any) => {
      let status = "Saved";
      if (s.is_active_experience) status = "Active Experience";
      else if (s.scheduled_interview) status = "Interview Scheduled";
      else if (s.heard_back) status = "Heard Back";
      else if (s.applied) status = "Applied";
      else if (s.contacted) status = "Contacted";
      
      return {
        id: s.id,
        name: s.opportunities?.name || "Unknown",
        type: s.opportunities?.type || "unknown",
        location: s.opportunities?.location || "",
        status,
        is_active: s.is_active_experience || false,
        has_deadline: !!s.deadline,
        deadline: s.deadline,
        created_at: s.created_at,
        updated_at: s.updated_at,
      };
    });

    // Format experience entries for display (recent 20)
    const formattedEntries = entries.slice(0, 20).map((e: any) => ({
      id: e.id,
      opportunity_name: e.opportunities?.name || "Unknown",
      opportunity_type: e.opportunities?.type || "unknown",
      entry_date: e.entry_date,
      hours: e.hours || 0,
      moment: e.moment,
      created_at: e.created_at,
    }));

    // Format reviews
    const formattedReviews = (reviews || []).slice(0, 10).map((r: any) => ({
      id: r.id,
      opportunity_name: r.opportunities?.name || "Unknown",
      opportunity_type: r.opportunities?.type || "unknown",
      rating: r.rating,
      has_comment: !!r.comment,
      created_at: r.created_at,
    }));

    // Format questions
    const formattedQuestions = (questions || []).map((q: any) => ({
      id: q.id,
      title: q.title,
      opportunity_name: q.opportunities?.name || "Unknown",
      created_at: q.created_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        activity: {
          // Saved opportunities breakdown
          saved_total: savedStats.total,
          active_experiences: savedStats.active_experiences,
          applied: savedStats.applied,
          contacted: savedStats.contacted,
          heard_back: savedStats.heard_back,
          interviews_scheduled: savedStats.interviews_scheduled,
          // Experience tracking
          experience_entries: entries.length,
          total_hours_logged: totalHoursLogged,
          // Engagement
          reviews: (reviews || []).length,
          questions: (questions || []).length,
          answers: (answers || []).length,
          reminders_set: (reminders || []).length,
          // Activity
          last_activity: lastActivity,
        },
        savedOpportunities: formattedSaved,
        experienceEntries: formattedEntries,
        reviews: formattedReviews,
        questions: formattedQuestions,
        reminders: (reminders || []).map((r: any) => ({
          opportunity_name: r.opportunities?.name || "Unknown",
          remind_at: r.remind_at,
          sent: r.sent,
        })),
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
