import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AdminCheckResult {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAdminCheck(): AdminCheckResult {
  const { user, isReady } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-check', user?.id],
    enabled: Boolean(user?.id) && isReady,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError) throw roleError;
      return Boolean(roleData);
    },
  });

  return {
    isAdmin: data ?? false,
    isLoading: !isReady || (!!user && isLoading),
    error: error instanceof Error ? error.message : null,
  };
}
