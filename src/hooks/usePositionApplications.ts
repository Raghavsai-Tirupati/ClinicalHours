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

      // Fetch profile info for each application
      const apps = (data || []) as StudentApplication[];

      if (apps.length > 0) {
        const studentIds = apps.map((a) => a.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, phone, resume_url')
          .in('id', studentIds);

        const { data: users } = await supabase
          .from('auth_user_emails' in {} ? 'auth_user_emails' : 'profiles')
          .select('id')
          .in('id', studentIds);

        // Map profiles to applications
        const profileMap = new Map(
          (profiles || []).map((p) => [p.id, p])
        );

        for (const app of apps) {
          const profile = profileMap.get(app.student_id);
          if (profile) {
            app.student_profile = {
              full_name: profile.full_name,
              email: '', // We'll leave this empty since we can't easily query auth.users
              university: profile.university,
              major: profile.major,
              graduation_year: profile.graduation_year,
              phone: profile.phone,
              resume_url: profile.resume_url,
            };
          }
        }
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
      const name = app.student_profile?.full_name?.toLowerCase() || '';
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
