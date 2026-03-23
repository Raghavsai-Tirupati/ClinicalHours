import { useQuery } from '@tanstack/react-query';
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

/** Fetches all hospital pages when user is super-admin. Returns [] otherwise. */
export function useAllHospitalPages(): HospitalPageWithOpportunity[] {
  const { user, isReady } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ['all-hospital-pages', user?.id],
    enabled: Boolean(user?.id) && isReady && isSuperAdmin(user?.email),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: pages, error } = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
          gmail_email, gmail_connected_at,
          opportunities:hospital_id (id, name, location, type, website, logo_url, description)
        `)
        .order('created_at', { ascending: true });

      if (error?.message?.includes('gmail_')) {
        const fallback = await supabase
          .from('hospital_pages')
          .select(`
            id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by, interview_booking_url,
            opportunities:hospital_id (id, name, location, type, website, logo_url, description)
          `)
          .order('created_at', { ascending: true });
        if (fallback.error) return [];
        return (fallback.data ?? []).map((p) =>
          pageToContext({ ...p, gmail_email: null, gmail_connected_at: null })
        );
      }
      if (error) return [];
      return (pages ?? []).map((p) => pageToContext(p as Record<string, unknown>));
    },
  });
  return data;
}
