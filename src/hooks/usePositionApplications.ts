import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getResumeUrlFromApplication } from '@/lib/applicationFilters';
import type { StudentApplication, ApplicationStatus, HospitalPosition } from '@/types/positions';

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
};

export type ApplicationSortOption =
  | 'submitted_desc'
  | 'submitted_asc'
  | 'gpa_desc'
  | 'clinical_hours_desc'
  | 'experience_desc'
  | 'resume_readiness_desc'
  | 'name_asc';

const EXPERIENCE_KEYWORDS = [
  'experience',
  'volunteer',
  'clinical',
  'shadow',
  'intern',
  'research',
  'patient',
  'care',
  'hours',
];

const scoreResumeReadiness = (app: StudentApplication): number => {
  const profile = app.student_profile;
  const normalizedGpa = typeof profile?.gpa === 'number' ? Math.max(0, Math.min(4, profile.gpa)) : 0;
  const normalizedHours = typeof profile?.clinical_hours === 'number' ? Math.max(0, Math.min(300, profile.clinical_hours)) : 0;
  const hasResume = !!getResumeUrlFromApplication(app);
  const hasExperienceSummary = !!profile?.research_experience?.trim();
  const answerTextBlob = (app.answers || [])
    .map((answer) => answer.answer_text || '')
    .join(' ')
    .toLowerCase();
  const keywordMatches = EXPERIENCE_KEYWORDS.reduce(
    (count, keyword) => count + (answerTextBlob.includes(keyword) ? 1 : 0),
    0,
  );

  return (
    normalizedGpa * 15 +
    normalizedHours * 0.12 +
    (hasResume ? 20 : 0) +
    (hasExperienceSummary ? 8 : 0) +
    Math.min(12, keywordMatches * 2)
  );
};

const scoreExperienceDepth = (app: StudentApplication): number => {
  const profile = app.student_profile;
  const clinicalHours = typeof profile?.clinical_hours === 'number' ? Math.max(0, profile.clinical_hours) : 0;
  const researchSummaryLength = profile?.research_experience?.trim().length || 0;
  const answerLength = (app.answers || []).reduce((total, answer) => total + (answer.answer_text?.trim().length || 0), 0);

  return clinicalHours + Math.min(250, researchSummaryLength / 3) + Math.min(250, answerLength / 15);
};

const getApplicantSortName = (app: StudentApplication): string => {
  const fallbackName = app.applicant_email?.split('@')[0] || app.student_id;
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    fallbackName
  ).toLowerCase();
};

export function usePositionApplications(positionId: string | undefined) {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<ApplicationSortOption>('submitted_desc');

  const fetchApplications = useCallback(async () => {
    if (!positionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: positionData, error: positionError } = await supabase
        .from('hospital_positions')
        .select('*')
        .eq('id', positionId)
        .maybeSingle();
      if (positionError) throw positionError;
      const position = (positionData as HospitalPosition | null) ?? null;

      const { data, error } = await supabase
        .from('student_applications')
        .select('*')
        .eq('position_id', positionId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const apps = (data || []) as StudentApplication[];
      const appIds = apps.map((a) => a.id);
      apps.forEach((app) => {
        app.position = position ?? undefined;
      });

      if (apps.length > 0) {
        const studentIds = apps.map((a) => a.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, phone, resume_url, gpa, clinical_hours, research_experience, avatar_url')
          .in('id', studentIds);

        const profileMap = new Map(
          (profiles || []).map((p) => [p.id, p])
        );

        for (const app of apps) {
          const profile = profileMap.get(app.student_id);
          if (profile) {
            const profileName = normalizeDisplayName(profile.full_name);
            app.student_profile = {
              full_name: profileName,
              // We persist applicant_email directly on student_applications.
              email: app.applicant_email?.trim() || '',
              university: profile.university,
              major: profile.major,
              graduation_year: profile.graduation_year,
              phone: profile.phone,
              resume_url: profile.resume_url,
              gpa: profile.gpa,
              clinical_hours: profile.clinical_hours,
              research_experience: profile.research_experience,
              avatar_url: profile.avatar_url,
            };
            if (!normalizeDisplayName(app.applicant_name) && profileName) {
              app.applicant_name = profileName;
            }
          }
        }

        const { data: answerRows, error: answersError } = await supabase
          .from('application_answers')
          .select(`
            id,
            application_id,
            question_id,
            answer_text,
            answer_options,
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

        if (answersError) {
          console.error('Failed to fetch application answers:', answersError);
        }

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
            answer_options: (row.answer_options as string[] | null) ?? null,
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

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'submitted_asc') {
      return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
    }
    if (sortBy === 'submitted_desc') {
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    }
    if (sortBy === 'gpa_desc') {
      const gpaA = a.student_profile?.gpa ?? -1;
      const gpaB = b.student_profile?.gpa ?? -1;
      return gpaB - gpaA;
    }
    if (sortBy === 'clinical_hours_desc') {
      const hoursA = a.student_profile?.clinical_hours ?? -1;
      const hoursB = b.student_profile?.clinical_hours ?? -1;
      return hoursB - hoursA;
    }
    if (sortBy === 'experience_desc') {
      return scoreExperienceDepth(b) - scoreExperienceDepth(a);
    }
    if (sortBy === 'resume_readiness_desc') {
      return scoreResumeReadiness(b) - scoreResumeReadiness(a);
    }
    return getApplicantSortName(a).localeCompare(getApplicantSortName(b));
  });

  /** Optimistically patch a single application in local state (no refetch). */
  const updateApplicationLocally = useCallback(
    (appId: string, patch: Partial<StudentApplication>) => {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, ...patch } : a)),
      );
    },
    [],
  );

  return {
    applications: sorted,
    allApplications: applications,
    loading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    refetch: fetchApplications,
    updateApplicationLocally,
  };
}
