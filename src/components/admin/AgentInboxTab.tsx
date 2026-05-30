import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bot, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  Play, ThumbsUp, ThumbsDown, Inbox, History, Zap,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AgentTask {
  id: string;
  agent_name: string;
  task_type: string;
  status: string;
  priority: number;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRecommendation {
  id: string;
  agent_name: string;
  recommendation_type: string;
  title: string;
  body: string | null;
  priority: number;
  status: string;
  related_entity_type: string | null;
  expires_at: string | null;
  created_at: string;
}

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  queued:            { label: 'Queued',             color: 'text-muted-foreground', icon: Clock },
  running:           { label: 'Running',            color: 'text-blue-400',         icon: Play },
  awaiting_approval: { label: 'Awaiting Approval',  color: 'text-yellow-400',       icon: AlertTriangle },
  approved:          { label: 'Approved',           color: 'text-green-400',        icon: CheckCircle2 },
  rejected:          { label: 'Rejected',           color: 'text-red-400',          icon: XCircle },
  completed:         { label: 'Completed',          color: 'text-green-500',        icon: CheckCircle2 },
  failed:            { label: 'Failed',             color: 'text-red-400',          icon: XCircle },
};

const AGENT_LABELS: Record<string, string> = {
  funnel_analyst:    'Funnel Analyst',
  lead_researcher:   'Lead Researcher',
  outreach_drafter:  'Outreach Drafter',
  sequence_manager:  'Sequence Manager',
  clinic_onboarding: 'Clinic Onboarding',
  supply_quality:    'Supply Quality',
  revenue_monitor:   'Revenue Monitor',
  data_trust:        'Data Trust',
  router:            'Chief of Staff',
};

export default function AgentInboxTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Agent Inbox</h2>
        <p className="text-sm text-muted-foreground">Queued tasks, blocked work, drafts awaiting approval, and run history</p>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="queue" className="text-xs sm:text-sm">Task Queue</TabsTrigger>
          <TabsTrigger value="recommendations" className="text-xs sm:text-sm">Recommendations</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="queue"><TaskQueue /></TabsContent>
        <TabsContent value="recommendations"><RecommendationsPane /></TabsContent>
        <TabsContent value="history"><RunHistory /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Queue
// ---------------------------------------------------------------------------
function TaskQueue() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selected, setSelected] = useState<AgentTask | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('agent_tasks').select('*').order('priority', { ascending: true }).order('created_at', { ascending: false }).limit(50);
    if (statusFilter === 'active') q = q.in('status', ['queued', 'running', 'awaiting_approval']);
    else if (statusFilter === 'failed') q = q.eq('status', 'failed');
    else if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (agentFilter !== 'all') q = q.eq('agent_name', agentFilter);
    const { data } = await q;
    setTasks(data ?? []);
    setLoading(false);
  }, [statusFilter, agentFilter]);

  useEffect(() => { load(); }, [load]);

  async function approveTask(task: AgentTask) {
    await supabase.from('agent_tasks').update({
      status: 'approved',
      assigned_to: user?.id,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    toast({ title: 'Task approved' });
    load(); setSelected(null);
  }

  async function rejectTask(task: AgentTask) {
    await supabase.from('agent_tasks').update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    toast({ title: 'Task rejected' });
    load(); setSelected(null);
  }

  async function retryTask(task: AgentTask) {
    await supabase.from('agent_tasks').update({
      status: 'queued',
      error_message: null,
      started_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    toast({ title: 'Task requeued' });
    load(); setSelected(null);
  }

  const uniqueAgents = [...new Set(tasks.map(t => t.agent_name))];

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[
            { value: 'active', label: 'Active' },
            { value: 'failed', label: 'Failed' },
            { value: 'all', label: 'All' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                statusFilter === f.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {uniqueAgents.length > 1 && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {uniqueAgents.map(a => (
                <SelectItem key={a} value={a}>{AGENT_LABELS[a] ?? a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="ghost" onClick={load} className="ml-auto h-8">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? <LoadingSpinner /> : tasks.length === 0 ? (
        <EmptyState icon={Inbox} message={`No ${statusFilter === 'active' ? 'active ' : ''}agent tasks`} />
      ) : (
        <div className="space-y-2 mt-2">
          {tasks.map(task => {
            const cfg = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.queued;
            const Icon = cfg.icon;
            return (
              <div
                key={task.id}
                className="flex items-start gap-4 rounded-md border border-border/60 bg-card/60 p-4 hover:bg-card cursor-pointer transition-colors"
                onClick={() => setSelected(task)}
              >
                <PriorityDot priority={task.priority} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{task.task_type.replace(/_/g, ' ')}</p>
                    <Badge variant="outline" className="text-xs">{AGENT_LABELS[task.agent_name] ?? task.agent_name}</Badge>
                    <span className={`text-xs flex items-center gap-1 ${cfg.color}`}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </div>
                  {task.error_message && (
                    <p className="text-xs text-red-400 mt-1 line-clamp-1">{task.error_message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    {task.related_entity_type && ` · ${task.related_entity_type}`}
                  </p>
                </div>
                {task.status === 'awaiting_approval' && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); approveTask(task); }}>
                      <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={e => { e.stopPropagation(); rejectTask(task); }}>
                      Reject
                    </Button>
                  </div>
                )}
                {task.status === 'failed' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={e => { e.stopPropagation(); retryTask(task); }}>
                    Retry
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail sheet */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base">{selected.task_type.replace(/_/g, ' ')}</SheetTitle>
              </SheetHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Agent</p><p>{AGENT_LABELS[selected.agent_name] ?? selected.agent_name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><p>{TASK_STATUS_CONFIG[selected.status]?.label}</p></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p><p>{selected.priority}</p></div>
                  {selected.related_entity_type && (
                    <div><p className="text-xs text-muted-foreground">Entity</p><p>{selected.related_entity_type}</p></div>
                  )}
                  {selected.started_at && (
                    <div><p className="text-xs text-muted-foreground">Started</p><p>{format(new Date(selected.started_at), 'MMM d, h:mmaaa')}</p></div>
                  )}
                  {selected.completed_at && (
                    <div><p className="text-xs text-muted-foreground">Completed</p><p>{format(new Date(selected.completed_at), 'MMM d, h:mmaaa')}</p></div>
                  )}
                </div>

                {selected.error_message && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Error</p>
                    <p className="text-sm text-red-400 bg-red-500/10 rounded p-3 font-mono text-xs">{selected.error_message}</p>
                  </div>
                )}

                {selected.input_data && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Input</p>
                    <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto">{JSON.stringify(selected.input_data, null, 2)}</pre>
                  </div>
                )}

                {selected.output_data && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Output</p>
                    <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto">{JSON.stringify(selected.output_data, null, 2)}</pre>
                  </div>
                )}

                {selected.status === 'awaiting_approval' && (
                  <div className="flex gap-3">
                    <Button className="flex-1" onClick={() => approveTask(selected)}>
                      <ThumbsUp className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => rejectTask(selected)}>
                      Reject
                    </Button>
                  </div>
                )}
                {selected.status === 'failed' && (
                  <Button variant="outline" onClick={() => retryTask(selected)}>Retry Task</Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------
function RecommendationsPane() {
  const [recs, setRecs] = useState<AgentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agent_recommendations')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });
    setRecs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function accept(id: string) {
    await supabase.from('agent_recommendations').update({
      status: 'accepted',
      accepted_by: user?.id,
      accepted_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: 'Recommendation accepted' });
    load();
  }

  async function dismiss(id: string) {
    await supabase.from('agent_recommendations').update({
      status: 'dismissed',
      dismissed_by: user?.id,
      dismissed_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }

  const REC_TYPE_COLORS: Record<string, string> = {
    next_action: 'text-blue-400 border-blue-400/30',
    draft:       'text-purple-400 border-purple-400/30',
    alert:       'text-red-400 border-red-400/30',
    cleanup:     'text-yellow-400 border-yellow-400/30',
  };

  if (loading) return <LoadingSpinner />;
  if (recs.length === 0) return <EmptyState icon={Zap} message="No pending recommendations" />;

  return (
    <div className="space-y-2">
      {recs.map(rec => (
        <div key={rec.id} className="rounded-md border border-border/60 bg-card/60 p-4">
          <div className="flex items-start gap-3">
            <PriorityDot priority={rec.priority} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{rec.title}</p>
                <Badge variant="outline" className={`text-xs ${REC_TYPE_COLORS[rec.recommendation_type] ?? ''}`}>
                  {rec.recommendation_type.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">{AGENT_LABELS[rec.agent_name] ?? rec.agent_name}</span>
              </div>
              {rec.body && <p className="text-sm text-muted-foreground mt-1">{rec.body}</p>}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span>{formatDistanceToNow(new Date(rec.created_at), { addSuffix: true })}</span>
                {rec.expires_at && (
                  <span>expires {formatDistanceToNow(new Date(rec.expires_at), { addSuffix: true })}</span>
                )}
                {rec.related_entity_type && <span>· {rec.related_entity_type}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-7 text-xs" onClick={() => accept(rec.id)}>
              <ThumbsUp className="h-3 w-3 mr-1" /> Accept
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismiss(rec.id)}>
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run History
// ---------------------------------------------------------------------------
function RunHistory() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('agent_tasks')
      .select('*')
      .in('status', ['completed', 'failed', 'rejected'])
      .order('completed_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setTasks(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (tasks.length === 0) return <EmptyState icon={History} message="No completed agent runs yet" />;

  return (
    <div className="space-y-2">
      {tasks.map(task => {
        const cfg = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.completed;
        const Icon = cfg.icon;
        return (
          <div key={task.id} className="flex items-center gap-4 rounded-md border border-border/60 bg-card/60 p-4">
            <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{task.task_type.replace(/_/g, ' ')}</p>
                <Badge variant="outline" className="text-xs">{AGENT_LABELS[task.agent_name] ?? task.agent_name}</Badge>
              </div>
              {task.error_message && (
                <p className="text-xs text-red-400 mt-0.5 line-clamp-1">{task.error_message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {task.completed_at ? format(new Date(task.completed_at), 'MMM d, h:mmaaa') : formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
              </p>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function PriorityDot({ priority }: { priority: number }) {
  const color = priority <= 2 ? 'bg-red-500' : priority <= 4 ? 'bg-yellow-500' : 'bg-muted-foreground';
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
