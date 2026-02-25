import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface HospitalAccount {
  id: string;
  user_id: string;
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
        const { data, error } = await supabase
          .from('hospital_accounts')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking hospital account:', error);
          setHospitalAccount(null);
        } else {
          setHospitalAccount(data as HospitalAccount | null);
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
