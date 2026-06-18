import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bot,
  TrendingUp,
  Zap,
  RefreshCw,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface KPI {
  label: string;
  value: number | string;
  icon: React.ElementType;
  trend?: string;
  color?: string;
}

interface ApprovalTask {
  id: string;
  title: string;
  approval_type: string;
  requester_source: string;
  created_at: string;
}

interface AgentRecommendation {
  id: string;
  agent_name: string;
  title: string;
  body: string;
  priority: number;
  recommendation_type: string;
  created_at: string;
}

interface DataQualityIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

interface Props {
  onOpenApprovalsChange?: (count: number) => void;
}

export default function ControlTowerTab({ onOpenApprovalsChange }: Props) {
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([]);
  const [incidents, setIncidents] = useState<DataQualityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [
        { count: studentCount },
        { count: pendingCount },
        { count: opportunityCount },
        { count: leadCount },
        approvalsRes,
        recsRes,
        incidentsRes,
        agentTaskRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).neq('link_status', 'broken'),
        supabase.from('clinic_leads').select('*', { count: 'exact', head: true }).neq('pipeline_stage', 'live').neq('pipeline_stage', 'lost'),
        supabase.from('approval_tasks').select('id, title, approval_type, requester_source, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
        supabase.from('agent_recommendations').select('id, agent_name, title, body, priority, recommendation_type, created_at').eq('status', 'pending').order('priority', { ascending: true }).limit(8),
        supabase.from('data_quality_incidents').select('id, title, severity, status, created_at').in('status', ['open', 'investigating']).order('created_at', { ascending: false }).limit(5),
        supabase.from('agent_tasks').select('*', { count: 'exact', head: true }).in('status', ['queued', 'running', 'awaiting_approval']),
      ]);

      setKpis({
        students: studentCount ?? 0,
        pending_approvals: pendingCount ?? 0,
        opportunities: opportunityCount ?? 0,
        leads_in_pipeline: leadCount ?? 0,
        open_approvals: approvalsRes.data?.length ?? 0,
        active_agent_tasks: agentTaskRes.count ?? 0,
      });

      setApprovals(approvalsRes.data ?? []);
      setRecommendations(recsRes.data ?? []);
      setIncidents(incidentsRes.data ?? []);
      onOpenApprovalsChange?.(approvalsRes.data?.length ?? 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleApprovalAction(id: string, action: 'approved' | 'rejected') {
    await supabase.from('approval_tasks').update({
      status: action,
      approved_at: action === 'approved' ? new Date().toISOString() : undefined,
      rejected_at: action === 'rejected' ? new Date().toISOString() : undefined,
    }).eq('id', id);
    loadAll();
  }

  async function dismissRecommendation(id: string) {
    await supabase.from('agent_recommendations').update({ status: 'dismissed', dismissed_at: new Date().toISOString() }).eq('id', id);
    setRecommendations(r => r.filter(x => x.id !== id));
  }

  const topKpis: KPI[] = [
    { label: 'Students', value: kpis.students ?? '—', icon: Users, color: 'text-blue-400' },
    { label: 'Pending Approvals', value: kpis.pending_approvals ?? '—', icon: Clock, color: kpis.pending_approvals > 0 ? 'text-yellow-400' : 'text-muted-foreground' },
    { label: 'Active Opportunities', value: kpis.opportunities ?? '—', icon: Building2, color: 'text-green-400' },
    { label: 'Leads in Pipeline', value: kpis.leads_in_pipeline ?? '—', icon: TrendingUp, color: 'text-purple-400' },
    { label: 'Open Approvals', value: kpis.open_approvals ?? '—', icon: AlertTriangle, color: kpis.open_approvals > 0 ? 'text-red-400' : 'text-muted-foreground' },
    { label: 'Active Agent Tasks', value: kpis.active_agent_tasks ?? '—', icon: Bot, color: 'text-cyan-400' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Control Tower</h2>
          <p className="text-sm text-muted-foreground">Platform snapshot — what changed, what needs action</p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadAll} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {topKpis.map((kpi) => (
          <Card key={kpi.label} className="bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                </div>
                <kpi.icon className={`h-4 w-4 mt-0.5 shrink-0 ${kpi.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main grid: Approvals + Recommendations + Incidents */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Open Approvals */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Open Approvals
              {approvals.length > 0 && (
                <Badge variant="destructive" className="text-xs ml-auto">{approvals.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {approvals.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {approvals.map((a) => (
                    <div key={a.id} className="rounded-md border border-border/60 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.approval_type.replace(/_/g, ' ')} · {a.requester_source}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleApprovalAction(a.id, 'approved')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleApprovalAction(a.id, 'rejected')}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Agent Recommendations */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4 text-cyan-400" />
              Agent Recommendations
              {recommendations.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-auto">{recommendations.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Zap className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No pending recommendations</p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {recommendations.map((r) => (
                    <div key={r.id} className="rounded-md border border-border/60 p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <PriorityDot priority={r.priority} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.agent_name.replace(/_/g, ' ')}</p>
                          {r.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.body}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs flex-1">
                          Accept
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissRecommendation(r.id)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Data Trust Status */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-orange-400" />
              Data Trust
              {incidents.length > 0 && (
                <Badge variant="destructive" className="text-xs ml-auto">{incidents.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm text-muted-foreground">No active incidents</p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {incidents.map((i) => (
                    <div key={i.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-start gap-2">
                        <SeverityBadge severity={i.severity} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">{i.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const color = priority <= 2 ? 'bg-red-500' : priority <= 4 ? 'bg-yellow-500' : 'bg-green-500';
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <Badge variant="outline" className={`text-xs shrink-0 ${map[severity] ?? ''}`}>
      {severity}
    </Badge>
  );
}
