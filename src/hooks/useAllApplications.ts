import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StudentApplication, ApplicationStatus, HospitalPosition, QuestionType } from '@/types/positions';

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
};

// Map hospital_applications status strings to StudentApplication status
const LEGACY_STATUS_MAP: Record<string, ApplicationStatus> = {
  submitted: 'new',
  in_review: 'under_review',
  accepted: 'accepted',
  rejected: 'rejected',
};

export function useAllApplications(hospitalPageId: string | undefined) {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [positions, setPositions] = useState<HospitalPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!hospitalPageId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // ── 1. New system: hospital_positions → student_applications ─────────────
      const { data: posData, error: posError } = await supabase
        .from('hospital_positions')
        .select('*')
        .eq('hospital_page_id', hospitalPageId)
        .order('created_at', { ascending: false });

      if (posError) throw posError;
      const allPositions = (posData || []) as HospitalPosition[];
      console.log('[useAllApplications] hospitalPageId=', hospitalPageId, 'positions=', allPositions.length);
      setPositions(allPositions);

      let newSystemApps: StudentApplication[] = [];

      if (allPositions.length > 0) {
        const positionIds = allPositions.map((p) => p.id);
        const { data: appData, error: appError } = await supabase
          .from('student_applications')
          .select('*')
          .in('position_id', positionIds)
          .order('submitted_at', { ascending: false });

        if (appError) throw appError;
        newSystemApps = (appData || []) as StudentApplication[];
        console.log('[useAllApplications] new-system apps=', newSystemApps.length);
      }

      // ── 2. Legacy system: hospital_applications via hospital_accounts ─────────
      // hospital_pages.hospital_id → opportunities.id
      // opportunities.hospital_id → hospital_accounts.hospital_id → hospital_accounts.id
      let legacyApps: StudentApplication[] = [];
      let legacyQuestions: { id: string; question_text: string; question_type: string; is_required: boolean; display_order: number }[] = [];

      const { data: pageData, error: pageDataError } = await supabase
        .from('hospital_pages')
        .select('hospital_id')
        .eq('id', hospitalPageId)
        .maybeSingle();

      console.log('[useAllApplications] legacy chain: pageData=', pageData, 'error=', pageDataError);

      if (pageData?.hospital_id) {
        // hospital_pages.hospital_id = opportunities.id
        const { data: oppData } = await supabase
          .from('opportunities')
          .select('hospital_id')
          .eq('id', pageData.hospital_id)
          .maybeSingle();

        console.log('[useAllApplications] legacy chain: oppData=', oppData);

        if (oppData?.hospital_id) {
          // oppData.hospital_id = hospitals.id = hospital_accounts.hospital_id
          const { data: accountData } = await supabase
            .from('hospital_accounts')
            .select('id')
            .eq('hospital_id', oppData.hospital_id)
            .maybeSingle();

          console.log('[useAllApplications] legacy chain: accountData=', accountData);

          if (accountData?.id) {
            const [legacyAppsRes, legacyQsRes] = await Promise.all([
              supabase
                .from('hospital_applications')
                .select('id, account_id, applicant_name, applicant_email, status, submitted_at, student_id, opportunity_id')
                .eq('account_id', accountData.id)
                .order('submitted_at', { ascending: false }),
              supabase
                .from('hospital_application_questions')
                .select('id, question_text, type, required, order_index')
                .eq('account_id', accountData.id)
                .order('order_index'),
            ]);

            console.log('[useAllApplications] legacy apps:', legacyAppsRes.data?.length, 'error:', legacyAppsRes.error);
            console.log('[useAllApplications] legacy questions:', legacyQsRes.data?.length, 'error:', legacyQsRes.error);

            legacyQuestions = (legacyQsRes.data || []).map((q: any) => ({
              id: q.id,
              question_text: q.question_text,
              question_type: q.type,
              is_required: q.required,
              display_order: q.order_index,
            }));

            if (legacyAppsRes.data && legacyAppsRes.data.length > 0) {
              // Fetch answers for all legacy apps
              const legacyAppIds = legacyAppsRes.data.map((a: any) => a.id);
              const { data: legacyAnswerRows, error: legacyAnswerError } = await supabase
                .from('hospital_application_answers')
                .select('id, application_id, question_id, answer_text, answer_options')
                .in('application_id', legacyAppIds);

              console.log('[useAllApplications] legacy answers:', legacyAnswerRows?.length, 'error:', legacyAnswerError);

              const answersByAppId = new Map<string, StudentApplication['answers']>();
              const questionMap = new Map(legacyQuestions.map((q) => [q.id, q]));

              (legacyAnswerRows || []).forEach((row: any) => {
                const q = questionMap.get(row.question_id);
                const existing = answersByAppId.get(row.application_id) || [];
                existing.push({
                  id: row.id,
                  application_id: row.application_id,
                  question_id: row.question_id,
                  answer_text: row.answer_text ?? null,
                  answer_options: row.answer_options ?? null,
                  answer_file_url: null,
                  created_at: '',
                  question: q
                    ? { id: q.id, question_text: q.question_text, question_type: q.question_type as QuestionType, is_required: q.is_required, display_order: q.display_order }
                    : undefined,
                });
                answersByAppId.set(row.application_id, existing);
              });

              legacyApps = (legacyAppsRes.data as any[]).map((ha) => ({
                id: ha.id,
                position_id: ha.opportunity_id ?? '',
                student_id: ha.student_id ?? '',
                status: (LEGACY_STATUS_MAP[ha.status] ?? 'new') as ApplicationStatus,
                submitted_at: ha.submitted_at,
                reviewed_at: null,
                reviewed_by: null,
                notes: null,
                applicant_name: normalizeDisplayName(ha.applicant_name) ?? undefined,
                applicant_email: ha.applicant_email ?? undefined,
                answers: answersByAppId.get(ha.id) || [],
                _isLegacy: true,
              } as StudentApplication & { _isLegacy?: boolean }));
            }
          }
        }
      }

      // ── 3. Enrich new system apps with profiles + answers ────────────────────
      const allApps = [...newSystemApps, ...legacyApps];
      const allStudentIds = [...new Set(allApps.map((a) => a.student_id).filter(Boolean))];
      const profileMap = new Map<string, any>();

      if (allStudentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, phone, resume_url, gpa, clinical_hours, research_experience')
          .in('id', allStudentIds);
        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
      }

      const positionMap = new Map(allPositions.map((p) => [p.id, p]));

      // Enrich new-system apps (student_applications)
      if (newSystemApps.length > 0) {
        const appIds = newSystemApps.map((a) => a.id);
        const { data: answerRows, error: answersError } = await supabase
          .from('application_answers')
          .select(`
            id, application_id, question_id, answer_text, answer_options, answer_file_url, created_at,
            question:position_questions(id, question_text, question_type, is_required, display_order)
          `)
          .in('application_id', appIds);

        if (answersError) {
          console.error('Failed to fetch application answers:', answersError);
        }

        const answersByAppId = new Map<string, StudentApplication['answers']>();
        const questionIdsMissingText = new Set<string>();

        (answerRows || []).forEach((row: any) => {
          const appId = row.application_id as string;
          const question = Array.isArray(row.question) ? row.question[0] : row.question;
          if (row.question_id && (!question || !question.question_text)) {
            questionIdsMissingText.add(row.question_id as string);
          }
          const existing = answersByAppId.get(appId) || [];
          existing.push({
            id: row.id,
            application_id: row.application_id,
            question_id: row.question_id,
            answer_text: row.answer_text ?? null,
            answer_options: (row.answer_options as string[] | null) ?? null,
            answer_file_url: row.answer_file_url ?? null,
            created_at: row.created_at,
            question,
          });
          answersByAppId.set(appId, existing);
        });

        if (questionIdsMissingText.size > 0) {
          const { data: questions } = await supabase
            .from('position_questions')
            .select('id, question_text, question_type, is_required, display_order')
            .in('id', Array.from(questionIdsMissingText));
          const qMap = new Map((questions || []).map((q: any) => [q.id, q]));
          answersByAppId.forEach((answers) => {
            answers?.forEach((answer) => {
              if (!answer.question?.question_text) {
                const fallback = qMap.get(answer.question_id);
                if (fallback) answer.question = fallback;
              }
            });
          });
        }

        newSystemApps.forEach((app) => {
          app.position = positionMap.get(app.position_id);
          const profile = profileMap.get(app.student_id);
          if (profile) {
            const profileName = normalizeDisplayName(profile.full_name);
            app.student_profile = {
              full_name: profileName,
              email: app.applicant_email?.trim() || '',
              university: profile.university,
              major: profile.major,
              graduation_year: profile.graduation_year,
              phone: profile.phone,
              resume_url: profile.resume_url,
              gpa: profile.gpa,
              clinical_hours: profile.clinical_hours,
              research_experience: profile.research_experience,
            };
            if (!normalizeDisplayName(app.applicant_name) && profileName) {
              app.applicant_name = profileName;
            }
          }
          app.answers = answersByAppId.get(app.id) || [];
        });
      }

      // Enrich legacy apps with profiles
      legacyApps.forEach((app) => {
        if (!app.student_id) return;
        const profile = profileMap.get(app.student_id);
        if (profile) {
          const profileName = normalizeDisplayName(profile.full_name);
          app.student_profile = {
            full_name: profileName,
            email: app.applicant_email?.trim() || '',
            university: profile.university,
            major: profile.major,
            graduation_year: profile.graduation_year,
            phone: profile.phone,
            resume_url: profile.resume_url,
            gpa: profile.gpa,
            clinical_hours: profile.clinical_hours,
            research_experience: profile.research_experience,
          };
          if (!normalizeDisplayName(app.applicant_name) && profileName) {
            app.applicant_name = profileName;
          }
        }
      });

      // Combined: new system first (most recent), then legacy
      setApplications([...newSystemApps, ...legacyApps]);
    } catch (err) {
      console.error('Failed to fetch all applications:', err);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalPageId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const stats = {
    total: applications.length,
    new: applications.filter((a) => a.status === 'new').length,
    underReview: applications.filter((a) => a.status === 'under_review').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
    waitlisted: applications.filter((a) => a.status === 'waitlisted').length,
    acceptanceRate:
      applications.length > 0
        ? Math.round(
            (applications.filter((a) => a.status === 'accepted').length /
              Math.max(applications.filter((a) => ['accepted', 'rejected'].includes(a.status)).length, 1)) *
              100
          )
        : 0,
  };

  return { applications, positions, stats, loading, refetch: fetchAll };
}
