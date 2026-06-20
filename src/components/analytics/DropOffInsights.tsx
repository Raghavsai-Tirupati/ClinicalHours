import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DropOffInsight } from '@/lib/analytics/engagement';

interface DropOffInsightsProps {
  insights: DropOffInsight[];
}

export default function DropOffInsights({ insights }: DropOffInsightsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Drop-off points → cohort scripts</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Jump to Cohort Scripts with a pre-filled filter for outreach
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-lg border border-border/60 p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium">{insight.label}</p>
              {insight.countHint != null && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  ~{insight.countHint}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{insight.description}</p>
            <Button variant="outline" size="sm" className="h-7 text-xs w-fit mt-auto" asChild>
              <Link
                to="/analytics/cohorts"
                state={{ presetFilter: insight.cohortFilter, presetName: insight.label }}
              >
                Save as cohort
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
