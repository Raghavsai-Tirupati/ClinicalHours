import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Users,
  Ghost,
  Clock,
  Zap,
  Building2,
  Calendar,
  ClipboardCopy,
  Check,
  Mail,
  Send,
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────

interface Abandoner {
  user_id: string;
  full_name: string | null;
  university: string | null;
  savedCount: number;
  lastActive: string | null;
}

interface DormantUser {
  user_id: string;
  full_name: string | null;
  university: string | null;
  joined: string;
}

interface GuestHighIntent {
  session_id: string;
  created_at: string;
  viewedCount: number;
  user_agent: string | null;
}

interface PendingHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  created_at: string;
  hoursPending: number;
}

interface StaleOpp {
  id: string;
  name: string;
  type: string | null;
  state: string | null;
  updated_at: string;
  daysSince: number;
}

// ── Email Dialog ─────────────────────────────────────────────

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  defaultSubject: string;
  defaultBody: string;
  recipientLabel: string;
}

function EmailDialog({ open, onClose, defaultSubject, defaultBody, recipientLabel }: EmailDialogProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, defaultSubject, defaultBody]);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-mass-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ subject, body }),
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to send');
      toast.success(`Email sent to ${result.sent ?? 'subscribers'}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Send Email
          </DialogTitle>
          <DialogDescription>To: {recipientLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-body">Body</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={sending}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Copy Button ──────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(label);
    });
  }
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <ClipboardCopy className="h-3 w-3" />}
      Copy
    </Button>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function AdminAutomationTab() {
  const [abandoners, setAbandoners] = useState<Abandoner[]>([]);
  const [dormant, setDormant] = useState<DormantUser[]>([]);
  const [highIntentGuests, setHighIntentGuests] = useState<GuestHighIntent[]>([]);
  const [pendingHospitals, setPendingHospitals] = useState<PendingHospital[]>([]);
  const [staleOpps, setStaleOpps] = useState<StaleOpp[]>([]);
  const [loading, setLoading] = useState(true);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDefaults, setEmailDefaults] = useState({ subject: '', body: '', recipient: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: allSaved },
        { data: pendingData },
        { data: oppsData },
        { data: guestEventData },
        { data: guestSessionData },
      ] = await Promise.all([
        supabase.from('saved_opportunities').select('user_id, applied, created_at'),
        supabase
          .from('hospital_accounts')
          .select('id, contact_email, created_at, hospitals(name)')
          .eq('account_status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('opportunities')
          .select('id, name, type, state, updated_at')
          .order('updated_at', { ascending: true })
          .limit(500),
        supabase
          .from('tracking_events')
          .select('session_id, event_type')
          .is('user_id', null)
          .eq('event_type', 'opportunity_viewed'),
        supabase
          .from('guest_sessions')
          .select('session_id, created_at, user_agent, converted_to_user_id')
          .is('converted_to_user_id', null),
      ]);

      // High-intent abandoners: ≥2 saves, never applied
      const savedCountByUser = new Map<string, number>();
      const anyApplied = new Set<string>();
      for (const row of (allSaved ?? []) as { user_id: string | null; applied: boolean }[]) {
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
        const [{ data: profilesData }, { data: lastActiveRows }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, university').in('id', ids),
          supabase
            .from('tracking_events')
            .select('user_id, created_at')
            .in('user_id', ids)
            .order('created_at', { ascending: false }),
        ]);
        const profileMap = new Map(
          (profilesData ?? []).map((p: { id: string; full_name: string | null; university: string | null }) => [p.id, p])
        );
        const lastActiveMap = new Map<string, string>();
        for (const r of (lastActiveRows ?? []) as { user_id: string | null; created_at: string }[]) {
          if (r.user_id && !lastActiveMap.has(r.user_id)) lastActiveMap.set(r.user_id, r.created_at);
        }
        setAbandoners(
          highIntentIds.map(({ uid, count }) => {
            const p = profileMap.get(uid);
            return {
              user_id: uid,
              full_name: p?.full_name ?? null,
              university: p?.university ?? null,
              savedCount: count,
              lastActive: lastActiveMap.get(uid) ?? null,
            };
          })
        );
      } else {
        setAbandoners([]);
      }

      // Dormant signups: joined > 7 days ago, 0 saved opps
      const usersWithSaves = new Set([...savedCountByUser.keys()]);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dormantProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, university, created_at')
        .lt('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(200);
      setDormant(
        ((dormantProfiles ?? []) as { id: string; full_name: string | null; university: string | null; created_at: string }[])
          .filter((p) => !usersWithSaves.has(p.id))
          .slice(0, 20)
          .map((p) => ({
            user_id: p.id,
            full_name: p.full_name,
            university: p.university,
            joined: p.created_at,
          }))
      );

      // High-intent guests: session with ≥5 opportunity_viewed events, not converted
      const unconvertedIds = new Set(
        (guestSessionData ?? []).map((g: { session_id: string }) => g.session_id)
      );
      const guestSessionMap = new Map(
        (guestSessionData ?? []).map((g: GuestSession) => [g.session_id, g])
      );
      const viewCountBySession = new Map<string, number>();
      for (const e of (guestEventData ?? []) as { session_id: string }[]) {
        viewCountBySession.set(e.session_id, (viewCountBySession.get(e.session_id) ?? 0) + 1);
      }
      const highIntentGuestSessions = [...viewCountBySession.entries()]
        .filter(([sid, count]) => count >= 5 && unconvertedIds.has(sid))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([sid, count]) => {
          const gs = guestSessionMap.get(sid);
          return {
            session_id: sid,
            created_at: gs?.created_at ?? '',
            viewedCount: count,
            user_agent: gs?.user_agent ?? null,
          };
        });
      setHighIntentGuests(highIntentGuestSessions);

      // Pending hospitals with aging
      const now = new Date();
      setPendingHospitals(
        ((pendingData ?? []) as Array<{ id: string; contact_email: string; created_at: string; hospitals: { name?: string } | { name?: string }[] | null }>)
          .map((r) => {
            const h = Array.isArray(r.hospitals) ? r.hospitals[0] : r.hospitals;
            return {
              id: r.id,
              hospital_name: h?.name ?? 'Unknown',
              contact_email: r.contact_email,
              created_at: r.created_at,
              hoursPending: differenceInHours(now, new Date(r.created_at)),
            };
          })
      );

      // Stale opportunities: updated_at > 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      setStaleOpps(
        ((oppsData ?? []) as Array<{ id: string; name: string; type: string | null; state: string | null; updated_at: string }>)
          .filter((o) => new Date(o.updated_at) < ninetyDaysAgo)
          .slice(0, 30)
          .map((o) => ({
            ...o,
            daysSince: differenceInDays(now, new Date(o.updated_at)),
          }))
      );
    } catch (err) {
      console.error('Error fetching automation data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function openEmailDialog(subject: string, body: string, recipient: string) {
    setEmailDefaults({ subject, body, recipient });
    setEmailDialogOpen(true);
  }

  function nudgeAbandoner(a: Abandoner) {
    const name = a.full_name ?? 'there';
    openEmailDialog(
      `Don't miss out — you have saved opportunities waiting`,
      `Hi ${name},\n\nYou've saved ${a.savedCount} clinical opportunities on ClinicalHours but haven't applied yet.\n\nYour saved opportunities are still available. Log in and take the next step!\n\nhttps://clinicalhours.com/dashboard\n\nBest,\nThe ClinicalHours Team`,
      a.full_name ?? a.user_id
    );
  }

  function activationEmail(u: DormantUser) {
    const name = u.full_name ?? 'there';
    openEmailDialog(
      `Discover clinical opportunities near you`,
      `Hi ${name},\n\nYou signed up for ClinicalHours but haven't saved any opportunities yet.\n\nWe have hundreds of clinical volunteer and shadowing positions available. Start exploring:\n\nhttps://clinicalhours.com/opportunities\n\nBest,\nThe ClinicalHours Team`,
      u.full_name ?? u.user_id
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Automation Center</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Section 1: Ready-to-act cohorts */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ready-to-Act Cohorts</p>

        {/* Panel A: High-intent abandoners */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              High-Intent Abandoners
              <Badge variant="outline" className="text-[11px] ml-auto font-normal text-muted-foreground">
                ≥2 saves, never applied — {abandoners.length} users
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {abandoners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No abandoners found.</p>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-0 divide-y divide-border/40">
                  <div className="grid grid-cols-[1fr_1fr_64px_120px_100px] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    <span>Name</span>
                    <span>University</span>
                    <span>Saved</span>
                    <span>Last Active</span>
                    <span />
                  </div>
                  {abandoners.map((a) => (
                    <div
                      key={a.user_id}
                      className="grid grid-cols-[1fr_1fr_64px_120px_100px] gap-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm font-medium truncate">{a.full_name ?? <span className="text-muted-foreground italic">Unknown</span>}</span>
                      <span className="text-xs text-muted-foreground truncate">{a.university ?? '—'}</span>
                      <Badge variant="outline" className="w-fit text-[11px] border-amber-500/30 text-amber-400">{a.savedCount}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {a.lastActive ? formatDistanceToNow(new Date(a.lastActive), { addSuffix: true }) : '—'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => nudgeAbandoner(a)}
                      >
                        <Mail className="h-3 w-3" /> Nudge
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Panel B: Dormant signups */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Dormant Signups
              <Badge variant="outline" className="text-[11px] ml-auto font-normal text-muted-foreground">
                Joined &gt;7d ago, 0 saves — {dormant.length} users
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {dormant.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No dormant signups.</p>
            ) : (
              <ScrollArea className="h-[240px]">
                <div className="divide-y divide-border/40">
                  <div className="grid grid-cols-[1fr_1fr_120px_100px] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    <span>Name</span>
                    <span>University</span>
                    <span>Joined</span>
                    <span />
                  </div>
                  {dormant.map((u) => (
                    <div
                      key={u.user_id}
                      className="grid grid-cols-[1fr_1fr_120px_100px] gap-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm font-medium truncate">{u.full_name ?? <span className="text-muted-foreground italic">Unknown</span>}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.university ?? '—'}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(u.joined), { addSuffix: true })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => activationEmail(u)}
                      >
                        <Mail className="h-3 w-3" /> Activate
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Panel C: High-intent guests */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ghost className="h-4 w-4 text-orange-400" />
              High-Intent Guests
              <Badge variant="outline" className="text-[11px] ml-auto font-normal text-muted-foreground">
                ≥5 opp views, not converted — {highIntentGuests.length} sessions
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {highIntentGuests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No high-intent guest sessions.</p>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="divide-y divide-border/40">
                  <div className="grid grid-cols-[1fr_80px_120px_100px] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    <span>Session ID</span>
                    <span>Views</span>
                    <span>First Seen</span>
                    <span />
                  </div>
                  {highIntentGuests.map((g) => {
                    const sessionMeta = `Session ${g.session_id.slice(0, 12)}\nViewed: ${g.viewedCount} opportunities\nFirst seen: ${g.created_at}`;
                    return (
                      <div
                        key={g.session_id}
                        className="grid grid-cols-[1fr_80px_120px_100px] gap-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                      >
                        <code className="text-[11px] font-mono text-muted-foreground">{g.session_id.slice(0, 16)}…</code>
                        <Badge variant="outline" className="w-fit text-[11px] border-orange-500/30 text-orange-400">{g.viewedCount}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {g.created_at ? formatDistanceToNow(new Date(g.created_at), { addSuffix: true }) : '—'}
                        </span>
                        <CopyButton text={sessionMeta} label="Session metadata copied" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Pending approvals aging */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Approvals Aging</p>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-yellow-400" />
              Hospitals Awaiting Review
              <Badge
                variant="outline"
                className={`text-[11px] ml-auto font-normal ${pendingHospitals.some((h) => h.hoursPending > 72) ? 'border-red-500/30 text-red-400' : 'text-muted-foreground'}`}
              >
                {pendingHospitals.length} pending
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingHospitals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending approvals.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {pendingHospitals.map((h) => {
                  const isOld = h.hoursPending > 72;
                  return (
                    <div key={h.id} className="flex items-center gap-4 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{h.hospital_name}</p>
                        <p className="text-xs text-muted-foreground">{h.contact_email}</p>
                      </div>
                      <span className={`text-[11px] font-medium tabular-nums shrink-0 ${isOld ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {h.hoursPending < 48
                          ? `${h.hoursPending}h`
                          : `${Math.floor(h.hoursPending / 24)}d`}
                        {isOld && ' ⚠'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Stale opportunities */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stale Opportunities</p>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Not Updated in 90+ Days
              <Badge variant="outline" className="text-[11px] ml-auto font-normal text-muted-foreground">
                {staleOpps.length} opportunities
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {staleOpps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No stale opportunities.</p>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="divide-y divide-border/40">
                  <div className="grid grid-cols-[1fr_80px_80px_80px] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    <span>Name</span>
                    <span>Type</span>
                    <span>State</span>
                    <span>Days Stale</span>
                  </div>
                  {staleOpps.map((o) => (
                    <div
                      key={o.id}
                      className="grid grid-cols-[1fr_80px_80px_80px] gap-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm truncate">{o.name}</span>
                      {o.type ? (
                        <Badge variant="outline" className="w-fit text-[10px]">{o.type}</Badge>
                      ) : <span />}
                      <span className="text-xs text-muted-foreground">{o.state ?? '—'}</span>
                      <span className={`text-xs font-medium tabular-nums ${o.daysSince > 180 ? 'text-red-400' : o.daysSince > 120 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                        {o.daysSince}d
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <EmailDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        defaultSubject={emailDefaults.subject}
        defaultBody={emailDefaults.body}
        recipientLabel={emailDefaults.recipient}
      />
    </div>
  );
}
