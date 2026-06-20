import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PromotionFunnel } from '@/lib/analytics/api';

interface PromotionFunnelProps {
  funnel: PromotionFunnel | null;
  loading?: boolean;
}

function pct(n: number, d: number) {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

export default function PromotionFunnelChart({ funnel, loading }: PromotionFunnelProps) {
  const steps = useMemo(() => {
    if (!funnel) return [];
    return [
      { label: 'Landing visitors', value: funnel.landing_visitors },
      { label: 'Guest sessions', value: funnel.guest_sessions },
      { label: 'Signups', value: funnel.signups },
      { label: 'Onboarding complete', value: funnel.onboarding_complete },
      { label: 'Saved ≥1 opp', value: funnel.saved_at_least_one },
      { label: 'Applied', value: funnel.applied },
      { label: 'Accepted', value: funnel.accepted },
    ];
  }, [funnel]);

  const max = steps[0]?.value ?? 1;

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Acquisition funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Loading funnel…</p>
        ) : !funnel ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No funnel data</p>
        ) : (
          <div className="space-y-2">
            {steps.map((step, i) => {
              const prev = i > 0 ? steps[i - 1].value : step.value;
              const width = max > 0 ? Math.max(4, (step.value / max) * 100) : 4;
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="tabular-nums font-medium">
                      {step.value.toLocaleString()}
                      {i > 0 && (
                        <span className="text-muted-foreground ml-1">({pct(step.value, prev)} from prev)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
