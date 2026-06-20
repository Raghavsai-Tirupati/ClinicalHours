import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PremiumStatsProps {
  premium: number;
  free: number;
  loading?: boolean;
}

export default function PremiumStatsCard({ premium, free, loading }: PremiumStatsProps) {
  const total = premium + free;
  const rate = total ? Math.round((premium / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Premium conversion</CardTitle>
        <p className="text-[11px] text-muted-foreground">Active premium vs free student accounts</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{rate}%</p>
              <p className="text-[11px] text-muted-foreground">conversion rate</p>
            </div>
            <div className="text-xs space-y-1 ml-auto text-right">
              <p><span className="font-medium tabular-nums">{premium}</span> premium</p>
              <p className="text-muted-foreground"><span className="tabular-nums">{free}</span> free</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
