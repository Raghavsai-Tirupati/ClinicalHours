import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Database,
  Clock, BarChart3, Plus, TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface MetricDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  source_table: string | null;
  unit: string | null;
  freshness_target_minutes: number | null;
  is_active: boolean;
}

interface MetricSnapshot {
  id: string;
  metric_id: string;
  value: number;
  snapshot_at: string;
  computed_by: string;
}

interface DataQualityIncident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  detected_by: string | null;
  related_table: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  warning:  { label: 'Warning',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  info:     { label: 'Info',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:          { label: 'Open',          color: 'text-red-400' },
  investigating: { label: 'Investigating', color: 'text-yellow-400' },
  resolved:      { label: 'Resolved',      color: 'text-green-400' },
  dismissed:     { label: 'Dismissed',     color: 'text-muted-foreground' },
};

export default function DataTrustTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Data Trust</h2>
        <p className="text-sm text-muted-foreground">Metric freshness, anomaly detection, incidents, and audit trail</p>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="metrics" className="text-xs sm:text-sm">Metrics</TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs sm:text-sm">Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics"><MetricsPane /></TabsContent>
        <TabsContent value="incidents"><IncidentsPane /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
function MetricsPane() {
  const [defs, setDefs] = useState<MetricDefinition[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, MetricSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: defData } = await supabase.from('metric_definitions').select('*').eq('is_active', true).order('display_name');
    setDefs(defData ?? []);

    // Latest snapshot per metric
    const ids = (defData ?? []).map(d => d.id);
    if (ids.length > 0) {
      const { data: snapData } = await supabase
        .from('metric_snapshots')
        .select('*')
        .in('metric_id', ids)
        .order('snapshot_at', { ascending: false });

      const latest: Record<string, MetricSnapshot> = {};
      for (const s of (snapData ?? [])) {
        if (!latest[s.metric_id]) latest[s.metric_id] = s;
      }
      setSnapshots(latest);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recompute(def: MetricDefinition) {
    setRecomputing(def.id);
    const { error } = await supabase.functions.invoke('metric-snapshot-recompute', { body: { metric_id: def.id } });
    if (error) {
      toast({ title: 'Recompute failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${def.display_name} recomputed` });
      await load();
    }
    setRecomputing(null);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {defs.map(def => {
          const snap = snapshots[def.id];
          const ageMinutes = snap ? differenceInMinutes(new Date(), new Date(snap.snapshot_at)) : null;
          const isFresh = ageMinutes != null && def.freshness_target_minutes
            ? ageMinutes <= def.freshness_target_minutes
            : null;

          return (
            <Card key={def.id} className={`bg-card/60 border ${isFresh === false ? 'border-yellow-500/40' : 'border-border/60'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{def.display_name}</p>
                    <p className="text-2xl font-bold mt-1">
                      {snap ? formatMetricValue(snap.value, def.unit) : '—'}
                    </p>
                    {snap && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${isFresh === false ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                        {isFresh === false ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {formatDistanceToNow(new Date(snap.snapshot_at), { addSuffix: true })}
                      </p>
                    )}
                    {def.source_table && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Database className="h-3 w-3" />{def.source_table}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => recompute(def)}
                    disabled={recomputing === def.id}
                    title="Recompute"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${recomputing === def.id ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {defs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No metric definitions found. Apply the migration first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatMetricValue(value: number, unit: string | null): string {
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'dollars') return `$${value.toLocaleString()}`;
  if (unit === 'days') return `${value.toFixed(1)}d`;
  return value.toLocaleString();
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------
function IncidentsPane() {
  const [incidents, setIncidents] = useState<DataQualityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('data_quality_incidents').select('*').order('created_at', { ascending: false });
    if (statusFilter === 'active') q = q.in('status', ['open', 'investigating']);
    else if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setIncidents(data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved') {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = user?.id;
    }
    await supabase.from('data_quality_incidents').update(update).eq('id', id);
    toast({ title: `Incident ${status}` });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {['active', 'resolved', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs border transition-colors capitalize ${
                statusFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Report Incident
        </Button>
      </div>

      {loading ? <LoadingSpinner /> : incidents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">No {statusFilter === 'active' ? 'active ' : ''}incidents</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => {
            const sev = SEVERITY_CONFIG[inc.severity] ?? SEVERITY_CONFIG.info;
            const st = STATUS_CONFIG[inc.status] ?? STATUS_CONFIG.open;
            return (
              <div key={inc.id} className="rounded-md border border-border/60 bg-card/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${sev.color}`}>{sev.label}</Badge>
                      <p className="font-medium text-sm">{inc.title}</p>
                      <span className={`text-xs ${st.color}`}>{st.label}</span>
                    </div>
                    {inc.description && <p className="text-xs text-muted-foreground mt-1">{inc.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {inc.related_table && <span className="flex items-center gap-1"><Database className="h-3 w-3" />{inc.related_table}</span>}
                      {inc.detected_by && <span>detected by {inc.detected_by}</span>}
                      <span>{formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}</span>
                    </div>
                    {inc.resolution_note && (
                      <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-green-500/40 pl-2">{inc.resolution_note}</p>
                    )}
                  </div>
                  {inc.status !== 'resolved' && inc.status !== 'dismissed' && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(inc.id, 'resolved')}>
                        Resolve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(inc.id, 'dismissed')}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateIncidentDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
}

function CreateIncidentDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', severity: 'warning', related_table: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function field(key: keyof typeof form) {
    return { value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value })) };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await supabase.from('data_quality_incidents').insert({
      title: form.title.trim(),
      description: form.description || null,
      severity: form.severity,
      related_table: form.related_table || null,
      detected_by: 'manual',
    });
    setSaving(false);
    toast({ title: 'Incident reported' });
    setForm({ title: '', description: '', severity: 'warning', related_table: '' });
    onCreated(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="What's wrong?" {...field('title')} />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Related Table</Label>
            <Input placeholder="e.g. opportunities" {...field('related_table')} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} placeholder="Details…" {...field('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Report'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
