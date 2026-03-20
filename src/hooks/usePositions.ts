import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HospitalPosition } from '@/types/positions';

export function usePositions(hospitalPageId: string | undefined) {
  const [positions, setPositions] = useState<HospitalPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = useCallback(async () => {
    if (!hospitalPageId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hospital_positions')
        .select('*')
        .eq('hospital_page_id', hospitalPageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions((data || []) as HospitalPosition[]);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalPageId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return { positions, loading, refetch: fetchPositions };
}
