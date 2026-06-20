import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchStudentBundle, fetchStudentEmails } from '@/lib/analytics/api';
import { analyticsQueryKeys } from '@/hooks/useAnalyticsRealtime';
import ExportButton from '@/components/analytics/ExportButton';
import { exportJson } from '@/lib/analytics/exportCsv';
import { formatDistanceToNow } from 'date-fns';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  const { data: bundle, isLoading, error } = useQuery({
    queryKey: analyticsQueryKeys.student(id!),
    queryFn: () => fetchStudentBundle(id!),
    enabled: !!id,
  });

  const { data: emails = {} } = useQuery({
    queryKey: [...analyticsQueryKeys.student(id!), 'email'],
    queryFn: () => fetchStudentEmails([id!]),
    enabled: !!id,
  });

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-sm text-destructive">Could not load student data.</p>
        <Button variant="outline" onClick={() => navigate('/analytics/students')}>Back to students</Button>
      </div>
    );
  }

  const profile = bundle.profile as Record<string, unknown> | null;
  const summary = bundle.summary as Record<string, unknown> | null;
  const email = emails[id] ?? '—';

  const sections: { key: string; label: string; data: unknown[] | Record<string, unknown> | null }[] = [
    { key: 'profile', label: 'Profile', data: profile },
    { key: 'saved', label: 'Saved opportunities', data: bundle.saved_opportunities as unknown[] },
    { key: 'applications', label: 'Applications', data: bundle.student_applications as unknown[] },
    { key: 'tracking', label: 'Activity events', data: bundle.tracking_events as unknown[] },
    { key: 'platform', label: 'Platform events', data: bundle.platform_events as unknown[] },
    { key: 'hours', label: 'Experience entries', data: bundle.experience_entries as unknown[] },
    { key: 'premium_hours', label: 'Activity logs', data: bundle.activity_logs as unknown[] },
    { key: 'reviews', label: 'Reviews', data: bundle.reviews as unknown[] },
    { key: 'clinics', label: 'Clinic memberships', data: bundle.clinic_memberships as unknown[] },
    { key: 'notes', label: 'Admin notes', data: bundle.person_notes as unknown[] },
  ];

  const toggleRaw = (key: string) => setShowRaw((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="shrink-0 mt-0.5" onClick={() => navigate('/analytics/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{String(profile?.full_name ?? 'Student')}</h1>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {profile?.university && <Badge variant="outline" className="text-xs">{String(profile.university)}</Badge>}
            {summary?.attention_level && (
              <Badge variant="outline" className="text-xs capitalize">{String(summary.attention_level)}</Badge>
            )}
            {summary?.last_active_at && (
              <Badge variant="outline" className="text-xs">
                Active {formatDistanceToNow(new Date(String(summary.last_active_at)), { addSuffix: true })}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs shrink-0"
          onClick={() => exportJson(bundle, `student-${id}.json`)}
        >
          Export full JSON
        </Button>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {sections.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="text-xs">
              {s.label}
              {Array.isArray(s.data) && <span className="ml-1 opacity-60">({s.data.length})</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {sections.map((section) => (
          <TabsContent key={section.key} value={section.key} className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex justify-between mb-3">
                  <p className="text-xs text-muted-foreground">{section.label}</p>
                  <div className="flex gap-2">
                    {Array.isArray(section.data) && section.data.length > 0 && (
                      <ExportButton
                        rows={section.data as Record<string, unknown>[]}
                        filename={`student-${id}-${section.key}.csv`}
                        columns={Object.keys((section.data[0] as object) ?? {}).slice(0, 12).map((k) => ({
                          key: k as keyof Record<string, unknown>,
                          label: k,
                        }))}
                        label="CSV"
                      />
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => toggleRaw(section.key)}>
                      {showRaw[section.key] ? 'Table' : 'Raw JSON'}
                    </Button>
                  </div>
                </div>
                {showRaw[section.key] ? (
                  <pre className="text-[10px] overflow-auto max-h-96 bg-muted/30 rounded-md p-3">
                    {JSON.stringify(section.data, null, 2)}
                  </pre>
                ) : Array.isArray(section.data) ? (
                  section.data.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">No records.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(section.data[0] as object).slice(0, 8).map((k) => (
                              <th key={k} className="text-left py-2 px-2 font-medium text-muted-foreground">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.data.slice(0, 50).map((row, i) => (
                            <tr key={i} className="border-b border-border/40">
                              {Object.keys(section.data![0] as object).slice(0, 8).map((k) => (
                                <td key={k} className="py-2 px-2 max-w-[200px] truncate">
                                  {typeof (row as Record<string, unknown>)[k] === 'object'
                                    ? JSON.stringify((row as Record<string, unknown>)[k])
                                    : String((row as Record<string, unknown>)[k] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <pre className="text-[10px] overflow-auto max-h-96 bg-muted/30 rounded-md p-3">
                    {JSON.stringify(section.data, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
