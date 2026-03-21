import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { HospitalPageWithOpportunity } from '@/types/positions';

/**
 * Finds the hospital page for the current user.
 * 1. Checks hospital_pages by admin_email match
 * 2. Falls back to hospital_members → hospital_accounts → opportunities
 *    to build a HospitalPageWithOpportunity without requiring a hospital_pages record.
 */
export function useHospitalPageByUser() {
  const { user, loading: authLoading } = useAuth();
  const [hospitalPage, setHospitalPage] = useState<HospitalPageWithOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try hospital_pages by admin_email
      const { data: page } = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
          opportunities:hospital_id (id, name, location, type, website, logo_url, description)
        `)
        .eq('admin_email', user.email!)
        .limit(1)
        .maybeSingle();

      if (page) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opp = (page as any).opportunities;
        setPageId(page.id);
        setHospitalPage({
          id: page.id,
          hospital_id: page.hospital_id,
          admin_email: page.admin_email,
          interview_booking_url: page.interview_booking_url ?? null,
          is_claimed: page.is_claimed,
          claimed_at: page.claimed_at,
          created_at: page.created_at,
          created_by: page.created_by,
          opportunity: {
            id: opp?.id || page.hospital_id,
            name: opp?.name || 'Unknown Hospital',
            location: opp?.location || '',
            type: opp?.type || '',
            website: opp?.website || null,
            logo_url: opp?.logo_url || null,
            description: opp?.description || null,
          },
        });
        return;
      }

      // 2. Fall back to hospital_members → hospital_accounts → hospitals
      //    Then look up the opportunity by hospitals.id
      const { data: member } = await supabase
        .from('hospital_members')
        .select(`
          id,
          account_id,
          hospital_accounts (
            hospital_id,
            hospitals:hospital_id (id, name, website)
          )
        `)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = member.hospital_accounts as any;
        const hospitalId = account?.hospital_id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hospital = account?.hospitals as any;

        if (hospitalId) {
          // Find the opportunity linked to this hospital
          const { data: opp } = await supabase
            .from('opportunities')
            .select('id, name, location, type, website, logo_url, description')
            .eq('hospital_id', hospitalId)
            .limit(1)
            .maybeSingle();

          // Auto-provision hospital_pages via edge function (bypasses RLS)
          let realPageId: string | null = null;
          const opportunityId = opp?.id;

          try {
            const { data: ensureData, error: ensureError } = await supabase.functions.invoke(
              'ensure-hospital-page',
              { method: 'POST' }
            );

            if (ensureError) {
              console.error('ensure-hospital-page error:', ensureError.message);
            } else if (ensureData?.success) {
              realPageId = ensureData.page_id;
            }
          } catch (e) {
            console.error('Failed to call ensure-hospital-page:', e);
          }

          const pageIdToUse = realPageId || `virtual-${hospitalId}`;
          setPageId(realPageId);

          setHospitalPage({
            id: pageIdToUse,
            hospital_id: opportunityId || hospitalId,
            admin_email: user.email!,
            interview_booking_url: null,
            is_claimed: true,
            claimed_at: null,
            created_at: new Date().toISOString(),
            created_by: user.id,
            opportunity: {
              id: opportunityId || hospitalId,
              name: opp?.name || hospital?.name || 'Unknown Hospital',
              location: opp?.location || '',
              type: opp?.type || '',
              website: opp?.website || hospital?.website || null,
              logo_url: opp?.logo_url || null,
              description: opp?.description || null,
            },
          });
          return;
        }
      }

      // 3. Nothing found
      setError('No hospital found for your account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hospital page');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchPage();
    }
  }, [authLoading, fetchPage]);

  return { hospitalPage, loading: loading || authLoading, error, refetch: fetchPage, pageId };
}
