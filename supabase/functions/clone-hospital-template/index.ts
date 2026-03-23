import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin, authenticateFromCookie, checkAdminRole } from "../_shared/auth.ts";

/**
 * Clone Hospital Template Edge Function
 *
 * Clones hospital admin setup (positions, questions, settings) from a source
 * hospital_page to a target hospital_page. Point-in-time snapshot — no auto-sync.
 *
 * Template Manifest v1:
 * ─────────────────────
 * COPIED:
 *   - hospital_positions (title, description, requirements, location, position_type,
 *     hours_per_week, duration, start_date, application_deadline, spots_available,
 *     ask_for_availability, status)
 *   - position_questions (question_text, question_type, is_required, options, display_order)
 *   - interview_booking_url (from hospital_pages)
 *
 * NOT COPIED (operational/user data):
 *   - student_applications, application_answers
 *   - admin_activity_log
 *   - gmail_refresh_token, gmail_email, gmail_connected_at
 *   - created_by, claimed_at, is_claimed
 *
 * To add new fields to the clone:
 *   1. Add the column name to POSITION_CLONE_FIELDS or QUESTION_CLONE_FIELDS
 *   2. Bump CLONE_SCHEMA_VERSION
 *   3. If it's a page-level setting, add it to the page-settings copy block
 */

const CLONE_SCHEMA_VERSION = 1;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ---------- Template Manifest ----------
// Fields cloned from hospital_positions
const POSITION_CLONE_FIELDS = [
  "title", "description", "requirements", "location", "position_type",
  "hours_per_week", "duration", "start_date", "application_deadline",
  "spots_available", "ask_for_availability", "status",
] as const;

// Fields cloned from position_questions
const QUESTION_CLONE_FIELDS = [
  "question_text", "question_type", "is_required", "options", "display_order",
] as const;

// Page-level settings to copy
const PAGE_SETTINGS_FIELDS = ["interview_booking_url"] as const;

interface CloneRequest {
  source_admin_email: string;
  target_admin_email: string;
  mode?: "full" | "positions_only" | "settings_only";
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authResult = await authenticateFromCookie(req);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin check
    const adminCheck = await checkAdminRole(authResult.user.id);
    if (!adminCheck.isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CloneRequest = await req.json();
    const {
      source_admin_email,
      target_admin_email,
      mode = "full",
    } = body;

    if (!source_admin_email || !target_admin_email) {
      return new Response(JSON.stringify({ error: "source_admin_email and target_admin_email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Resolve source hospital_page ──
    const { data: sourcePage, error: srcErr } = await supabase
      .from("hospital_pages")
      .select("id, hospital_id, interview_booking_url")
      .ilike("admin_email", source_admin_email.trim())
      .single();

    if (srcErr || !sourcePage) {
      return new Response(JSON.stringify({ error: `Source page not found for ${source_admin_email}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Resolve or create target hospital_page ──
    let targetPage: { id: string; hospital_id: string } | null = null;

    const { data: existingTarget } = await supabase
      .from("hospital_pages")
      .select("id, hospital_id")
      .ilike("admin_email", target_admin_email.trim())
      .maybeSingle();

    if (existingTarget) {
      targetPage = existingTarget;
    } else {
      // Need to create: first get the source opportunity for reference
      const { data: sourceOpp } = await supabase
        .from("opportunities")
        .select("id, name, location, type, website, hours_required, acceptance_likelihood, description, logo_url, address")
        .eq("id", sourcePage.hospital_id)
        .single();

      if (!sourceOpp) {
        return new Response(JSON.stringify({ error: "Source opportunity record not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a showcase opportunity clone
      const { data: newOpp, error: oppErr } = await supabase
        .from("opportunities")
        .insert({
          name: `${sourceOpp.name} (Showcase)`,
          location: sourceOpp.location,
          type: sourceOpp.type,
          website: sourceOpp.website,
          hours_required: sourceOpp.hours_required,
          acceptance_likelihood: sourceOpp.acceptance_likelihood,
          description: sourceOpp.description,
          logo_url: sourceOpp.logo_url,
          address: sourceOpp.address,
          source: "clone_template",
        })
        .select("id")
        .single();

      if (oppErr || !newOpp) {
        console.error("Failed to create showcase opportunity:", oppErr);
        return new Response(JSON.stringify({ error: "Failed to create showcase opportunity" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the hospital_page
      const { data: newPage, error: pageErr } = await supabase
        .from("hospital_pages")
        .insert({
          hospital_id: newOpp.id,
          admin_email: target_admin_email.trim().toLowerCase(),
          is_showcase: true,
          cloned_from_page_id: sourcePage.id,
          clone_version: CLONE_SCHEMA_VERSION,
          cloned_at: new Date().toISOString(),
        })
        .select("id, hospital_id")
        .single();

      if (pageErr || !newPage) {
        console.error("Failed to create target page:", pageErr);
        return new Response(JSON.stringify({ error: "Failed to create target hospital page" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetPage = newPage;
    }

    const results = {
      clone_version: CLONE_SCHEMA_VERSION,
      source_page_id: sourcePage.id,
      target_page_id: targetPage.id,
      positions_cloned: 0,
      questions_cloned: 0,
      settings_updated: false,
      skipped_existing_positions: 0,
    };

    // ── 3. Clone page-level settings ──
    if (mode === "full" || mode === "settings_only") {
      const settingsUpdate: Record<string, unknown> = {
        cloned_from_page_id: sourcePage.id,
        clone_version: CLONE_SCHEMA_VERSION,
        cloned_at: new Date().toISOString(),
        is_showcase: true,
      };
      for (const field of PAGE_SETTINGS_FIELDS) {
        settingsUpdate[field] = (sourcePage as Record<string, unknown>)[field] ?? null;
      }

      const { error: settErr } = await supabase
        .from("hospital_pages")
        .update(settingsUpdate)
        .eq("id", targetPage.id);

      if (settErr) console.error("Settings update error:", settErr);
      else results.settings_updated = true;
    }

    // ── 4. Clone positions + questions ──
    if (mode === "full" || mode === "positions_only") {
      // Fetch source positions
      const { data: sourcePositions, error: posErr } = await supabase
        .from("hospital_positions")
        .select("*")
        .eq("hospital_page_id", sourcePage.id);

      if (posErr) {
        console.error("Failed to fetch source positions:", posErr);
      }

      if (sourcePositions && sourcePositions.length > 0) {
        // Fetch existing target positions for idempotency (match by title)
        const { data: existingPositions } = await supabase
          .from("hospital_positions")
          .select("id, title")
          .eq("hospital_page_id", targetPage.id);

        const existingTitles = new Set(
          (existingPositions ?? []).map((p) => p.title.toLowerCase().trim())
        );

        for (const srcPos of sourcePositions) {
          // Idempotency: skip if a position with the same title already exists
          if (existingTitles.has(srcPos.title.toLowerCase().trim())) {
            results.skipped_existing_positions++;
            continue;
          }

          // Build position clone
          const posClone: Record<string, unknown> = {
            hospital_page_id: targetPage.id,
          };
          for (const field of POSITION_CLONE_FIELDS) {
            posClone[field] = srcPos[field] ?? null;
          }

          const { data: newPos, error: insertErr } = await supabase
            .from("hospital_positions")
            .insert(posClone)
            .select("id")
            .single();

          if (insertErr || !newPos) {
            console.error(`Failed to clone position "${srcPos.title}":`, insertErr);
            continue;
          }

          results.positions_cloned++;

          // Clone questions for this position
          const { data: srcQuestions } = await supabase
            .from("position_questions")
            .select("*")
            .eq("position_id", srcPos.id)
            .order("display_order", { ascending: true });

          if (srcQuestions && srcQuestions.length > 0) {
            const questionClones = srcQuestions.map((q) => {
              const qClone: Record<string, unknown> = {
                position_id: newPos.id,
              };
              for (const field of QUESTION_CLONE_FIELDS) {
                qClone[field] = q[field] ?? null;
              }
              return qClone;
            });

            const { error: qErr, data: insertedQs } = await supabase
              .from("position_questions")
              .insert(questionClones)
              .select("id");

            if (qErr) {
              console.error("Failed to clone questions:", qErr);
            } else {
              results.questions_cloned += (insertedQs?.length ?? 0);
            }
          }
        }
      }
    }

    // ── 5. Audit log ──
    await supabase.from("admin_activity_log").insert({
      actor_email: authResult.user.email ?? "unknown",
      hospital_page_id: targetPage.id,
      action_type: "template_clone",
      target_type: "hospital_page",
      metadata: {
        source_admin_email,
        target_admin_email,
        mode,
        ...results,
      },
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Clone error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
