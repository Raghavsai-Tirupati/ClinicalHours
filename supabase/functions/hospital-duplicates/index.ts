import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface Hospital {
  id: string;
  name: string;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  status: string | null;
}

interface DuplicateGroup {
  group_key: string;
  duplicate_reason: string;
  hospitals: Hospital[];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function findDuplicates(hospitals: Hospital[]): DuplicateGroup[] {
  const nameMap = new Map<string, Hospital[]>();
  const phoneMap = new Map<string, Hospital[]>();

  for (const h of hospitals) {
    // Name matching
    const normalName = normalizeName(h.name);
    if (normalName) {
      if (!nameMap.has(normalName)) nameMap.set(normalName, []);
      nameMap.get(normalName)!.push(h);
    }

    // Phone matching
    const normalPhone = normalizePhone(h.contact_phone);
    if (normalPhone) {
      if (!phoneMap.has(normalPhone)) phoneMap.set(normalPhone, []);
      phoneMap.get(normalPhone)!.push(h);
    }
  }

  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<string>();

  // Name duplicates
  for (const [key, group] of nameMap) {
    if (group.length < 2) continue;
    const groupKey = `name:${key}`;
    groups.push({ group_key: groupKey, duplicate_reason: "name_match", hospitals: group });
    group.forEach((h) => seenIds.add(h.id));
  }

  // Phone duplicates (only if not already grouped by name)
  for (const [key, group] of phoneMap) {
    if (group.length < 2) continue;
    // Skip if all members already in a name group together
    const allSeen = group.every((h) => seenIds.has(h.id));
    if (allSeen) {
      // Check if they're in the SAME name group — if so skip
      const names = new Set(group.map((h) => normalizeName(h.name)));
      if (names.size === 1) continue;
    }
    groups.push({ group_key: `phone:${key}`, duplicate_reason: "phone_match", hospitals: group });
  }

  return groups;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { isAdmin } = await checkAdminRole(user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // GET = scan for duplicates, POST = delete selected
    if (req.method === "GET") {
      const { data: hospitals, error: fetchError } = await supabaseAdmin
        .from("hospitals")
        .select("id, name, contact_phone, city, state, address, website, status")
        .order("name");

      if (fetchError) throw new Error("Failed to fetch hospitals: " + fetchError.message);

      const groups = findDuplicates(hospitals || []);

      return new Response(
        JSON.stringify({ success: true, groups, total_groups: groups.length }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (req.method === "POST") {
      let body: { delete_ids: string[]; keep_id: string; duplicate_reason: string };
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid JSON body" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      const { delete_ids, keep_id, duplicate_reason } = body;

      if (!delete_ids?.length || !keep_id || !duplicate_reason) {
        return new Response(
          JSON.stringify({ success: false, error: "delete_ids, keep_id, and duplicate_reason are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      // Fetch names for logging
      const { data: toDelete } = await supabaseAdmin
        .from("hospitals")
        .select("id, name")
        .in("id", delete_ids);

      // Log deletions
      const logEntries = (toDelete || []).map((h) => ({
        deleted_hospital_id: h.id,
        kept_hospital_id: keep_id,
        duplicate_reason,
        deleted_hospital_name: h.name,
        deleted_by: user.id,
      }));

      if (logEntries.length > 0) {
        const { error: logError } = await supabaseAdmin
          .from("hospital_deletion_log")
          .insert(logEntries);
        if (logError) {
          console.error("Failed to log deletions:", logError);
          // Don't block deletion, but log the error
        }
      }

      // Delete hospitals
      const { error: deleteError } = await supabaseAdmin
        .from("hospitals")
        .delete()
        .in("id", delete_ids);

      if (deleteError) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to delete: " + deleteError.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, deleted: delete_ids.length }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("Error in hospital-duplicates:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
