import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StudentApplication, ApplicationStatus } from '@/types/positions';

export function usePositionApplications(positionId: string | undefined) {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchApplications = useCallback(async () => {
    if (!positionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_applications')
        .select('*')
        .eq('position_id', positionId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const apps = (data || []) as StudentApplication[];
      const appIds = apps.map((a) => a.id);

      if (apps.length > 0) {
        const studentIds = apps.map((a) => a.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, phone, resume_url')
          .in('id', studentIds);

        const profileMap = new Map(
          (profiles || []).map((p) => [p.id, p])
        );

        for (const app of apps) {
          const profile = profileMap.get(app.student_id);
          if (profile) {
            const profileName = profile.full_name?.trim() || null;
            app.student_profile = {
              full_name: profileName,
              // We persist applicant_email directly on student_applications.
              email: app.applicant_email?.trim() || '',
              university: profile.university,
              major: profile.major,
              graduation_year: profile.graduation_year,
              phone: profile.phone,
              resume_url: profile.resume_url,
            };
            if (!app.applicant_name?.trim() && profileName) {
              app.applicant_name = profileName;
            }
          }
        }

        const { data: answerRows } = await supabase
          .from('application_answers')
          .select(`
            id,
            application_id,
            question_id,
            answer_text,
            answer_file_url,
            created_at,
            question:position_questions(
              id,
              question_text,
              question_type,
              is_required,
              display_order
            )
          `)
          .in('application_id', appIds);

        const answersByAppId = new Map<string, StudentApplication['answers']>();
        const questionIdsMissingText = new Set<string>();
        (answerRows || []).forEach((row) => {
          const appId = row.application_id as string;
          const question = Array.isArray(row.question) ? row.question[0] : row.question;
          if (row.question_id && (!question || !question.question_text)) {
            questionIdsMissingText.add(row.question_id as string);
          }
          const existing = answersByAppId.get(appId) || [];
          existing.push({
            id: row.id as string,
            application_id: row.application_id as string,
            question_id: row.question_id as string,
            answer_text: (row.answer_text as string | null) ?? null,
            answer_file_url: (row.answer_file_url as string | null) ?? null,
            created_at: row.created_at as string,
            question,
          });
          answersByAppId.set(appId, existing);
        });

        if (questionIdsMissingText.size > 0) {
          const { data: questions } = await supabase
            .from('position_questions')
            .select('id, question_text, question_type, is_required, display_order')
            .in('id', Array.from(questionIdsMissingText));
          const questionMap = new Map((questions || []).map((q) => [q.id, q]));
          answersByAppId.forEach((answers) => {
            answers?.forEach((answer) => {
              if (!answer.question?.question_text) {
                const fallbackQuestion = questionMap.get(answer.question_id);
                if (fallbackQuestion) answer.question = fallbackQuestion;
              }
            });
          });
        }

        apps.forEach((app) => {
          app.answers = answersByAppId.get(app.id) || [];
        });
      }

      setApplications(apps);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [positionId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Filtered applications
  const filtered = applications.filter((app) => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (searchTerm) {
      const name = (
        app.applicant_name?.trim() ||
        app.student_profile?.full_name?.trim() ||
        app.applicant_email?.split('@')[0] ||
        app.student_id
      ).toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    }
    return true;
  });

  return {
    applications: filtered,
    allApplications: applications,
    loading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    refetch: fetchApplications,
  };
}
