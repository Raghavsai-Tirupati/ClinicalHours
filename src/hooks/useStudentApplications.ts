import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StudentApplication } from '@/types/positions';

export function useStudentApplications(studentId: string | undefined) {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_applications')
        .select(`
          *,
          position:hospital_positions (
            id, title, position_type, location, hospital_page_id, status
          )
        `)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Map the joined data to our interface
      const mapped: StudentApplication[] = (data || []).map((row) => ({
        id: row.id,
        position_id: row.position_id,
        student_id: row.student_id,
        status: row.status,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        reviewed_by: row.reviewed_by,
        notes: row.notes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        position: (row as any).position || undefined,
      }));

      setApplications(mapped);
    } catch (err) {
      console.error('Error fetching student applications:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return { applications, loading, refetch: fetchApplications };
}
