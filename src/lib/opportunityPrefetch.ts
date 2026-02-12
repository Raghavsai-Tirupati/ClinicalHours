/**
 * Prefetch opportunities data so the Map page can use it immediately
 * instead of re-fetching from Supabase.
 *
 * Called when the user clicks the home globe (before navigation).
 * ImmersiveMap checks for cached data on mount.
 */
import { supabase } from '@/integrations/supabase/client';
import { Opportunity } from '@/types';

interface PrefetchCache {
  data: Opportunity[];
  timestamp: number;
}

const CACHE_KEY = '__prefetchedOpportunities';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Start fetching all opportunities with lat/lng and cache on window. */
export function prefetchOpportunities(): void {
  // Don't re-fetch if we already have fresh data
  const existing = (window as any)[CACHE_KEY] as PrefetchCache | undefined;
  if (existing && Date.now() - existing.timestamp < CACHE_TTL) return;

  (async () => {
    try {
      const allData: Opportunity[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('opportunities')
          .select('*')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      (window as any)[CACHE_KEY] = { data: allData, timestamp: Date.now() } as PrefetchCache;
    } catch {
      // Silently fail — ImmersiveMap will fetch normally as fallback
    }
  })();
}

/** Consume cached data (returns it and clears the cache). Returns null if stale or missing. */
export function consumePrefetchedOpportunities(): Opportunity[] | null {
  const cache = (window as any)[CACHE_KEY] as PrefetchCache | undefined;
  if (!cache) return null;
  if (Date.now() - cache.timestamp > CACHE_TTL) {
    delete (window as any)[CACHE_KEY];
    return null;
  }
  delete (window as any)[CACHE_KEY];
  return cache.data;
}
