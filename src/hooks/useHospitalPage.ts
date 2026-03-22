import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HospitalPageWithOpportunity } from '@/types/positions';

export function useHospitalPage(pageId: string | undefined) {
  const [hospitalPage, setHospitalPage] = useState<HospitalPageWithOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!pageId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id, admin_email, interview_booking_url, is_claimed, claimed_at, created_at, created_by,
          gmail_email, gmail_connected_at,
          opportunities:hospital_id (id, name, location, type, website, logo_url, description)
        `)
        .eq('id', pageId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opp = (data as any).opportunities;
        setHospitalPage({
          id: data.id,
          hospital_id: data.hospital_id,
          admin_email: data.admin_email,
          interview_booking_url: data.interview_booking_url,
          is_claimed: data.is_claimed,
          claimed_at: data.claimed_at,
          created_at: data.created_at,
          created_by: data.created_by,
          opportunity: {
            id: opp?.id || data.hospital_id,
            name: opp?.name || 'Unknown Hospital',
            location: opp?.location || '',
            type: opp?.type || '',
            website: opp?.website || null,
            logo_url: opp?.logo_url || null,
            description: opp?.description || null,
          },
        });
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
