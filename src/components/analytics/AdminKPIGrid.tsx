import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  UserCheck,
  UserPlus,
  FileText,
  Calendar,
  Star,
  AlertTriangle,
  LogIn,
  Send,
} from 'lucide-react';
import type { AdminDashboardKPIs } from '@/lib/analytics/api';
import { cn } from '@/lib/utils';

interface KPIConfig {
  key: keyof AdminDashboardKPIs;
  label: string;
  icon: React.ElementType;
  color: string;
  format?: (v: number | null) => string;
}

const KPI_CONFIG: KPIConfig[] = [
  { key: 'total_students', label: 'Total students', icon: Users, color: 'text-blue-500' },
  { key: 'active_students_week', label: 'Active this week', icon: UserCheck, color: 'text-emerald-500' },
  { key: 'new_students_month', label: 'New this month', icon: UserPlus, color: 'text-violet-500' },
  { key: 'pending_applications', label: 'Pending applications', icon: FileText, color: 'text-amber-500' },
  { key: 'upcoming_interviews', label: 'Upcoming interviews', icon: Calendar, color: 'text-cyan-500' },
  { key: 'evaluations_completed', label: 'Evaluations done', icon: Star, color: 'text-yellow-500' },
  {
    key: 'avg_evaluation_score',
    label: 'Avg eval score',
    icon: Star,
    color: 'text-orange-500',
    format: (v) => (v != null ? v.toFixed(1) : '—'),
  },
  { key: 'students_needing_attention', label: 'Need attention', icon: AlertTriangle, color: 'text-red-500' },
  { key: 'logins_in_range', label: 'Logins (range)', icon: LogIn, color: 'text-sky-500' },
  { key: 'applications_in_range', label: 'Applications (range)', icon: Send, color: 'text-indigo-500' },
];

interface AdminKPIGridProps {
  kpis: AdminDashboardKPIs | null;
  loading?: boolean;
}

export default function AdminKPIGrid({ kpis, loading }: AdminKPIGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {KPI_CONFIG.map(({ key, label, icon: Icon, color, format }) => {
        const raw = kpis?.[key];
        const display =
          format != null
            ? format(typeof raw === 'number' ? raw : null)
            : raw != null
              ? String(raw)
              : '—';

        return (
          <Card key={key} className="bg-card/80 border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                  <p
                    className={cn(
                      'text-2xl font-bold mt-1 tabular-nums',
                      loading && 'animate-pulse text-muted-foreground'
                    )}
                  >
                    {loading ? '…' : display}
                  </p>
                </div>
                <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', color)} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
