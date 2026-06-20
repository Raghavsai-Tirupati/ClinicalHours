import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CohortFilter } from '@/lib/analytics/cohortFilters';
import { cohortFilterToDisplay } from '@/lib/analytics/cohortFilters';

interface CohortBuilderProps {
  initial?: CohortFilter;
  presetName?: string;
  onRun: (filter: CohortFilter) => void;
  onSave?: (name: string, description: string, filter: CohortFilter) => void;
  running?: boolean;
}

export default function CohortBuilder({ initial, presetName, onRun, onSave, running }: CohortBuilderProps) {
  const [filter, setFilter] = useState<CohortFilter>(initial ?? {});
  const [saveName, setSaveName] = useState(presetName ?? '');
  const [saveDesc, setSaveDesc] = useState('');

  useEffect(() => {
    if (initial) setFilter(initial);
  }, [initial]);

  useEffect(() => {
    if (presetName) setSaveName(presetName);
  }, [presetName]);

  const setNum = (key: keyof CohortFilter, val: string) => {
    const n = val === '' ? undefined : Number(val);
    setFilter((f) => ({ ...f, [key]: n }));
  };

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Build cohort script</CardTitle>
        <p className="text-[10px] text-muted-foreground">Declarative filters — no AI, deterministic results</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">University contains</Label>
            <Input
              className="h-8 text-xs"
              value={filter.university_contains ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, university_contains: e.target.value || undefined }))}
              placeholder="e.g. Texas"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Graduation year</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              value={filter.graduation_year ?? ''}
              onChange={(e) => setNum('graduation_year', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Active within days</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              value={filter.last_active_within_days ?? ''}
              onChange={(e) => setNum('last_active_within_days', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Inactive for days (min)</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              value={filter.inactive_days_min ?? ''}
              onChange={(e) => setNum('inactive_days_min', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min saved opportunities</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              value={filter.saved_count_min ?? ''}
              onChange={(e) => setNum('saved_count_min', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min applications</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              value={filter.application_count_min ?? ''}
              onChange={(e) => setNum('application_count_min', e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {(
            [
              ['needs_attention', 'Needs attention'],
              ['onboarding_complete', 'Onboarding complete'],
              ['is_premium', 'Premium user'],
              ['applied', 'Has applied'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Switch
                id={key}
                checked={filter[key] === true}
                onCheckedChange={(checked) =>
                  setFilter((f) => ({ ...f, [key]: checked ? true : undefined }))
                }
              />
              <Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label>
            </div>
          ))}
        </div>

        {cohortFilterToDisplay(filter) && (
          <p className="text-[10px] text-muted-foreground border rounded-md p-2 bg-muted/30">
            {cohortFilterToDisplay(filter)}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onRun(filter)} disabled={running}>
            Run script
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFilter({})}>
            Clear
          </Button>
        </div>

        {onSave && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-medium">Save as custom script</p>
            <Input className="h-8 text-xs" placeholder="Script name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <Input className="h-8 text-xs" placeholder="Description (optional)" value={saveDesc} onChange={(e) => setSaveDesc(e.target.value)} />
            <Button
              size="sm"
              variant="secondary"
              disabled={!saveName.trim()}
              onClick={() => {
                onSave(saveName.trim(), saveDesc.trim(), filter);
                setSaveName('');
                setSaveDesc('');
              }}
            >
              Save script
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
