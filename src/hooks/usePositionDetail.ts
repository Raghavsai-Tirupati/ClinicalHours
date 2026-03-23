import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isPositionDeadlinePassed } from '@/lib/positionAvailability';
import type { HospitalPosition, PositionQuestion } from '@/types/positions';

export function usePositionDetail(positionId: string | undefined) {
  const [position, setPosition] = useState<HospitalPosition | null>(null);
  const [questions, setQuestions] = useState<PositionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!positionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [posResult, questionsResult] = await Promise.all([
        supabase
          .from('hospital_positions')
          .select('*')
          .eq('id', positionId)
          .single(),
        supabase
          .from('position_questions')
          .select('*')
          .eq('position_id', positionId)
          .order('display_order', { ascending: true }),
      ]);

      if (posResult.error) throw posResult.error;

      const resolvedPosition = posResult.data as HospitalPosition;
      if (resolvedPosition.status !== 'active') {
        throw new Error('This position is no longer accepting applications.');
      }
      if (isPositionDeadlinePassed(resolvedPosition.application_deadline)) {
        throw new Error('Applications for this position have closed.');
      }

      setPosition(resolvedPosition);
      setQuestions((questionsResult.data || []) as PositionQuestion[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load position');
    } finally {
      setLoading(false);
    }
  }, [positionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { position, questions, loading, error, refetch: fetchDetail };
}
