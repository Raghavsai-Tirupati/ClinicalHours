import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface HospitalMemberInfo {
  memberId: string;
  accountId: string;
  hospitalId: string;
  hospitalName: string;
  role: 'owner' | 'admin' | 'viewer';
}

interface UseHospitalMemberResult {
  member: HospitalMemberInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useHospitalMember(): UseHospitalMemberResult {
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();

  const { data: member, isLoading, error } = useQuery({
    queryKey: ['hospital-member', user?.id, user?.email],
    enabled: Boolean(user?.id) && isReady,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<HospitalMemberInfo | null> => {
      if (!user?.id) return null;

      // 1. Check hospital_members table (legacy system)
      const { data, error: queryError } = await supabase
        .from('hospital_members')
        .select(`
          id,
          account_id,
          role,
          hospital_accounts (
            hospital_id,
            hospitals (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (data) {
        const account = data.hospital_accounts as { hospital_id?: string | null; hospitals?: { id?: string | null; name?: string | null } | null } | null;
        const hospital = account?.hospitals ?? null;

        return {
          memberId: data.id,
          accountId: data.account_id,
          hospitalId: hospital?.id ?? account?.hospital_id ?? '',
          hospitalName: hospital?.name ?? 'Unknown Hospital',
          role: data.role as HospitalMemberInfo['role'],
        };
      }

      // 2. Fallback: check hospital_pages by admin_email (for cloned/showcase accounts)
      if (!user.email) return null;

      const { data: page, error: pageError } = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id,
          opportunities:hospital_id (id, name)
        `)
        .eq('admin_email', user.email)
        .limit(1)
        .maybeSingle();

      if (pageError || !page) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = (page as any).opportunities as { id?: string; name?: string } | null;

      return {
        memberId: page.id,
        accountId: page.id,
        hospitalId: opp?.id ?? page.hospital_id,
        hospitalName: opp?.name ?? 'Unknown Hospital',
        role: 'owner',
      };
    },
  });

  const refresh = useCallback(() => {
    if (!user?.id) return;
    void queryClient.invalidateQueries({ queryKey: ['hospital-member', user.id] });
  }, [queryClient, user?.id]);

  return {
    member: member ?? null,
    loading: !isReady || (!!user && isLoading),
    error: error instanceof Error ? error.message : null,
    refresh,
  };
}
