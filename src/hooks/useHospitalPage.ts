import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HospitalPageWithOpportunity } from '@/types/positions';

function readCache<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null; } catch { return null; }
}
function writeCache<T>(key: string, value: T): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useHospitalPage(pageId: string | undefined) {
  const cacheKey = pageId ? `ch:hp:${pageId}` : null;
  const cached = cacheKey ? readCache<HospitalPageWithOpportunity>(cacheKey) : null;

  const [hospitalPage, setHospitalPage] = useState<HospitalPageWithOpportunity | null>(cached);
  // Only show loading spinner when there is genuinely no data to show yet
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(!!cached);

  const fetchPage = useCallback(async () => {
    if (!pageId) {
      setLoading(false);
      return;
    }

    // Only block the UI with a spinner when there is no data to show yet
    if (!hasDataRef.current) setLoading(true);
    setError(null);

    try {
      // Try with gmail fields; fall back if the migration hasn't run yet.
      let queryResult = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id, admin_email, interview_booking_url, is_claimed, claimed_at, created_at, created_by,
          gmail_email, gmail_connected_at, page_status,
          opportunities:hospital_id (id, name, location, type, website, logo_url, description)
        `)
        .eq('id', pageId)
        .single();

      if (queryResult.error?.message?.includes('gmail_')) {
        queryResult = await supabase
          .from('hospital_pages')
          .select(`
            id, hospital_id, admin_email, interview_booking_url, is_claimed, claimed_at, created_at, created_by,
            opportunities:hospital_id (id, name, location, type, website, logo_url, description)
          `)
          .eq('id', pageId)
          .single();
      }

      const { data, error: fetchError } = queryResult;
      if (fetchError) throw fetchError;

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        const opp = d.opportunities;
        const fresh: HospitalPageWithOpportunity = {
          id: data.id,
          hospital_id: data.hospital_id,
          admin_email: data.admin_email,
          interview_booking_url: data.interview_booking_url,
          is_claimed: data.is_claimed,
          claimed_at: data.claimed_at,
          created_at: data.created_at,
          created_by: data.created_by,
          gmail_email: d.gmail_email ?? null,
          gmail_connected_at: d.gmail_connected_at ?? null,
          opportunity: {
            id: opp?.id || data.hospital_id,
            name: opp?.name || 'Unknown Hospital',
            location: opp?.location || '',
            type: opp?.type || '',
            website: opp?.website || null,
            logo_url: opp?.logo_url || null,
            description: opp?.description || null,
          },
        };
        if (cacheKey) writeCache(cacheKey, fresh);
        hasDataRef.current = true;
        setHospitalPage(fresh);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hospital page');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  return { hospitalPage, loading, error, refetch: fetchPage };
}
