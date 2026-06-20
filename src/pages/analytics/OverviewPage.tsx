import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminKPIGrid from '@/components/analytics/AdminKPIGrid';
import AdminAnalyticsFilters from '@/components/analytics/AdminAnalyticsFilters';
import AdminTrendCharts from '@/components/analytics/AdminTrendCharts';
import AdminAttentionPanel from '@/components/analytics/AdminAttentionPanel';
import LiveEventsPanel from '@/components/analytics/LiveEventsPanel';
import PromotionFunnelChart from '@/components/analytics/PromotionFunnel';
import {
  fetchAdminKPIs,
  fetchAdminTimeSeries,
  fetchAdminStudentSummaries,
  fetchClinicOptions,
  fetchPromotionFunnel,
  type TimeSeriesMetric,
} from '@/lib/analytics/api';
import { resolveAdminDateRange, type AdminTimeRange } from '@/lib/analytics/timeRanges';
import { analyticsQueryKeys } from '@/hooks/useAnalyticsRealtime';
import { useNavigate } from 'react-router-dom';
import AnalyticsBackendBanner from '@/components/analytics/AnalyticsBackendBanner';
import { useAnalyticsBackendStatus } from '@/hooks/useAnalyticsBackendStatus';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { ready: backendReady } = useAnalyticsBackendStatus();
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('30d');
  const [clinicId, setClinicId] = useState<string | null>(null);
  const dateRange = useMemo(() => resolveAdminDateRange(timeRange), [timeRange]);

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: analyticsQueryKeys.kpis(dateRange.since.toISOString(), dateRange.until.toISOString(), clinicId),
    queryFn: () => fetchAdminKPIs(dateRange.since, dateRange.until, clinicId),
  });

  const { data: summaries = [], isLoading: studentsLoading } = useQuery({
    queryKey: analyticsQueryKeys.students(),
    queryFn: fetchAdminStudentSummaries,
  });

  const { data: clinics = [] } = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'clinics'],
    queryFn: fetchClinicOptions,
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: analyticsQueryKeys.funnel(dateRange.since.toISOString(), dateRange.until.toISOString()),
    queryFn: () => fetchPromotionFunnel(dateRange.since, dateRange.until),
  });

  const metrics: TimeSeriesMetric[] = ['new_users', 'active_users', 'logins', 'applications', 'evaluations'];

  const chartQueries = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'charts', timeRange, clinicId],
    queryFn: async () => {
      const results = await Promise.all(
        metrics.map(async (metric) => ({
          metric,
          data: await fetchAdminTimeSeries(metric, dateRange.since, dateRange.until, dateRange.granularity, clinicId),
        }))
      );
      return Object.fromEntries(results.map((r) => [r.metric, r.data]));
    },
  });

  const profileNames = useMemo(() => {
    const map: Record<string, string> = {};
    summaries.forEach((s) => { if (s.full_name && s.id) map[s.id] = s.full_name; });
    return map;
  }, [summaries]);

  const refresh = useCallback(() => {
    refetchKpis();
    chartQueries.refetch();
  }, [refetchKpis, chartQueries]);

  const loading = kpisLoading || studentsLoading;

  return (
    <div className="space-y-6">
      <AnalyticsBackendBanner show={backendReady === false} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Student growth pulse — {dateRange.label.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AdminAnalyticsFilters
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            clinicId={clinicId}
            onClinicChange={setClinicId}
            clinics={clinics}
          />
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <AdminKPIGrid kpis={kpis ?? null} loading={kpisLoading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PromotionFunnelChart funnel={funnel ?? null} loading={funnelLoading} />
        <LiveEventsPanel profileNames={profileNames} />
      </div>

      <AdminTrendCharts series={chartQueries.data ?? {}} loading={chartQueries.isLoading} />

      <AdminAttentionPanel
        students={summaries}
        onSelect={(id) => navigate(`/analytics/students/${id}`)}
      />
    </div>
  );
}
