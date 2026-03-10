import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface HospitalAccount {
  id: string;
  hospital_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  account_status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface HospitalAccountResult {
  isHospital: boolean;
  hospitalAccount: HospitalAccount | null;
  isLoading: boolean;
}

export function useHospitalAccount(): HospitalAccountResult {
  const { user, isReady } = useAuth();
  const [hospitalAccount, setHospitalAccount] = useState<HospitalAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkHospitalAccount() {
      if (!isReady) return;

      if (!user) {
        setHospitalAccount(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data: member, error: memberError } = await supabase
          .from('hospital_members')
          .select('account_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();

        if (memberError || !member) {
          setHospitalAccount(null);
          setIsLoading(false);
          return;
        }

        const { data: row, error } = await supabase
          .from('hospital_accounts')
          .select('id, account_status, contact_email, contact_phone, description, admin_note, reviewed_at, created_at, hospitals(name, website, address)')
          .eq('id', member.account_id)
          .maybeSingle();

        if (error || !row) {
          setHospitalAccount(null);
        } else {
          const h = row.hospitals as { name?: string; website?: string; address?: string } | null;
          setHospitalAccount({
            id: row.id,
            hospital_name: h?.name ?? '',
            contact_email: row.contact_email ?? '',
            contact_phone: row.contact_phone,
            website: h?.website ?? null,
            address: h?.address ?? null,
            description: row.description,
            account_status: (row.account_status as HospitalAccount['account_status']) ?? 'pending',
            admin_note: row.admin_note,
            reviewed_at: row.reviewed_at,
            created_at: row.created_at,
          });
        }
      } catch (err) {
        console.error('Error in hospital account check:', err);
        setHospitalAccount(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkHospitalAccount();
  }, [user, isReady]);

  return {
    isHospital: !!hospitalAccount,
    hospitalAccount,
    isLoading,
  };
}
