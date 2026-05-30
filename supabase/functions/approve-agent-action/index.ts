import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Approves or rejects an agent task or approval_task and executes the approved payload.
// body: { entity: 'agent_task' | 'approval_task', id: string, action: 'approve' | 'reject', rejection_reason?: string }

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

  let body: { entity: string; id: string; action: "approve" | "reject"; rejection_reason?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { entity, id, action, rejection_reason } = body;
  if (!entity || !id || !action) {
    return new Response(JSON.stringify({ error: "entity, id, and action are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();

  if (entity === "agent_task") {
    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("agent_tasks")
      .update({ status: newStatus, assigned_to: adminCheck.userId, updated_at: now })
      .eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (entity === "approval_task") {
    const update: Record<string, unknown> = { updated_at: now, approver_id: adminCheck.userId };

    if (action === "approve") {
      update.status = "approved";
      update.approved_at = now;
    } else {
      update.status = "rejected";
      update.rejected_at = now;
      if (rejection_reason) update.rejection_reason = rejection_reason;
    }

    const { data: task, error } = await supabase
      .from("approval_tasks")
      .update(update)
      .eq("id", id)
      .select("payload, approval_type")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute payload on approval
    let executionResult: Record<string, unknown> | null = null;
    if (action === "approve" && task?.payload) {
      executionResult = await executeApprovedPayload(task.approval_type, task.payload, supabase, now);
    }

    return new Response(JSON.stringify({ success: true, status: update.status, execution: executionResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown entity type" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

async function executeApprovedPayload(
  approvalType: string,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  now: string,
): Promise<Record<string, unknown>> {
  switch (approvalType) {
    case "campaign_send": {
      // Queue the campaign message
      const messageId = payload.message_id as string;
      if (messageId) {
        await supabase
          .from("campaign_messages")
          .update({ status: "queued", queued_at: now, updated_at: now })
          .eq("id", messageId);
        return { queued: true, message_id: messageId };
      }
      break;
    }
    case "archive_opportunity": {
      const oppId = payload.opportunity_id as string;
      if (oppId) {
        await supabase
          .from("opportunities")
          .update({ is_active: false, updated_at: now })
          .eq("id", oppId);
        return { archived: true, opportunity_id: oppId };
      }
      break;
    }
    case "stage_advance": {
      const leadId = payload.lead_id as string;
      const toStage = payload.to_stage as string;
      if (leadId && toStage) {
        const { data: lead } = await supabase.from("clinic_leads").select("pipeline_stage").eq("id", leadId).single();
        await supabase.from("lead_pipeline_history").insert({ lead_id: leadId, from_stage: lead?.pipeline_stage, to_stage: toStage });
        await supabase.from("clinic_leads").update({ pipeline_stage: toStage, updated_at: now }).eq("id", leadId);
        return { advanced: true, lead_id: leadId, to_stage: toStage };
      }
      break;
    }
  }
  return { executed: false, reason: "no matching handler" };
}

serve(handler);
