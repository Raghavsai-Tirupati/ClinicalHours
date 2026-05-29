import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-csrf-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function clampLimit(value: unknown, fallback = 20, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function clampDays(value: unknown, fallback = 30, max = 365): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Tool definitions exposed to the model
// ---------------------------------------------------------------------------
const tools = [
  {
    name: "query_most_active_users",
    description:
      "Returns the users with the most tracked activity events over a recent period, including their profile name and university. Use for questions about who is most engaged or active.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Look-back window in days (default 30)." },
        limit: { type: "number", description: "Max number of users to return (default 20)." },
      },
    },
  },
  {
    name: "query_high_intent_abandoners",
    description:
      "Returns users who saved multiple opportunities but have not applied to any of them (high intent but abandoned). Use for re-engagement and conversion questions.",
    input_schema: {
      type: "object",
      properties: {
        min_saved: { type: "number", description: "Minimum saved opportunities to qualify (default 2)." },
        limit: { type: "number", description: "Max number of users to return (default 20)." },
      },
    },
  },
  {
    name: "query_user_profile",
    description:
      "Looks up one or more user profiles by a search term matching full name, university, or major. Returns profile details and engagement stats.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search term to match against name/university/major." },
        limit: { type: "number", description: "Max profiles to return (default 10)." },
      },
      required: ["search"],
    },
  },
  {
    name: "query_funnel_snapshot",
    description:
      "Returns an aggregate snapshot of the conversion funnel: counts of key tracking events, total users, premium users, guest sessions and applications over a recent period.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Look-back window in days (default 30)." },
      },
    },
  },
  {
    name: "query_dormant_users",
    description:
      "Returns registered users who have had no tracked activity within the dormancy window. Use for churn / win-back questions.",
    input_schema: {
      type: "object",
      properties: {
        inactive_days: { type: "number", description: "Days of inactivity to qualify as dormant (default 30)." },
        limit: { type: "number", description: "Max number of users to return (default 20)." },
      },
    },
  },
  {
    name: "query_guest_sessions",
    description:
      "Returns guest session statistics: total sessions, how many converted to registered users, conversion rate, and the most recent sessions over a recent period.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Look-back window in days (default 30)." },
        limit: { type: "number", description: "Max recent sessions to list (default 20)." },
      },
    },
  },
  {
    name: "query_stale_opportunities",
    description:
      "Returns opportunities that have never been saved by any user, ordered by oldest. Use for content cleanup and quality questions.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max number of opportunities to return (default 20)." },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations — each runs a direct Supabase query and returns rows
// ---------------------------------------------------------------------------
async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "query_most_active_users": {
      const days = clampDays(input.days, 30);
      const limit = clampLimit(input.limit, 20);
      const { data: events, error } = await supabase
        .from("tracking_events")
        .select("user_id")
        .not("user_id", "is", null)
        .gte("created_at", daysAgoISO(days));
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of events ?? []) {
        const uid = (row as { user_id: string }).user_id;
        counts.set(uid, (counts.get(uid) ?? 0) + 1);
      }
      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      const ids = top.map(([uid]) => uid);
      const profileMap = new Map<string, Record<string, unknown>>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, university, major, is_premium")
          .in("id", ids);
        for (const p of profiles ?? []) profileMap.set((p as { id: string }).id, p);
      }
      return top.map(([uid, event_count]) => ({
        user_id: uid,
        event_count,
        ...(profileMap.get(uid) ?? {}),
      }));
    }

    case "query_high_intent_abandoners": {
      const minSaved = clampLimit(input.min_saved, 2, 50);
      const limit = clampLimit(input.limit, 20);
      const { data: saved, error } = await supabase
        .from("saved_opportunities")
        .select("user_id, applied");
      if (error) throw error;

      const stats = new Map<string, { saved: number; applied: number }>();
      for (const row of saved ?? []) {
        const r = row as { user_id: string; applied: boolean };
        const s = stats.get(r.user_id) ?? { saved: 0, applied: 0 };
        s.saved += 1;
        if (r.applied) s.applied += 1;
        stats.set(r.user_id, s);
      }
      const abandoners = [...stats.entries()]
        .filter(([, s]) => s.saved >= minSaved && s.applied === 0)
        .sort((a, b) => b[1].saved - a[1].saved)
        .slice(0, limit);

      const ids = abandoners.map(([uid]) => uid);
      const profileMap = new Map<string, Record<string, unknown>>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, university, major")
          .in("id", ids);
        for (const p of profiles ?? []) profileMap.set((p as { id: string }).id, p);
      }
      return abandoners.map(([uid, s]) => ({
        user_id: uid,
        saved_count: s.saved,
        applied_count: s.applied,
        ...(profileMap.get(uid) ?? {}),
      }));
    }

    case "query_user_profile": {
      const search = String(input.search ?? "").trim();
      const limit = clampLimit(input.limit, 10, 25);
      if (!search) return { error: "search term is required" };
      const escaped = search.replace(/[%_,]/g, (m) => `\\${m}`);
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, university, major, graduation_year, city, state, gpa, clinical_hours, is_premium, onboarding_complete, email_verified, created_at",
        )
        .or(
          `full_name.ilike.%${escaped}%,university.ilike.%${escaped}%,major.ilike.%${escaped}%`,
        )
        .limit(limit);
      if (error) throw error;

      const results = [] as Record<string, unknown>[];
      for (const p of profiles ?? []) {
        const id = (p as { id: string }).id;
        const [{ count: savedCount }, { count: eventCount }] = await Promise.all([
          supabase
            .from("saved_opportunities")
            .select("id", { count: "exact", head: true })
            .eq("user_id", id),
          supabase
            .from("tracking_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", id),
        ]);
        results.push({ ...p, saved_count: savedCount ?? 0, event_count: eventCount ?? 0 });
      }
      return results;
    }

    case "query_funnel_snapshot": {
      const days = clampDays(input.days, 30);
      const since = daysAgoISO(days);
      const { data: events, error } = await supabase
        .from("tracking_events")
        .select("event_type")
        .gte("created_at", since);
      if (error) throw error;

      const eventCounts: Record<string, number> = {};
      for (const row of events ?? []) {
        const t = (row as { event_type: string }).event_type ?? "unknown";
        eventCounts[t] = (eventCounts[t] ?? 0) + 1;
      }

      const [totalUsers, premiumUsers, guestSessions, savedInWindow] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_premium", true),
        supabase
          .from("guest_sessions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("saved_opportunities")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
      ]);

      return {
        window_days: days,
        event_counts: eventCounts,
        total_events: events?.length ?? 0,
        total_users: totalUsers.count ?? 0,
        premium_users: premiumUsers.count ?? 0,
        guest_sessions_in_window: guestSessions.count ?? 0,
        saved_opportunities_in_window: savedInWindow.count ?? 0,
      };
    }

    case "query_dormant_users": {
      const inactiveDays = clampDays(input.inactive_days, 30);
      const limit = clampLimit(input.limit, 20);
      const cutoff = daysAgoISO(inactiveDays);

      const { data: recentEvents, error } = await supabase
        .from("tracking_events")
        .select("user_id")
        .not("user_id", "is", null)
        .gte("created_at", cutoff);
      if (error) throw error;
      const activeIds = new Set((recentEvents ?? []).map((r) => (r as { user_id: string }).user_id));

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, university, major, created_at, is_premium")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(500);
      if (pErr) throw pErr;

      return (profiles ?? [])
        .filter((p) => !activeIds.has((p as { id: string }).id))
        .slice(0, limit);
    }

    case "query_guest_sessions": {
      const days = clampDays(input.days, 30);
      const limit = clampLimit(input.limit, 20);
      const since = daysAgoISO(days);

      const [total, converted, recent] = await Promise.all([
        supabase
          .from("guest_sessions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("guest_sessions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .not("converted_to_user_id", "is", null),
        supabase
          .from("guest_sessions")
          .select("session_id, created_at, converted_to_user_id, user_agent")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const totalCount = total.count ?? 0;
      const convertedCount = converted.count ?? 0;
      return {
        window_days: days,
        total_sessions: totalCount,
        converted_sessions: convertedCount,
        conversion_rate: totalCount ? +(convertedCount / totalCount).toFixed(4) : 0,
        recent_sessions: recent.data ?? [],
      };
    }

    case "query_stale_opportunities": {
      const limit = clampLimit(input.limit, 20);
      const { data: saved, error } = await supabase
        .from("saved_opportunities")
        .select("opportunity_id");
      if (error) throw error;
      const savedIds = new Set(
        (saved ?? []).map((r) => (r as { opportunity_id: string }).opportunity_id),
      );

      const { data: opps, error: oErr } = await supabase
        .from("opportunities")
        .select("id, name, type, location, created_at, updated_at")
        .order("created_at", { ascending: true })
        .limit(2000);
      if (oErr) throw oErr;

      return (opps ?? [])
        .filter((o) => !savedIds.has((o as { id: string }).id))
        .slice(0, limit);
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT = `You are the ClinicalHours Admin Assistant, an analytics copilot for platform administrators.

You have LIVE, READ-ONLY access to the production database through a set of tools. The data you retrieve is real and current.

Rules:
- For ANY question about users, activity, funnels, conversions, sessions, opportunities, or other platform data, you MUST call the appropriate tool to fetch live data BEFORE answering. Never guess or rely on prior knowledge for data questions.
- Choose the most relevant tool(s). You may call multiple tools to fully answer a question.
- After receiving tool results, summarize the findings clearly and concisely for an admin audience. Use plain language and surface the most actionable insights.
- If a tool returns no rows, say so honestly rather than inventing data.
- Never expose raw internal IDs as the main point of an answer unless specifically asked; prefer names and meaningful metrics.
- Be concise and direct.`;

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

async function callAnthropic(messages: unknown[]): Promise<{
  stop_reason: string;
  content: AnthropicContentBlock[];
}> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }
  return await res.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const body = await req.json().catch(() => null);
    const incoming = body?.messages;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return new Response(
        JSON.stringify({ error: "Request body must include a non-empty messages array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize incoming messages to Anthropic format.
    const messages: unknown[] = incoming
      .filter((m: { role?: string; content?: unknown }) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      )
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid messages provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tool-use loop.
    const MAX_TURNS = 6;
    let reply = "";
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await callAnthropic(messages);

      // Collect any text the model produced this turn.
      const textBlocks = response.content
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text as string);

      if (response.stop_reason !== "tool_use") {
        reply = textBlocks.join("\n").trim();
        break;
      }

      // Append the assistant turn (with tool_use blocks) verbatim.
      messages.push({ role: "assistant", content: response.content });

      // Execute each requested tool and build tool_result blocks.
      const toolUses = response.content.filter((b) => b.type === "tool_use");
      const toolResults = [] as Record<string, unknown>[];
      for (const tu of toolUses) {
        let resultContent: string;
        try {
          const rows = await runTool(tu.name as string, (tu.input ?? {}) as Record<string, unknown>);
          resultContent = JSON.stringify(rows);
        } catch (err) {
          resultContent = JSON.stringify({
            error: err instanceof Error ? err.message : "Tool execution failed",
          });
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: resultContent,
        });
      }

      messages.push({ role: "user", content: toolResults });

      // If we hit the last turn without a final answer, fall back to any text.
      if (turn === MAX_TURNS - 1 && textBlocks.length) {
        reply = textBlocks.join("\n").trim();
      }
    }

    if (!reply) {
      reply = "I wasn't able to produce a response. Please try rephrasing your question.";
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});