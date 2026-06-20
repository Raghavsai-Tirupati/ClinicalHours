import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminAnalyticsFilters from '@/components/analytics/AdminAnalyticsFilters';
import AdminTrendCharts from '@/components/analytics/AdminTrendCharts';
import PromotionFunnelChart from '@/components/analytics/PromotionFunnel';
import ExportButton from '@/components/analytics/ExportButton';
import {
  fetchPromotionFunnel,
  fetchAdminTimeSeries,
  fetchUniversityBreakdown,
  fetchStateBreakdown,
  fetchClinicOptions,
  fetchAdminStudentSummaries,
  fetchPremiumStats,
  type TimeSeriesMetric,
} from '@/lib/analytics/api';
import { resolveAdminDateRange, type AdminTimeRange } from '@/lib/analytics/timeRanges';
import { computeDropOffInsights, computeEngagementTiers } from '@/lib/analytics/engagement';
import { analyticsQueryKeys } from '@/hooks/useAnalyticsRealtime';
import AnalyticsBackendBanner from '@/components/analytics/AnalyticsBackendBanner';
import { useAnalyticsBackendStatus } from '@/hooks/useAnalyticsBackendStatus';
import EngagementTierChart from '@/components/analytics/EngagementTierChart';
import PremiumStatsCard from '@/components/analytics/PremiumStatsCard';
import DropOffInsights from '@/components/analytics/DropOffInsights';

export default function ReportsPage() {
  const { ready: backendReady } = useAnalyticsBackendStatus();
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('30d');
  const [clinicId, setClinicId] = useState<string | null>(null);
  const dateRange = useMemo(() => resolveAdminDateRange(timeRange), [timeRange]);

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: analyticsQueryKeys.funnel(dateRange.since.toISOString(), dateRange.until.toISOString()),
    queryFn: () => fetchPromotionFunnel(dateRange.since, dateRange.until),
  });

  const { data: universities = [] } = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'universities'],
    queryFn: fetchUniversityBreakdown,
  });

  const { data: states = [] } = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'states'],
    queryFn: fetchStateBreakdown,
  });

  const { data: clinics = [] } = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'clinics'],
    queryFn: fetchClinicOptions,
  });

  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: analyticsQueryKeys.students(),
    queryFn: fetchAdminStudentSummaries,
  });

  const { data: premiumStats, isLoading: premiumLoading } = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'premium-stats'],
    queryFn: fetchPremiumStats,
  });

  const engagementTiers = useMemo(() => computeEngagementTiers(summaries), [summaries]);
  const dropOffInsights = useMemo(
    () => computeDropOffInsights(funnel ?? null, summaries),
    [funnel, summaries]
  );

  const metrics: TimeSeriesMetric[] = ['new_users', 'active_users', 'logins', 'applications'];

  const { data: series = {}, isLoading: chartsLoading } = useQuery({
    queryKey: [...analyticsQueryKeys.all, 'report-charts', timeRange],
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

  return (
    <div className="space-y-6">
      <AnalyticsBackendBanner show={backendReady === false} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Promotion Reports</h1>
          <p className="text-xs text-muted-foreground">Deterministic growth reports for student outreach</p>
        </div>
        <AdminAnalyticsFilters
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          clinicId={clinicId}
          onClinicChange={setClinicId}
          clinics={clinics}
        />
      </div>

      <PromotionFunnelChart funnel={funnel ?? null} loading={funnelLoading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <EngagementTierChart tiers={engagementTiers} loading={summariesLoading} />
        <PremiumStatsCard
          premium={premiumStats?.premium ?? 0}
          free={premiumStats?.free ?? 0}
          loading={premiumLoading}
        />
      </div>

      <DropOffInsights insights={dropOffInsights} />

      <AdminTrendCharts series={series} loading={chartsLoading} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Top universities</CardTitle>
            <ExportButton rows={universities} filename="universities.csv" columns={[
              { key: 'university', label: 'University' },
              { key: 'count', label: 'Students' },
            ]} />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {universities.map((u) => (
                <div key={u.university} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="truncate mr-2">{u.university}</span>
                  <span className="font-medium tabular-nums shrink-0">{u.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Students by state</CardTitle>
            <ExportButton rows={states} filename="states.csv" columns={[
              { key: 'state', label: 'State' },
              { key: 'count', label: 'Students' },
            ]} />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {states.map((s) => (
                <div key={s.state} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span>{s.state}</span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
