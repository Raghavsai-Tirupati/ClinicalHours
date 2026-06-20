import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import StudentExplorerTable, { type StudentDirectoryUser } from '@/components/analytics/StudentExplorerTable';
import AnalyticsBackendBanner from '@/components/analytics/AnalyticsBackendBanner';
import { useAnalyticsBackendStatus } from '@/hooks/useAnalyticsBackendStatus';
import ExportButton from '@/components/analytics/ExportButton';
import { fetchAdminStudentSummaries, fetchStudentEmails } from '@/lib/analytics/api';
import { analyticsQueryKeys } from '@/hooks/useAnalyticsRealtime';

export default function StudentsPage() {
  const navigate = useNavigate();
  const { ready: backendReady } = useAnalyticsBackendStatus();

  const { data: summaries = [], isLoading } = useQuery({
    queryKey: analyticsQueryKeys.students(),
    queryFn: fetchAdminStudentSummaries,
  });

  const { data: emails = {} } = useQuery({
    queryKey: [...analyticsQueryKeys.students(), 'emails'],
    queryFn: () => fetchStudentEmails(summaries.map((s) => s.id).slice(0, 500)),
    enabled: summaries.length > 0,
  });

  const students: StudentDirectoryUser[] = useMemo(
    () => summaries.map((summary) => ({ summary, email: emails[summary.id] ?? '—' })),
    [summaries, emails]
  );

  const exportRows = students.map(({ summary, email }) => ({
    name: summary.full_name ?? '',
    email,
    university: summary.university ?? '',
    status: summary.attention_level,
    applications: summary.application_count,
    last_active: summary.last_active_at ?? '',
    joined: summary.joined_at,
  }));

  return (
    <div className="space-y-4">
      <AnalyticsBackendBanner show={backendReady === false} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-xs text-muted-foreground">Explore and export the full student roster</p>
        </div>
        <ExportButton
          rows={exportRows}
          filename="clinicalhours-students.csv"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'university', label: 'University' },
            { key: 'status', label: 'Status' },
            { key: 'applications', label: 'Applications' },
            { key: 'last_active', label: 'Last Active' },
            { key: 'joined', label: 'Joined' },
          ]}
        />
      </div>

      <StudentExplorerTable
        students={students}
        loading={isLoading}
        onSelectStudent={(s) => navigate(`/analytics/students/${s.summary.id}`)}
      />
    </div>
  );
}
