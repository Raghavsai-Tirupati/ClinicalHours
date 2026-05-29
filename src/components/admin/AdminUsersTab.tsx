import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  RefreshCw,
  Users,
  Ghost,
  Search,
  Clock,
  BookmarkCheck,
  Eye,
  Eye as EyeIcon,
  GraduationCap,
  MapPin,
  X,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import AdminUserProfile from './AdminUserProfile';

// ── Types ────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  email_opt_in: boolean;
  email_verified: boolean;
  created_at: string;
}

interface GuestSession {
  session_id: string;
  created_at: string;
  user_agent: string | null;
  converted_to_user_id: string | null;
}

interface TrackingEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: string;
  page_url: string;
  referrer_url: string | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  timezone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SavedOppRow {
  user_id: string | null;
  applied: boolean;
}

interface HoursRow {
  user_id: string;
  hours: number | null;
}

type FunnelStage = 'Applied' | 'Saved' | 'Browsing' | 'Passive';
type UserType = 'auth' | 'guest';
type SortKey = 'last_active' | 'joined' | 'saved_count' | 'hours';
type FunnelFilter = 'all' | FunnelStage;
type TypeFilter = 'all' | 'authenticated' | 'guests';

interface UserRow {
  id: string;
  type: UserType;
  name: string;
  university: string | null;
  state: string | null;
  savedCount: number;
  appliedCount: number;
  hoursLogged: number;
  lastActive: string | null;
  joined: string;
  funnelStage: FunnelStage;
  sessionId?: string;
  profile?: ProfileRow;
  guestSession?: GuestSession;
}

// ── Helpers ──────────────────────────────────────────────────

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home', '/dashboard': 'Dashboard', '/opportunities': 'Opportunities',
  '/profile': 'Profile', '/auth': 'Sign In', '/map': 'Map View',
  '/admin': 'Admin', '/premium': 'Premium',
};

function getPageName(url: string): string {
  const base = url.split('?')[0];
  if (PAGE_NAMES[base]) return PAGE_NAMES[base];
  if (base.startsWith('/opportunities/')) return 'Opportunity Detail';
  return base;
}

const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  page_view: { label: 'Viewed', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  button_click: { label: 'Clicked', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  login: { label: 'Logged In', color: 'text-green-400', bg: 'bg-green-400/10' },
  signup: { label: 'Signed Up', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  guest_conversion: { label: 'Converted', color: 'text-amber-400', bg: 'bg-amber-400/10' },
};

function funnelColor(stage: FunnelStage): string {
  switch (stage) {
    case 'Applied': return 'border-green-500/30 text-green-400 bg-green-500/10';
    case 'Saved': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
    case 'Browsing': return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
    case 'Passive': return 'border-border text-muted-foreground bg-muted/30';
  }
}

function computeFunnelStage(
  savedCount: number,
  appliedCount: number,
  hasTrackingEvents: boolean
): FunnelStage {
  if (appliedCount > 0) return 'Applied';
  if (savedCount > 0) return 'Saved';
  if (hasTrackingEvents) return 'Browsing';
  return 'Passive';
}

function getEventDescription(event: TrackingEvent): string {
  const pageName = getPageName(event.page_url);
  switch (event.event_type) {
    case 'page_view':
      if (event.metadata?.action === 'guest_mode_entered') return 'Entered guest mode';
      return `Viewed ${pageName}`;
    case 'button_click':
      return `Clicked "${event.metadata?.button_name ?? 'button'}" on ${pageName}`;
    case 'login':
      return `Logged in via ${event.metadata?.method ?? 'email'}`;
    case 'signup':
      return `Signed up via ${event.metadata?.source ?? 'email'}`;
    case 'guest_conversion':
      return 'Converted from guest to user';
    default:
      return `${event.event_type} on ${pageName}`;
  }
}

// ── EventRow (reused from AdminActivityTab pattern) ──────────

function EventRow({ event }: { event: TrackingEvent }) {
  const cfg = EVENT_CONFIG[event.event_type];
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-muted/40 rounded-md transition-colors">
      <span className="text-[11px] text-muted-foreground whitespace-nowrap pt-0.5 w-24 shrink-0 tabular-nums">
        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
      </span>
      <div className={`mt-0.5 p-1 rounded ${cfg?.bg ?? 'bg-muted'}`}>
        <Activity className={`h-3.5 w-3.5 ${cfg?.color ?? 'text-muted-foreground'}`} />
      </div>
      <span className="flex-1 min-w-0 text-xs text-foreground/90 break-words">
        {getEventDescription(event)}
      </span>
      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {format(new Date(event.created_at), 'HH:mm:ss')}
      </span>
    </div>
  );
}

// ── Detail Sheet ─────────────────────────────────────────────

interface DetailSheetProps {
  user: UserRow;
  open: boolean;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

function DetailSheet({ user, open, onClose, onOpenProfile }: DetailSheetProps) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [savedOpps, setSavedOpps] = useState<
    { id: string; name: string; type: string; status: string | null; applied: boolean; heard_back: boolean; scheduled_interview: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setEvents([]);
    setSavedOpps([]);

    (async () => {
      try {
        if (user.type === 'auth') {
          const [{ data: evts }, { data: opps }] = await Promise.all([
            supabase
              .from('tracking_events')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('saved_opportunities')
              .select('id, status, applied, heard_back, scheduled_interview, opportunity_id, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
          ]);

          if (cancelled) return;
          setEvents((evts ?? []) as TrackingEvent[]);

          if (opps && opps.length > 0) {
            const ids = [...new Set(opps.map((o) => o.opportunity_id))];
            const { data: oppNames } = await supabase
              .from('opportunities')
              .select('id, name, type')
              .in('id', ids);
            if (cancelled) return;
            const nameMap = new Map((oppNames ?? []).map((o: { id: string; name: string; type: string }) => [o.id, o]));
            setSavedOpps(
              opps.map((o) => ({
                id: o.id,
                name: nameMap.get(o.opportunity_id)?.name ?? 'Unknown',
                type: nameMap.get(o.opportunity_id)?.type ?? '',
                status: o.status,
                applied: o.applied,
                heard_back: o.heard_back,
                scheduled_interview: o.scheduled_interview,
              }))
            );
          }
        } else {
          const { data: evts } = await supabase
            .from('tracking_events')
            .select('*')
            .eq('session_id', user.sessionId!)
            .is('user_id', null)
            .order('created_at', { ascending: false });
          if (cancelled) return;
          setEvents((evts ?? []) as TrackingEvent[]);
        }
      } catch (err) {
        console.error('Error fetching user detail:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, user.id, user.type, user.sessionId]);

  const uniquePages = useMemo(
    () => [...new Set(events.map((e) => getPageName(e.page_url)))],
    [events]
  );

  const p = user.profile;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            {user.type === 'guest'
              ? <Ghost className="h-5 w-5 text-orange-400" />
              : <Users className="h-5 w-5 text-blue-400" />}
            {user.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[11px] ${funnelColor(user.funnelStage)}`}>
              {user.funnelStage}
            </Badge>
            {user.type === 'auth' && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenProfile(user.id)}>
                <EyeIcon className="h-3 w-3 mr-1" /> Full Profile
              </Button>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Profile summary */}
        {user.type === 'auth' && p && (
          <Card className="bg-blue-500/5 border-blue-500/20 mb-4">
            <CardContent className="py-3 px-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {p.university && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1"><GraduationCap className="h-3 w-3" /> University</p>
                    <p className="font-medium break-words">{p.university}</p>
                  </div>
                )}
                {p.major && (
                  <div>
                    <p className="text-muted-foreground">Major</p>
                    <p className="font-medium break-words">{p.major}</p>
                  </div>
                )}
                {p.graduation_year && (
                  <div>
                    <p className="text-muted-foreground">Grad Year</p>
                    <p className="font-medium">{p.graduation_year}</p>
                  </div>
                )}
                {(p.city || p.state) && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</p>
                    <p className="font-medium">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clinical Hours</p>
                  <p className="font-medium">{p.clinical_hours ?? 0} hrs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guest session info */}
        {user.type === 'guest' && user.guestSession && (
          <Card className="bg-orange-500/5 border-orange-500/20 mb-4">
            <CardContent className="py-3 px-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Session Started</p>
                  <p className="font-medium">{format(new Date(user.guestSession.created_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Converted</p>
                  <p className="font-medium">{user.guestSession.converted_to_user_id ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lifetime stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Card className="bg-muted/30">
            <CardContent className="py-2.5 px-3">
              <p className="text-lg font-bold">{events.length}</p>
              <p className="text-[11px] text-muted-foreground">Events</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="py-2.5 px-3">
              <p className="text-lg font-bold">{uniquePages.length}</p>
              <p className="text-[11px] text-muted-foreground">Pages</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="py-2.5 px-3">
              <p className="text-lg font-bold">{user.hoursLogged}</p>
              <p className="text-[11px] text-muted-foreground">Hours</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="py-2.5 px-3">
              <p className="text-lg font-bold">{user.savedCount}</p>
              <p className="text-[11px] text-muted-foreground">Saved</p>
            </CardContent>
          </Card>
        </div>

        {/* Saved opps */}
        {user.type === 'auth' && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <BookmarkCheck className="h-3.5 w-3.5" /> Saved Opportunities ({savedOpps.length})
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : savedOpps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">None saved.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {savedOpps.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {o.type && <Badge variant="outline" className="text-[10px] shrink-0">{o.type}</Badge>}
                      <span className="min-w-0 break-words">{o.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {o.applied && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Applied</Badge>}
                      {o.heard_back && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">Heard Back</Badge>}
                      {o.scheduled_interview && <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">Interview</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Event timeline */}
        <div className="border rounded-lg">
          <div className="px-3 py-2 border-b border-border/40 bg-muted/20 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Lifetime Events ({events.length})</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No events recorded.</p>
          ) : (
            <ScrollArea className="h-[360px]">
              <div className="p-2">
                {events.map((e) => <EventRow key={e.id} event={e} />)}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function AdminUsersTab() {
  const [authUsers, setAuthUsers] = useState<UserRow[]>([]);
  const [guestRows, setGuestRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [funnelFilter, setFunnelFilter] = useState<FunnelFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('last_active');

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [profileDialogUser, setProfileDialogUser] = useState<{
    id: string; email: string; full_name: string;
    university: string | null; major: string | null; graduation_year: number | null;
    city: string | null; state: string | null; phone: string | null;
    clinical_hours: number | null; email_opt_in: boolean; email_verified: boolean;
    created_at: string;
  } | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: profiles },
        { data: savedOpps },
        { data: hoursData },
        { data: recentEvents },
        { data: guests },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, city, state, phone, clinical_hours, email_opt_in, email_verified, created_at')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('saved_opportunities')
          .select('user_id, applied'),
        supabase
          .from('experience_entries')
          .select('user_id, hours'),
        supabase
          .from('tracking_events')
          .select('user_id, session_id, created_at, event_type')
          .not('user_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase
          .from('guest_sessions')
          .select('session_id, created_at, user_agent, converted_to_user_id')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      // Build aggregates for auth users
      const savedCountMap = new Map<string, number>();
      const appliedCountMap = new Map<string, number>();
      for (const s of (savedOpps ?? []) as SavedOppRow[]) {
        if (!s.user_id) continue;
        savedCountMap.set(s.user_id, (savedCountMap.get(s.user_id) ?? 0) + 1);
        if (s.applied) appliedCountMap.set(s.user_id, (appliedCountMap.get(s.user_id) ?? 0) + 1);
      }

      const hoursMap = new Map<string, number>();
      for (const h of (hoursData ?? []) as HoursRow[]) {
        hoursMap.set(h.user_id, (hoursMap.get(h.user_id) ?? 0) + (h.hours ?? 0));
      }

      const lastActiveMap = new Map<string, string>();
      const hasEventsSet = new Set<string>();
      for (const e of (recentEvents ?? []) as { user_id: string | null; created_at: string }[]) {
        if (!e.user_id) continue;
        hasEventsSet.add(e.user_id);
        if (!lastActiveMap.has(e.user_id)) lastActiveMap.set(e.user_id, e.created_at);
      }

      const authRows: UserRow[] = (profiles ?? []).map((p: ProfileRow) => {
        const savedCount = savedCountMap.get(p.id) ?? 0;
        const appliedCount = appliedCountMap.get(p.id) ?? 0;
        const hoursLogged = Math.round(hoursMap.get(p.id) ?? 0);
        const hasEvents = hasEventsSet.has(p.id);
        return {
          id: p.id,
          type: 'auth' as UserType,
          name: p.full_name ?? `User ${p.id.slice(0, 6)}`,
          university: p.university,
          state: p.state,
          savedCount,
          appliedCount,
          hoursLogged,
          lastActive: lastActiveMap.get(p.id) ?? null,
          joined: p.created_at,
          funnelStage: computeFunnelStage(savedCount, appliedCount, hasEvents),
          profile: p,
        };
      });

      setAuthUsers(authRows);

      // Build guest rows
      const guestEventLastActive = new Map<string, string>();
      const guestEventCounts = new Map<string, number>();
      const { data: guestEvts } = await supabase
        .from('tracking_events')
        .select('session_id, created_at')
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(5000);
      for (const e of (guestEvts ?? []) as { session_id: string; created_at: string }[]) {
        guestEventCounts.set(e.session_id, (guestEventCounts.get(e.session_id) ?? 0) + 1);
        if (!guestEventLastActive.has(e.session_id)) guestEventLastActive.set(e.session_id, e.created_at);
      }

      let guestN = 0;
      const guestRowsBuilt: UserRow[] = (guests ?? []).map((g: GuestSession) => {
        guestN++;
        const hasGuestEvents = guestEventCounts.has(g.session_id);
        return {
          id: g.session_id,
          type: 'guest' as UserType,
          name: `Guest #${guestN}`,
          university: null,
          state: null,
          savedCount: 0,
          appliedCount: 0,
          hoursLogged: 0,
          lastActive: guestEventLastActive.get(g.session_id) ?? g.created_at,
          joined: g.created_at,
          funnelStage: hasGuestEvents ? 'Browsing' : 'Passive',
          sessionId: g.session_id,
          guestSession: g,
        };
      });
      setGuestRows(guestRowsBuilt);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const allRows = useMemo(() => [...authUsers, ...guestRows], [authUsers, guestRows]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (typeFilter === 'authenticated') rows = rows.filter((r) => r.type === 'auth');
    else if (typeFilter === 'guests') rows = rows.filter((r) => r.type === 'guest');
    if (funnelFilter !== 'all') rows = rows.filter((r) => r.funnelStage === funnelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.university ?? '').toLowerCase().includes(q) ||
          (r.state ?? '').toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'last_active':
          return (b.lastActive ?? '').localeCompare(a.lastActive ?? '');
        case 'joined':
          return b.joined.localeCompare(a.joined);
        case 'saved_count':
          return b.savedCount - a.savedCount;
        case 'hours':
          return b.hoursLogged - a.hoursLogged;
      }
    });
  }, [allRows, typeFilter, funnelFilter, search, sortKey]);

  function openUser(user: UserRow) {
    setSelectedUser(user);
    setSheetOpen(true);
  }

  function openProfile(userId: string) {
    const row = authUsers.find((u) => u.id === userId);
    if (!row?.profile) return;
    const p = row.profile;
    setProfileDialogUser({
      id: p.id,
      email: '',
      full_name: p.full_name ?? '',
      university: p.university,
      major: p.major,
      graduation_year: p.graduation_year,
      city: p.city,
      state: p.state,
      phone: p.phone,
      clinical_hours: p.clinical_hours,
      email_opt_in: p.email_opt_in ?? false,
      email_verified: p.email_verified ?? false,
      created_at: p.created_at,
    });
    setProfileDialogOpen(true);
  }

  const authCount = authUsers.length;
  const guestCount = guestRows.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">All Users</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] border-blue-500/30 text-blue-400">
              <Users className="h-3 w-3 mr-1" />{authCount} authenticated
            </Badge>
            <Badge variant="outline" className="text-[11px] border-orange-500/30 text-orange-400">
              <Ghost className="h-3 w-3 mr-1" />{guestCount} guests
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, university, state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({authCount + guestCount})</SelectItem>
            <SelectItem value="authenticated">Auth ({authCount})</SelectItem>
            <SelectItem value="guests">Guests ({guestCount})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={funnelFilter} onValueChange={(v) => setFunnelFilter(v as FunnelFilter)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="Applied">Applied</SelectItem>
            <SelectItem value="Saved">Saved</SelectItem>
            <SelectItem value="Browsing">Browsing</SelectItem>
            <SelectItem value="Passive">Passive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="last_active">Last Active</SelectItem>
            <SelectItem value="joined">Joined</SelectItem>
            <SelectItem value="saved_count">Saved Count</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} users</span>
      </div>

      {/* Table */}
      {loading && allRows.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_80px_80px_80px_120px_36px] gap-0 px-3 py-2 text-[11px] font-medium text-muted-foreground bg-muted/20 border-b border-border">
            <span>Name</span>
            <span>University</span>
            <span>Stage</span>
            <span>Saved</span>
            <span>Hours</span>
            <span>State</span>
            <span>Last Active</span>
            <span />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No users match current filters.
            </div>
          ) : (
            <ScrollArea className="h-[540px]">
              <div className="divide-y divide-border/40">
                {filtered.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="w-full grid grid-cols-[1.5fr_1fr_1fr_80px_80px_80px_120px_36px] gap-0 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors text-left"
                    onClick={() => openUser(row)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${row.type === 'guest' ? 'bg-orange-400/10 text-orange-400' : 'bg-blue-400/10 text-blue-400'}`}>
                        {row.type === 'guest'
                          ? <Ghost className="h-3.5 w-3.5" />
                          : row.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{row.university ?? '—'}</span>
                    <span>
                      <Badge variant="outline" className={`text-[10px] ${funnelColor(row.funnelStage)}`}>
                        {row.funnelStage}
                      </Badge>
                    </span>
                    <span className="text-sm tabular-nums">{row.savedCount}</span>
                    <span className="text-sm tabular-nums">{row.hoursLogged}</span>
                    <span className="text-xs text-muted-foreground">{row.state ?? '—'}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {row.lastActive
                        ? formatDistanceToNow(new Date(row.lastActive), { addSuffix: true })
                        : '—'}
                    </span>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Detail sheet */}
      {selectedUser && (
        <DetailSheet
          user={selectedUser}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onOpenProfile={openProfile}
        />
      )}

      {/* Full profile dialog */}
      <AdminUserProfile
        user={profileDialogUser}
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />
    </div>
  );
}
