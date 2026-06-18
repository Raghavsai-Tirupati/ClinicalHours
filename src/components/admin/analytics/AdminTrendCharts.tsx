import { useMemo } from 'react';
import { format } from 'date-fns';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { TimeSeriesPoint, TimeSeriesMetric } from '@/lib/admin/analytics';

const METRIC_CONFIG: Record<
  TimeSeriesMetric,
  { title: string; color: string; label: string }
> = {
  new_users: { title: 'New users', color: 'hsl(var(--primary))', label: 'Signups' },
  active_users: { title: 'Active users', color: 'hsl(142 76% 36%)', label: 'Active' },
  logins: { title: 'Logins', color: 'hsl(199 89% 48%)', label: 'Logins' },
  applications: { title: 'Applications submitted', color: 'hsl(262 83% 58%)', label: 'Applications' },
  evaluations: { title: 'Evaluations completed', color: 'hsl(38 92% 50%)', label: 'Evaluations' },
  avg_evaluation_score: { title: 'Avg evaluation score', color: 'hsl(24 95% 53%)', label: 'Avg score' },
};

interface AdminTrendChartsProps {
  series: Partial<Record<TimeSeriesMetric, TimeSeriesPoint[]>>;
  loading?: boolean;
}

function SingleChart({
  metric,
  data,
  loading,
}: {
  metric: TimeSeriesMetric;
  data: TimeSeriesPoint[];
  loading?: boolean;
}) {
  const config = METRIC_CONFIG[metric];
  const chartConfig: ChartConfig = {
    value: { label: config.label, color: config.color },
  };

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: format(new Date(d.bucket), 'MMM d'),
        value: d.value,
      })),
    [data]
  );

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
            Loading chart…
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full aspect-auto">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                fill="var(--color-value)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminTrendCharts({ series, loading }: AdminTrendChartsProps) {
  const metrics: TimeSeriesMetric[] = [
    'new_users',
    'active_users',
    'logins',
    'applications',
    'evaluations',
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <SingleChart
          key={metric}
          metric={metric}
          data={series[metric] ?? []}
          loading={loading}
        />
      ))}
    </div>
  );
}
