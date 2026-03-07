import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const { user, isReady } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      setIsLoading(false);
      return;
    }

    async function checkOnboarding() {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user!.id)
        .single();

      setShowOnboarding(!data?.onboarding_complete);
      setIsLoading(false);
    }

    checkOnboarding();
  }, [isReady, user]);

  async function completeOnboarding() {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id);
    setShowOnboarding(false);
  }

  function skipOnboarding() {
    setShowOnboarding(false);
  }

  return { showOnboarding, isLoading, completeOnboarding, skipOnboarding };
}
