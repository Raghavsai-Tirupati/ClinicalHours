import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AdminKPIGrid from './AdminKPIGrid';
import AdminAnalyticsFilters from './AdminAnalyticsFilters';
import AdminTrendCharts from './AdminTrendCharts';
import AdminStudentDirectory, { type StudentDirectoryUser } from './AdminStudentDirectory';
import AdminAttentionPanel from './AdminAttentionPanel';
import AdminUnifiedActivityFeed from './AdminUnifiedActivityFeed';
import AdminUserProfile from '../AdminUserProfile';
import {
  fetchAdminKPIs,
  fetchAdminTimeSeries,
  fetchAdminStudentSummaries,
  fetchClinicOptions,
  fetchStudentEmails,
  type AdminDashboardKPIs,
  type AdminStudentSummary,
  type TimeSeriesMetric,
  type TimeSeriesPoint,
  type ClinicOption,
} from '@/lib/analytics/api';
import { resolveAdminDateRange, type AdminTimeRange } from '@/lib/analytics/timeRanges';

interface ProfileUser {
  id: string;
  email: string;
  full_name: string;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  email_opt_in: boolean;
  email_verified: boolean;
  created_at: string;
}

export default function AdminAnalyticsCenter() {
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('30d');
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [kpis, setKpis] = useState<AdminDashboardKPIs | null>(null);
  const [series, setSeries] = useState<Partial<Record<TimeSeriesMetric, TimeSeriesPoint[]>>>({});
  const [summaries, setSummaries] = useState<AdminStudentSummary[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ProfileUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [backendReady, setBackendReady] = useState(true);

  const dateRange = useMemo(() => resolveAdminDateRange(timeRange), [timeRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setChartsLoading(true);
    try {
      const [kpiResult, summaryResult, clinicResult] = await Promise.allSettled([
        fetchAdminKPIs(dateRange.since, dateRange.until, clinicId),
        fetchAdminStudentSummaries(),
        fetchClinicOptions(),
      ]);

      if (kpiResult.status === 'fulfilled') {
        setKpis(kpiResult.value);
        setBackendReady(true);
      } else {
        setBackendReady(false);
        console.warn('Admin KPI RPC unavailable:', kpiResult.reason);
      }

      if (summaryResult.status === 'fulfilled') {
        setSummaries(summaryResult.value);
        const ids = summaryResult.value.map((s) => s.id);
        try {
          const emailMap = await fetchStudentEmails(ids.slice(0, 200));
          setEmails(emailMap);
        } catch {
          // emails optional for table display
        }
      } else {
        toast.error('Could not load student summaries. Run the latest database migration.');
      }

      if (clinicResult.status === 'fulfilled') {
        setClinics(clinicResult.value);
      }

      const metrics: TimeSeriesMetric[] = [
        'new_users',
        'active_users',
        'logins',
        'applications',
        'evaluations',
      ];

      const chartResults = await Promise.allSettled(
        metrics.map((metric) =>
          fetchAdminTimeSeries(
            metric,
            dateRange.since,
            dateRange.until,
            dateRange.granularity,
            clinicId
          ).then((data) => ({ metric, data }))
        )
      );

      const nextSeries: Partial<Record<TimeSeriesMetric, TimeSeriesPoint[]>> = {};
      chartResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          nextSeries[result.value.metric] = result.value.data;
        }
      });
      setSeries(nextSeries);
    } catch (err) {
      console.error(err);
      toast.error('Failed to refresh analytics');
    } finally {
      setLoading(false);
      setChartsLoading(false);
    }
  }, [dateRange, clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const directoryStudents: StudentDirectoryUser[] = useMemo(
    () =>
      summaries.map((summary) => ({
        summary,
        email: emails[summary.id] ?? '—',
      })),
    [summaries, emails]
  );

  const profileNames = useMemo(() => {
    const map: Record<string, string> = {};
    summaries.forEach((s) => {
      if (s.full_name) map[s.id] = s.full_name;
    });
    return map;
  }, [summaries]);

  const openStudentProfile = (student: StudentDirectoryUser) => {
    const s = student.summary;
    setSelectedUser({
      id: s.id,
      email: student.email !== '—' ? student.email : '',
      full_name: s.full_name ?? 'Unknown',
      university: s.university,
      major: s.major,
      graduation_year: s.graduation_year,
      city: null,
      state: null,
      phone: s.phone,
      clinical_hours: Number(s.volunteer_hours) || null,
      email_opt_in: false,
      email_verified: false,
      created_at: s.joined_at,
    });
    setProfileOpen(true);
  };

  const openStudentById = (id: string) => {
    const found = directoryStudents.find((s) => s.summary.id === id);
    if (found) openStudentProfile(found);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Student Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Volunteer pipeline, activity, and student health — {dateRange.label.toLowerCase()}
          </p>
          {!backendReady && (
            <p className="text-xs text-amber-600 mt-1">
              Analytics database migration pending — apply{' '}
              <code className="text-[10px]">20260618100000_admin_analytics.sql</code> for full KPIs
              and charts.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AdminAnalyticsFilters
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            clinicId={clinicId}
            onClinicChange={setClinicId}
            clinics={clinics}
          />
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <AdminKPIGrid kpis={kpis} loading={loading} />

      <AdminTrendCharts series={series} loading={chartsLoading} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminStudentDirectory
            students={directoryStudents}
            loading={loading}
            onSelectStudent={openStudentProfile}
          />
        </div>
        <div className="space-y-4">
          <AdminAttentionPanel students={summaries} onSelect={openStudentById} />
          <AdminUnifiedActivityFeed profileNames={profileNames} />
        </div>
      </div>

      <AdminUserProfile
        user={selectedUser}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}
