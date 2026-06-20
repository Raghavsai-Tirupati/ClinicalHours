import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ExportButton from '@/components/analytics/ExportButton';
import type { EngagementTierRow } from '@/lib/analytics/engagement';

interface EngagementTierChartProps {
  tiers: EngagementTierRow[];
  loading?: boolean;
}

const TIER_COLORS: Record<string, string> = {
  power: 'bg-emerald-500',
  active: 'bg-blue-500',
  cooling: 'bg-amber-500',
  dormant: 'bg-orange-500/70',
  never: 'bg-muted-foreground/40',
};

export default function EngagementTierChart({ tiers, loading }: EngagementTierChartProps) {
  const total = tiers.reduce((sum, t) => sum + t.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-medium">Engagement tiers</CardTitle>
          <p className="text-[11px] text-muted-foreground">Based on last activity and login frequency</p>
        </div>
        <ExportButton
          rows={tiers}
          filename="engagement-tiers.csv"
          columns={[
            { key: 'label', label: 'Tier' },
            { key: 'count', label: 'Students' },
            { key: 'description', label: 'Definition' },
          ]}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground py-4">Loading…</p>
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No student data yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {tiers.map((t) =>
                t.count > 0 ? (
                  <div
                    key={t.tier}
                    className={TIER_COLORS[t.tier]}
                    style={{ width: `${(t.count / total) * 100}%` }}
                    title={`${t.label}: ${t.count}`}
                  />
                ) : null
              )}
            </div>
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.tier} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${TIER_COLORS[t.tier]}`} />
                    <span className="truncate">{t.label}</span>
                  </div>
                  <span className="font-medium tabular-nums shrink-0 ml-2">
                    {t.count}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({total ? Math.round((t.count / total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
