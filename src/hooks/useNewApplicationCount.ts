import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useNewApplicationCount(hospitalPageId: string | undefined) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hospitalPageId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function fetchCount() {
      try {
        // Get position IDs for this hospital page
        const { data: positions } = await supabase
          .from('hospital_positions')
          .select('id')
          .eq('hospital_page_id', hospitalPageId!);

        const positionIds = (positions || []).map((p: { id: string }) => p.id);
        if (positionIds.length === 0) {
          if (!cancelled) { setCount(0); setLoading(false); }
          return;
        }

        const { count: newCount } = await supabase
          .from('student_applications')
          .select('*', { count: 'exact', head: true })
          .in('position_id', positionIds)
          .eq('status', 'new');

        if (!cancelled) {
          setCount(newCount ?? 0);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setCount(0); setLoading(false); }
      }
    }

    fetchCount();
    return () => { cancelled = true; };
  }, [hospitalPageId]);

  return { count, loading };
}
