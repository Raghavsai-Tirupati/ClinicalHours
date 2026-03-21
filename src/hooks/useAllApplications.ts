import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StudentApplication, ApplicationStatus, HospitalPosition } from '@/types/positions';

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
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
      const { data: posData, error: posError } = await supabase
        .from('hospital_positions')
        .select('*')
        .eq('hospital_page_id', hospitalPageId)
        .order('created_at', { ascending: false });

      if (posError) throw posError;
      const allPositions = (posData || []) as HospitalPosition[];
      setPositions(allPositions);

      if (allPositions.length === 0) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const positionIds = allPositions.map((p) => p.id);
      const { data: appData, error: appError } = await supabase
        .from('student_applications')
        .select('*')
        .in('position_id', positionIds)
        .order('submitted_at', { ascending: false });

      if (appError) throw appError;
      const apps = (appData || []) as StudentApplication[];

      if (apps.length > 0) {
        const studentIds = apps.map((a) => a.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, phone, resume_url, gpa, clinical_hours, research_experience')
          .in('id', studentIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const positionMap = new Map(allPositions.map((p) => [p.id, p]));

        for (const app of apps) {
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
        }
      }

      setApplications(apps);
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
              applications.filter((a) => ['accepted', 'rejected'].includes(a.status)).length) *
              100
          ) || 0
        : 0,
  };

  return { applications, positions, stats, loading, refetch: fetchAll };
}
