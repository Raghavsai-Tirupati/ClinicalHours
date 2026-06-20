import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ANALYTICS_QUERY_PREFIX = 'analytics';

export function useAnalyticsRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_PREFIX] });
      }, 2000);
    };

    const channel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, invalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracking_events' }, invalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_events' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_applications' }, invalidate)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

export const analyticsQueryKeys = {
  all: [ANALYTICS_QUERY_PREFIX] as const,
  kpis: (since: string, until: string, clinicId: string | null) =>
    [...analyticsQueryKeys.all, 'kpis', since, until, clinicId] as const,
  students: () => [...analyticsQueryKeys.all, 'students'] as const,
  activity: (limit: number) => [...analyticsQueryKeys.all, 'activity', limit] as const,
  funnel: (since: string, until: string) => [...analyticsQueryKeys.all, 'funnel', since, until] as const,
  cohorts: () => [...analyticsQueryKeys.all, 'cohorts'] as const,
  student: (id: string) => [...analyticsQueryKeys.all, 'student', id] as const,
};
