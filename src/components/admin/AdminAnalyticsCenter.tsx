import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  RefreshCw,
  Users,
  UserPlus,
  Activity,
  LogIn,
  FileText,
  Clock,
  AlertTriangle,
  Star,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import {
  fetchAdminKpis,
  fetchAdminTimeSeries,
  fetchStudentSummaries,
  fetchUnifiedActivity,
  type TimeSeriesMetric,
  type StudentSummary,
} from '@/lib/admin/analytics';

type Range = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 };

function rangeBounds(range: Range): { since: string; until: string; granularity: 'day' | 'week' } {
  const until = new Date();
  const since = new Date(until.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    granularity: range === '90d' ? 'week' : 'day',
  };
}

const METRICS: { value: TimeSeriesMetric; label: string }[] = [
  { value: 'new_users', label: 'New Signups' },
  { value: 'active_users', label: 'Active Users' },
  { value: 'logins', label: 'Logins' },
  { value: 'applications', label: 'Applications' },
  { value: 'evaluations', label: 'Evaluations' },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

type SortKey = 'name' | 'hours' | 'applications' | 'last_active';

export default function AdminAnalyticsCenter() {
  const [range, setRange] = useState<Range>('30d');
  const [metric, setMetric] = useState<TimeSeriesMetric>('new_users');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_active');
  const [sortAsc, setSortAsc] = useState(false);

  const bounds = useMemo(() => rangeBounds(range), [range]);

  const kpis = useQuery({
    queryKey: ['admin-kpis', range],
    queryFn: () => fetchAdminKpis(bounds.since, bounds.until),
    staleTime: 60_000,
  });

  const series = useQuery({
    queryKey: ['admin-series', metric, range],
    queryFn: () => fetchAdminTimeSeries(metric, bounds.since, bounds.until, bounds.granularity),
    staleTime: 60_000,
  });

  const students = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => fetchStudentSummaries(300),
    staleTime: 60_000,
  });

  const activity = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => fetchUnifiedActivity(60),
    staleTime: 30_000,
  });

  const chartData = useMemo(
    () =>
      (series.data ?? []).map((p) => ({
        date: format(new Date(p.bucket), bounds.granularity === 'week' ? 'MMM d' : 'MMM d'),
        value: Number(p.value),
      })),
    [series.data, bounds.granularity]
  );

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = students.data ?? [];
    if (term) {
      rows = rows.filter((s) =>
        [s.full_name, s.university, s.major, s.city, s.state]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term))
      );
    }
    const dir = sortAsc ? 1 : -1;
    const val = (s: StudentSummary): number | string => {
      switch (sortKey) {
        case 'name':
          return (s.full_name ?? '').toLowerCase();
        case 'hours':
          return Number(s.clinical_hours ?? 0);
        case 'applications':
          return Number(s.application_count ?? 0);
        case 'last_active':
          return s.last_active_at ? new Date(s.last_active_at).getTime() : 0;
      }
    };
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [students.data, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const refreshAll = () => {
    kpis.refetch();
    series.refetch();
    students.refetch();
    activity.refetch();
  };

  const k = kpis.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Student Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Engagement, applications, and activity across the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {kpis.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : kpis.error ? (
        <p className="text-sm text-destructive">Failed to load metrics: {(kpis.error as Error).message}</p>
      ) : k ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <KpiCard icon={Users} label="Total Students" value={k.total_students} accent="bg-primary/10 text-primary" />
          <KpiCard icon={UserPlus} label="New (range)" value={k.new_students} accent="bg-emerald-500/10 text-emerald-400" />
          <KpiCard icon={Activity} label="Active (7d)" value={k.active_students_week} accent="bg-blue-500/10 text-blue-400" />
          <KpiCard icon={LogIn} label="Logins (range)" value={k.logins} accent="bg-violet-500/10 text-violet-400" />
          <KpiCard icon={FileText} label="Applications" value={k.total_applications} accent="bg-amber-500/10 text-amber-400" sub={`${k.pending_applications} pending`} />
          <KpiCard icon={Star} label="Avg Evaluation" value={k.avg_evaluation_score ?? '—'} accent="bg-yellow-500/10 text-yellow-400" sub={`${k.evaluations} scored`} />
          <KpiCard icon={Clock} label="Active (range)" value={k.active_students_window} accent="bg-cyan-500/10 text-cyan-400" />
          <KpiCard icon={AlertTriangle} label="Need Attention" value={k.students_needing_attention} accent="bg-red-500/10 text-red-400" sub="14d+ inactive" />
        </div>
      ) : null}

      {/* Time series */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">Trend</CardTitle>
          <Select value={metric} onValueChange={(v) => setMetric(v as TimeSeriesMetric)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {series.isLoading ? (
            <div className="flex h-[240px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-xs text-muted-foreground">No data in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#metricFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Student table */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Students</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, school, city…"
                  className="h-8 w-[220px] pl-7 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {students.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                        <span className="flex items-center gap-1">Student <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('hours')}>
                        <span className="flex items-center justify-end gap-1">Hours <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('applications')}>
                        <span className="flex items-center justify-end gap-1">Apps <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('last_active')}>
                        <span className="flex items-center justify-end gap-1">Last active <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                          No students found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{s.full_name ?? 'Unnamed'}</span>
                              {s.is_premium && <Badge variant="outline" className="h-4 px-1 text-[9px]">PRO</Badge>}
                              {s.attention_level === 'high' && (
                                <Badge variant="destructive" className="h-4 px-1 text-[9px]">!</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {[s.university, s.major].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{s.clinical_hours ?? 0}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {s.application_count ?? 0}
                            {(s.pending_application_count ?? 0) > 0 && (
                              <span className="ml-1 text-[10px] text-amber-400">({s.pending_application_count})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-[11px] text-muted-foreground">
                            {s.last_active_at ? formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true }) : 'never'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Unified activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activity.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (activity.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No recent activity.</p>
            ) : (
              <ScrollArea className="h-[480px]">
                <div className="divide-y divide-border/40">
                  {(activity.data ?? []).map((a) => (
                    <div key={a.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                          {a.source ?? 'event'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-1 text-xs">
                        <span className="font-medium">{a.actor_email ?? 'System'}</span>{' '}
                        <span className="text-muted-foreground">{(a.event_type ?? '').replace(/_/g, ' ')}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}