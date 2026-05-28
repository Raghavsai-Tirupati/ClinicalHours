import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  TrendingDown,
  AlertTriangle,
  Users,
  ChevronRight,
  Bookmark,
  Search,
  Globe,
  Ghost,
  UserPlus,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type TimeRange = 'today' | '7d' | '30d';

interface FunnelData {
  landingVisitors: number;
  guestSessions: number;
  signups: number;
  savedAtLeastOne: number;
  applied: number;
}

interface Abandoner {
  user_id: string;
  full_name: string | null;
  university: string | null;
  state: string | null;
  savedCount: number;
  lastActive: string | null;
}

interface ZeroSaveOpportunity {
  id: string;
  name: string;
  type: string | null;
  state: string | null;
}

function getTimeRangeStart(range: TimeRange): string {
  const now = new Date();
  switch (range) {
    case 'today': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d.toISOString();
    }
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}

function conversionClass(num: number, denom: number): string {
  if (denom === 0) return '';
  const ratio = num / denom;
  if (ratio < 0.05) return 'border-red-500/40 bg-red-500/5';
  if (ratio < 0.2) return 'border-amber-500/40 bg-amber-500/5';
  return 'border-border bg-card';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export default function AdminFunnelTab() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [abandoners, setAbandoners] = useState<Abandoner[]>([]);
  const [zeroSaveOpps, setZeroSaveOpps] = useState<ZeroSaveOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const since = getTimeRangeStart(timeRange);

      const [
        { data: landingRows },
        { data: guestRows },
        { data: signupRows },
        { data: savedRows },
        { data: appliedRows },
      ] = await Promise.all([
        supabase
          .from('tracking_events')
          .select('session_id')
          .eq('event_type', 'page_view')
          .eq('page_url', '/')
          .gte('created_at', since),
        supabase
          .from('guest_sessions')
          .select('session_id')
          .gte('created_at', since),
        supabase
          .from('tracking_events')
          .select('user_id')
          .eq('event_type', 'signup')
          .gte('created_at', since),
        supabase
          .from('saved_opportunities')
          .select('user_id')
          .gte('created_at', since),
        supabase
          .from('saved_opportunities')
          .select('user_id')
          .eq('applied', true)
          .gte('created_at', since),
      ]);

      const landingVisitors = new Set((landingRows ?? []).map((r: { session_id: string | null }) => r.session_id).filter(Boolean)).size;
      const guestSessions = new Set((guestRows ?? []).map((r: { session_id: string | null }) => r.session_id).filter(Boolean)).size;
      const signups = new Set((signupRows ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean)).size;
      const savedAtLeastOne = new Set((savedRows ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean)).size;
      const applied = new Set((appliedRows ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean)).size;

      setFunnel({ landingVisitors, guestSessions, signups, savedAtLeastOne, applied });

      const { data: allSaved } = await supabase
        .from('saved_opportunities')
        .select('user_id, applied, created_at');

      if (allSaved) {
        const savedCountByUser = new Map<string, number>();
        const anyApplied = new Set<string>();

        for (const row of allSaved as { user_id: string | null; applied: boolean }[]) {
          if (!row.user_id) continue;
          savedCountByUser.set(row.user_id, (savedCountByUser.get(row.user_id) ?? 0) + 1);
          if (row.applied) anyApplied.add(row.user_id);
        }

        const highIntentIds = [...savedCountByUser.entries()]
          .filter(([uid, count]) => count >= 2 && !anyApplied.has(uid))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([uid, count]) => ({ uid, count }));

        if (highIntentIds.length > 0) {
          const ids = highIntentIds.map((x) => x.uid);

          const [{ data: profiles }, { data: lastActiveRows }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, university, state')
              .in('id', ids),
            supabase
              .from('tracking_events')
              .select('user_id, created_at')
              .in('user_id', ids)
              .order('created_at', { ascending: false }),
          ]);

          const profileMap = new Map(
            (profiles ?? []).map((p: { id: string; full_name: string | null; university: string | null; state: string | null }) => [p.id, p])
          );

          const lastActiveMap = new Map<string, string>();
          for (const row of (lastActiveRows ?? []) as { user_id: string | null; created_at: string }[]) {
            if (row.user_id && !lastActiveMap.has(row.user_id)) {
              lastActiveMap.set(row.user_id, row.created_at);
            }
          }

          const result: Abandoner[] = highIntentIds.map(({ uid, count }) => {
            const p = profileMap.get(uid);
            return {
              user_id: uid,
              full_name: p?.full_name ?? null,
              university: p?.university ?? null,
              state: p?.state ?? null,
              savedCount: count,
              lastActive: lastActiveMap.get(uid) ?? null,
            };
          });

          setAbandoners(result);
        } else {
          setAbandoners([]);
        }
      }

      const { data: savedOppIds } = await supabase
        .from('saved_opportunities')
        .select('opportunity_id');

      const savedSet = new Set((savedOppIds ?? []).map((r: { opportunity_id: string }) => r.opportunity_id));

      const { data: allOpps } = await supabase
        .from('opportunities')
        .select('id, name, type, state')
        .order('name')
        .limit(300);

      const zeroSave = (allOpps ?? [])
        .filter((o: { id: string }) => !savedSet.has(o.id))
        .slice(0, 50) as ZeroSaveOpportunity[];

      setZeroSaveOpps(zeroSave);
    } catch (err) {
      console.error('Error fetching funnel data:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const funnelSteps = funnel
    ? [
        { label: 'Landing Visitors', count: funnel.landingVisitors, icon: Globe, prev: null, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Guest Sessions', count: funnel.guestSessions, icon: Ghost, prev: funnel.landingVisitors, color: 'text-orange-400', bg: 'bg-orange-400/10' },
        { label: 'Signups', count: funnel.signups, icon: UserPlus, prev: funnel.guestSessions, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { label: 'Saved ≥1 Opp', count: funnel.savedAtLeastOne, icon: Bookmark, prev: funnel.signups, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { label: 'Applied', count: funnel.applied, icon: Users, prev: funnel.savedAtLeastOne, color: 'text-pink-400', bg: 'bg-pink-400/10' },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Funnel Analysis</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !funnel ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {funnelSteps.map((step, i) => {
                const cardCls = step.prev !== null ? conversionClass(step.count, step.prev) : 'border-border bg-card';
                return (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className={`rounded-lg border px-4 py-3 min-w-[120px] ${cardCls}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`h-6 w-6 rounded ${step.bg} flex items-center justify-center`}>
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                      </div>
                      <p className="text-xl font-bold tabular-nums text-foreground">{step.count.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{step.label}</p>
                      {step.prev !== null && (
                        <p className={`text-[11px] font-medium mt-1 ${step.prev > 0 && step.count / step.prev < 0.05 ? 'text-red-400' : step.prev > 0 && step.count / step.prev < 0.2 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                          {pct(step.count, step.prev)} of prev
                        </p>
                      )}
                    </div>
                    {i < funnelSteps.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            High-Intent Abandoners
            <Badge variant="outline" className="text-[11px] ml-auto font-normal text-muted-foreground">
              ≥2 saves, never applied
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : abandoners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No high-intent abandoners found.</p>
          ) : (
            <ScrollArea className="h-[340px]">
              <div className="space-y-0 divide-y divide-border/40">
                <div className="grid grid-cols-[1fr_1fr_72px_120px_80px] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>Name</span>
                  <span>University</span>
                  <span>Saved</span>
                  <span>Last Active</span>
                  <span></span>
                </div>
                {abandoners.map((a) => (
                  <div key={a.user_id} className="grid grid-cols-[1fr_1fr_72px_120px_80px] gap-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors">
                    <span className="text-sm font-medium text-foreground truncate">
                      {a.full_name ?? <span className="text-muted-foreground italic">Unknown</span>}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{a.university ?? '—'}</span>
                    <Badge variant="outline" className="w-fit text-[11px] border-amber-500/30 text-amber-400">
                      {a.savedCount}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {a.lastActive ? formatDistanceToNow(new Date(a.lastActive), { addSuffix: true }) : '—'}
                    </span>
                    <CopyButton text={a.user_id} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-muted-foreground" />
            Zero-Save Opportunities
            {!loading && (
              <Badge variant="outline" className="text-[11px] ml-auto font-normal text-muted-foreground">
                {zeroSaveOpps.length} opportunities
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : zeroSaveOpps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">All opportunities have been saved by at least one student.</p>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="divide-y divide-border/40">
                {zeroSaveOpps.map((opp) => (
                  <div key={opp.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{opp.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opp.type && (
                        <Badge variant="outline" className="text-[10px]">{opp.type}</Badge>
                      )}
                      {opp.state && (
                        <span className="text-[11px] text-muted-foreground">{opp.state}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border border-dashed">
        <CardContent className="py-6 px-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Search Gap Analysis</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search gap analysis will populate once opportunity_search tracking is live. Once active, this will show: top search queries, queries returning 0 results, and catalog coverage gaps.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
