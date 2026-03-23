import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the current user has submitted at least one application
 * (either student_applications or legacy applications table).
 */
export function useHasApplications(userId: string | undefined) {
  const [hasApplications, setHasApplications] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        // Check student_applications first (new system)
        const { count: posCount } = await supabase
          .from("student_applications")
          .select("id", { count: "exact", head: true })
          .eq("student_id", userId)
          .limit(1);

        if (!cancelled && (posCount ?? 0) > 0) {
          setHasApplications(true);
          setLoading(false);
          return;
        }

        // Check legacy applications table
        const { count: legacyCount } = await supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("student_id", userId)
          .limit(1);

        if (!cancelled) {
          setHasApplications((legacyCount ?? 0) > 0);
        }
      } catch {
        // silently fail — just hide the link
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [userId]);

  return { hasApplications, loading };
}
