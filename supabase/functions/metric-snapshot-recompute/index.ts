import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Recomputes a metric snapshot for a given metric_definition.
// body: { metric_id: string } or {} to recompute all active metrics.

const METRIC_QUERIES: Record<string, (sb: ReturnType<typeof createClient>) => Promise<number>> = {
  total_students: async (sb) => {
    const { count } = await sb.from("profiles").select("*", { count: "exact", head: true });
    return count ?? 0;
  },
  active_students_7d: async (sb) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("tracking_events")
      .select("user_id")
      .gte("created_at", since)
      .not("user_id", "is", null);
    const unique = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
    return unique.size;
  },
  total_guest_sessions: async (sb) => {
    const { count } = await sb.from("guest_sessions").select("*", { count: "exact", head: true });
    return count ?? 0;
  },
  pending_hospital_approvals: async (sb) => {
    const { count } = await sb.from("hospital_accounts").select("*", { count: "exact", head: true }).eq("status", "pending");
    return count ?? 0;
  },
  total_opportunities: async (sb) => {
    const { count } = await sb.from("opportunities").select("*", { count: "exact", head: true }).eq("is_active", true);
    return count ?? 0;
  },
  clinic_leads_in_pipeline: async (sb) => {
    const { count } = await sb
      .from("clinic_leads")
      .select("*", { count: "exact", head: true })
      .neq("pipeline_stage", "live")
      .neq("pipeline_stage", "lost");
    return count ?? 0;
  },
  open_approvals: async (sb) => {
    const { count } = await sb.from("approval_tasks").select("*", { count: "exact", head: true }).eq("status", "pending");
    return count ?? 0;
  },
  pending_agent_tasks: async (sb) => {
    const { count } = await sb
      .from("agent_tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "running", "awaiting_approval"]);
    return count ?? 0;
  },
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("Authorization");
  const adminCheck = await checkAdminRole(authHeader, supabase);
  if (!adminCheck.isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { metric_id?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const { metric_id } = body;

  // Fetch metric definition(s)
  let query = supabase.from("metric_definitions").select("*").eq("is_active", true);
  if (metric_id) query = query.eq("id", metric_id);

  const { data: defs, error: defErr } = await query;
  if (defErr) {
    return new Response(JSON.stringify({ error: defErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ name: string; value: number | null; error?: string }> = [];

  for (const def of (defs ?? [])) {
    const queryFn = METRIC_QUERIES[def.name];
    if (!queryFn) {
      results.push({ name: def.name, value: null, error: "no query handler" });
      continue;
    }

    try {
      const value = await queryFn(supabase);
      await supabase.from("metric_snapshots").insert({
        metric_id: def.id,
        value,
        computed_by: "system",
        snapshot_at: new Date().toISOString(),
      });
      results.push({ name: def.name, value });
    } catch (e) {
      results.push({ name: def.name, value: null, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

serve(handler);
