import { useState, useEffect } from 'react';
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
  const [member, setMember] = useState<HospitalMemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setMember(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    async function fetchMember() {
      const { data, error } = await supabase
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
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) {
        console.error('useHospitalMember error:', error);
        setError(error.message);
        setMember(null);
      } else if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = data.hospital_accounts as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hospital = account?.hospitals as any;
        setMember({
          memberId: data.id,
          accountId: data.account_id,
          hospitalId: hospital?.id ?? account?.hospital_id,
          hospitalName: hospital?.name ?? 'Unknown Hospital',
          role: data.role as HospitalMemberInfo['role'],
        });
      } else {
        setMember(null);
      }

      setLoading(false);
    }

    fetchMember();
  }, [user, isReady, tick]);

  return {
    member,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
