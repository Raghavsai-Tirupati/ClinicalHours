import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isSuperAdmin } from '@/lib/constants';
import type { HospitalPageWithOpportunity } from '@/types/positions';

function pageToContext(p: Record<string, unknown>): HospitalPageWithOpportunity {
  const opp = p.opportunities as Record<string, unknown> | null;
  return {
    id: p.id as string,
    hospital_id: p.hospital_id as string,
    admin_email: p.admin_email as string,
    interview_booking_url: (p.interview_booking_url as string | null) ?? null,
    is_claimed: p.is_claimed as boolean,
    claimed_at: p.claimed_at as string | null,
    created_at: p.created_at as string,
    created_by: p.created_by as string | null,
    gmail_email: (p.gmail_email as string | null) ?? null,
    gmail_connected_at: (p.gmail_connected_at as string | null) ?? null,
    opportunity: {
      id: (opp?.id as string) || (p.hospital_id as string),
      name: (opp?.name as string) || 'Unknown Hospital',
      location: (opp?.location as string) || '',
      type: (opp?.type as string) || '',
      website: (opp?.website as string | null) ?? null,
      logo_url: (opp?.logo_url as string | null) ?? null,
      description: (opp?.description as string | null) ?? null,
    },
  };
}

/**
 * Finds the hospital page for the current user.
 * 1. Super-admin: fetches all pages, uses ?page=ID or first
 * 2. hospital_pages by admin_email match
 * 3. Falls back to hospital_members → hospital_accounts → opportunities
 */
export function useHospitalPageByUser() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = searchParams.get('page');
  const [hospitalPage, setHospitalPage] = useState<HospitalPageWithOpportunity | null>(null);
  const [allPages, setAllPages] = useState<HospitalPageWithOpportunity[]>([]);
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
      // 0. Super-admin: fetch all hospital pages (RLS allows)
      if (isSuperAdmin(user.email)) {
        const { data: pages, error: pagesError } = await supabase
          .from('hospital_pages')
          .select(`
            id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
            gmail_email, gmail_connected_at,
            opportunities:hospital_id (id, name, location, type, website, logo_url, description)
          `)
          .order('created_at', { ascending: true });

        if (pagesError?.message?.includes('gmail_')) {
          const fallback = await supabase
            .from('hospital_pages')
            .select(`
              id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
              opportunities:hospital_id (id, name, location, type, website, logo_url, description)
            `)
            .order('created_at', { ascending: true });
          if (fallback.error) throw fallback.error;
          const mapped = (fallback.data ?? []).map((p) =>
            pageToContext({ ...p, gmail_email: null, gmail_connected_at: null })
          );
          setAllPages(mapped);
          const selected = pageParam
            ? mapped.find((x) => x.id === pageParam) ?? mapped[0]
            : mapped[0];
          if (selected) {
            setHospitalPage(selected);
            setPageId(selected.id);
          } else setError('No clinics found');
        } else {
          if (pagesError) throw pagesError;
          const mapped = (pages ?? []).map((p) => pageToContext(p as Record<string, unknown>));
          setAllPages(mapped);
          const selected = pageParam
            ? mapped.find((x) => x.id === pageParam) ?? mapped[0]
            : mapped[0];
          if (selected) {
            setHospitalPage(selected);
            setPageId(selected.id);
          } else setError('No clinics found');
        }
        return;
      }

      // 1. Try hospital_pages by admin_email
      // Try with gmail fields; if the migration hasn't run yet these columns won't exist
      // and Supabase will return an error — in that case retry without them.
      let pageResult = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
          gmail_email, gmail_connected_at,
          opportunities:hospital_id (id, name, location, type, website, logo_url, description)
        `)
        .eq('admin_email', user.email!)
        .limit(1)
        .maybeSingle();

      if (pageResult.error?.message?.includes('gmail_')) {
        pageResult = await supabase
          .from('hospital_pages')
          .select(`
            id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
            opportunities:hospital_id (id, name, location, type, website, logo_url, description)
          `)
          .eq('admin_email', user.email!)
          .limit(1)
          .maybeSingle();
      }

      const page = pageResult.data;

      if (page) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = page as any;
        const opp = p.opportunities;
        setPageId(page.id);

        // Auto-claim unclaimed pages when the hospital admin logs in
        if (!page.is_claimed) {
          await supabase
            .from('hospital_pages')
            .update({ is_claimed: true, claimed_at: new Date().toISOString() })
            .eq('id', page.id);
        }

        setHospitalPage({
          id: page.id,
          hospital_id: page.hospital_id,
          admin_email: page.admin_email,
          interview_booking_url: page.interview_booking_url ?? null,
          is_claimed: true, // always true after login
          claimed_at: page.claimed_at ?? new Date().toISOString(),
          created_at: page.created_at,
          created_by: page.created_by,
          gmail_email: p.gmail_email ?? null,
          gmail_connected_at: p.gmail_connected_at ?? null,
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

          if (!realPageId) {
            setError('Your clinic dashboard could not be provisioned. Please contact support or ask an admin to set up your hospital page.');
            setLoading(false);
            return;
          }

          setPageId(realPageId);
          setHospitalPage({
            id: realPageId,
            hospital_id: opportunityId || hospitalId,
            admin_email: user.email!,
            interview_booking_url: null,
            is_claimed: true,
            claimed_at: null,
            created_at: new Date().toISOString(),
            created_by: user.id,
            gmail_email: null,
            gmail_connected_at: null,
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
  // pageParam must be in the dep array — the clinic switcher changes it and
  // fetchPage captures it via closure.  Without this, switching clinics as a
  // super-admin silently reloads the same clinic.
  }, [user, pageParam]);

  useEffect(() => {
    if (!authLoading) {
      fetchPage();
    }
  }, [authLoading, fetchPage]);

  return {
    hospitalPage,
    loading: loading || authLoading,
    error,
    refetch: fetchPage,
    pageId,
    allPages,
    isSuperAdmin: isSuperAdmin(user?.email),
  };
}
