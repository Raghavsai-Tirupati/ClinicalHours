import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ActivityLogEntry, ActivityActionType } from '@/types/positions';

export function useActivityLog(hospitalPageId: string | undefined) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchEntries = useCallback(async () => {
    if (!hospitalPageId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('hospital_page_id', hospitalPageId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEntries((data || []) as ActivityLogEntry[]);
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalPageId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const logActivity = useCallback(
    async (
      actionType: ActivityActionType,
      opts?: { targetType?: string; targetId?: string; metadata?: Record<string, unknown> }
    ): Promise<boolean> => {
      if (!hospitalPageId || !user?.email) return false;
      const { error } = await supabase.from('admin_activity_log').insert({
        hospital_page_id: hospitalPageId,
        actor_email: user.email,
        action_type: actionType,
        target_type: opts?.targetType ?? null,
        target_id: opts?.targetId ?? null,
        metadata: opts?.metadata ?? {},
      });
      if (error) {
        console.error('Failed to log activity:', error.message, error);
        return false;
      }
      return true;
    },
    [hospitalPageId, user?.email]
  );

  return { entries, loading, refetch: fetchEntries, logActivity };
}
