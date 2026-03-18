import { supabase } from "@/integrations/supabase/client";
import { localSelect, localDelete, TABLES } from "@/lib/localStore";
import { clearGuestTutorialPending } from "@/lib/dashboardTutorial";

const GUEST_MIGRATION_FLAG_PREFIX = "clinicalhours_guest_migrated_for_user_";

type LocalActivityLog = {
  id: string;
  custom_organization_name: string | null;
  session_date: string;
  hours: number;
};

type LocalReflection = {
  id: string;
  activity_log_id: string;
  what_happened: string | null;
  what_stood_out: string | null;
  what_learned: string | null;
};

function hasAlreadyMigrated(userId: string): boolean {
  try {
    return localStorage.getItem(GUEST_MIGRATION_FLAG_PREFIX + userId) === "true";
  } catch {
    return false;
  }
}

function markMigrated(userId: string): void {
  try {
    localStorage.setItem(GUEST_MIGRATION_FLAG_PREFIX + userId, "true");
  } catch {
    // ignore
  }
}

/**
 * Migrate local guest data (hour tracker + reflections) into the authenticated user's account.
 *
 * - Creates `experience_entries` rows from local ACTIVITY_LOGS/REFLECTIONS
 * - Clears the local tables after a successful migration to avoid double-counting
 * - Idempotent per user via a localStorage flag
 * - Marks guest->account conversions so onboarding stays silent for the new account
 */
export async function migrateGuestDataToUser(
  userId: string,
  options?: { convertedFromGuest?: boolean }
): Promise<void> {
  if (!userId) return;

  if (options?.convertedFromGuest) {
    clearGuestTutorialPending();
    await supabase
      .from("profiles")
      .update({ dashboard_tutorial_complete: true })
      .eq("id", userId);
  }

  if (hasAlreadyMigrated(userId)) return;

  try {
    const localLogs = localSelect<LocalActivityLog>(TABLES.ACTIVITY_LOGS);
    const localReflections = localSelect<LocalReflection>(TABLES.REFLECTIONS);

    if (!localLogs.length && !localReflections.length) {
      markMigrated(userId);
      return;
    }

    const reflectionByLogId = new Map<string, string>();
    for (const r of localReflections) {
      const parts = [r.what_happened, r.what_stood_out, r.what_learned].filter(Boolean);
      if (!parts.length) continue;
      const combined = parts.join(" — ");
      if (!reflectionByLogId.has(r.activity_log_id)) {
        reflectionByLogId.set(r.activity_log_id, combined);
      } else {
        // append additional reflection text if multiple reflections exist for same log
        const existing = reflectionByLogId.get(r.activity_log_id)!;
        reflectionByLogId.set(r.activity_log_id, `${existing}\n\n${combined}`);
      }
    }

    const rows = localLogs.map((log) => {
      const moment = reflectionByLogId.get(log.id) || null;
      return {
        user_id: userId,
        opportunity_id: null as string | null,
        hours: Number(log.hours) || 0,
        entry_date: log.session_date,
        moment,
      };
    });

    if (rows.length) {
      const { error } = await supabase
        .from("experience_entries")
        .insert(rows);

      if (error) {
        console.error("Failed to migrate guest activity logs:", error);
        return;
      }
    }

    // Clear local tables to avoid double‑counting after migration
    for (const log of localLogs) {
      localDelete(TABLES.ACTIVITY_LOGS, log.id);
    }
    for (const r of localReflections) {
      localDelete(TABLES.REFLECTIONS, r.id);
    }

    markMigrated(userId);
  } catch (error) {
    console.error("Error during guest data migration:", error);
  }
}

