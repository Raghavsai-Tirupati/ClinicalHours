import { Play, Trash2, BookTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsCohort, CohortFilter } from '@/lib/analytics/cohortFilters';
import { cohortFilterToDisplay } from '@/lib/analytics/cohortFilters';

interface CohortScriptListProps {
  cohorts: AnalyticsCohort[];
  onRun: (filter: CohortFilter) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

export default function CohortScriptList({ cohorts, onRun, onDelete, loading }: CohortScriptListProps) {
  const templates = cohorts.filter((c) => c.is_template);
  const custom = cohorts.filter((c) => !c.is_template);

  const renderList = (items: AnalyticsCohort[], title: string) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">None yet.</p>
      ) : (
        items.map((c) => (
          <div key={c.id} className="flex items-start gap-2 rounded-md border border-border/60 p-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{c.name}</p>
                {c.is_template && (
                  <Badge variant="outline" className="text-[10px] gap-0.5">
                    <BookTemplate className="h-3 w-3" />
                    Template
                  </Badge>
                )}
              </div>
              {c.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
              )}
              <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">
                {cohortFilterToDisplay(c.filter_json)}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onRun(c.filter_json)}>
                <Play className="h-3 w-3 mr-1" />
                Run
              </Button>
              {!c.is_template && onDelete && (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Saved scripts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
        ) : (
          <>
            {renderList(templates, 'Templates')}
            {renderList(custom, 'Your scripts')}
          </>
        )}
      </CardContent>
    </Card>
  );
}
