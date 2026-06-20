import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import CohortBuilder from '@/components/analytics/CohortBuilder';
import CohortScriptList from '@/components/analytics/CohortScriptList';
import ExportButton from '@/components/analytics/ExportButton';
import AnalyticsBackendBanner from '@/components/analytics/AnalyticsBackendBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchCohorts,
  runCohortFilter,
  saveCohort,
  deleteCohort,
} from '@/lib/analytics/api';
import type { CohortFilter, CohortRow } from '@/lib/analytics/cohortFilters';
import { analyticsQueryKeys } from '@/hooks/useAnalyticsRealtime';
import { useAnalyticsBackendStatus } from '@/hooks/useAnalyticsBackendStatus';
import { AttentionBadge } from '@/components/analytics/adminStatusBadges';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

type CohortLocationState = {
  presetFilter?: CohortFilter;
  presetName?: string;
};

export default function CohortsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = (location.state as CohortLocationState | null) ?? {};
  const queryClient = useQueryClient();
  const { ready: backendReady } = useAnalyticsBackendStatus();
  const [results, setResults] = useState<CohortRow[]>([]);
  const [running, setRunning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CohortFilter | null>(preset.presetFilter ?? null);
  const [presetName, setPresetName] = useState(preset.presetName ?? '');

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: analyticsQueryKeys.cohorts(),
    queryFn: fetchCohorts,
  });

  const handleRun = async (filter: CohortFilter) => {
    setRunning(true);
    setActiveFilter(filter);
    try {
      const rows = await runCohortFilter(filter, 200, 0);
      setResults(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run cohort');
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async (name: string, description: string, filter: CohortFilter) => {
    try {
      await saveCohort(name, description, filter);
      toast.success('Script saved');
      queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.cohorts() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCohort(id);
      queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.cohorts() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  useEffect(() => {
    if (preset.presetFilter) {
      setActiveFilter(preset.presetFilter);
      setPresetName(preset.presetName ?? '');
      void handleRun(preset.presetFilter);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <AnalyticsBackendBanner show={backendReady === false} />
      <div>
        <h1 className="text-xl font-semibold">Cohort Scripts</h1>
        <p className="text-xs text-muted-foreground">
          Build, save, and run deterministic filter scripts to segment students for outreach
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CohortBuilder
          onRun={handleRun}
          onSave={handleSave}
          running={running}
          initial={activeFilter ?? undefined}
          presetName={presetName}
        />
        <CohortScriptList cohorts={cohorts} onRun={handleRun} onDelete={handleDelete} loading={isLoading} />
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Results ({results.length})</CardTitle>
            <ExportButton
              rows={results as unknown as Record<string, unknown>[]}
              filename="cohort-results.csv"
              columns={[
                { key: 'full_name', label: 'Name' },
                { key: 'university', label: 'University' },
                { key: 'state', label: 'State' },
                { key: 'application_count', label: 'Applications' },
                { key: 'saved_count', label: 'Saved' },
                { key: 'last_active_at', label: 'Last Active' },
              ]}
            />
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
              {results.map((row) => (
                <div
                  key={row.id}
                  className="px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/analytics/students/${row.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{row.full_name ?? 'Unnamed'}</p>
                    <p className="text-muted-foreground truncate">{row.university ?? '—'}</p>
                  </div>
                  <AttentionBadge level={row.attention_level as 'green' | 'yellow' | 'red' | 'gray'} />
                  <span className="text-muted-foreground shrink-0">
                    {row.last_active_at
                      ? formatDistanceToNow(new Date(row.last_active_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
