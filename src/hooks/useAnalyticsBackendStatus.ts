import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { analyticsQueryKeys } from './useAnalyticsRealtime';

export function useAnalyticsBackendStatus() {
  const query = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'backend-probe'],
    queryFn: async () => {
      const { error } = await supabase.rpc('get_admin_dashboard_kpis', {
        p_since: new Date(Date.now() - 86400000).toISOString(),
        p_until: new Date().toISOString(),
        p_clinic_id: null,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes('does not exist') ||
          msg.includes('could not find') ||
          msg.includes('schema cache')
        ) {
          return { ready: false as const, error: error.message };
        }
        throw error;
      }
      return { ready: true as const, error: null };
    },
    staleTime: 60_000,
    retry: false,
  });

  return {
    ready: query.data?.ready ?? (query.isLoading ? undefined : true),
    loading: query.isLoading,
    error: query.data?.error ?? null,
  };
}
