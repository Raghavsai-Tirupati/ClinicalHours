import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "clinicalhours_opp_count";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedCount {
  count: number;
  ts: number;
}

function getCached(): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedCount = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.count;
  } catch {
    return null;
  }
}

function setCache(count: number) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, ts: Date.now() }));
  } catch {
    // ignore
  }
}

/**
 * Returns the live opportunity count from the DB, with a session cache
 * and a sensible fallback while loading.
 */
export function useOpportunityCount(): number {
  const [count, setCount] = useState<number>(() => getCached() ?? 0);

  useEffect(() => {
    const cached = getCached();
    if (cached !== null) {
      setCount(cached);
      return;
    }

    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .then(({ count: total }) => {
        if (total !== null && total > 0) {
          setCount(total);
          setCache(total);
        }
      });
  }, []);

  return count;
}
