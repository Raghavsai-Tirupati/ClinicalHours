import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import {
  Eye,
  MousePointer,
  LogIn,
  UserPlus,
  ArrowRightLeft,
  RefreshCw,
  Loader2,
  Users,
  Ghost,
  Filter,
  X,
  Globe,
  Monitor,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Smartphone,
  UserCheck,
} from "lucide-react";
import AdminUserProfile from "./AdminUserProfile";

// ── Interfaces ──────────────────────────────────────────────

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

interface ProfileRow {
  id: string;
  full_name: string | null;
  email_verified: boolean;
  email_opt_in: boolean;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  created_at: string;
}

interface GuestSession {
  session_id: string;
  created_at: string;
  user_agent: string | null;
  converted_to_user_id: string | null;
}

interface SavedOpp {
  id: string;
  status: string | null;
  contacted: boolean;
  applied: boolean;
  heard_back: boolean;
  scheduled_interview: boolean;
  opportunity_id: string;
  created_at: string;
}

interface OppName {
  id: string;
  name: string;
  type: string;
}

// ── Constants ───────────────────────────────────────────────

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/opportunities": "Opportunities",
  "/profile": "Profile",
  "/auth": "Sign In / Sign Up",
  "/map": "Map View",
  "/admin": "Admin Dashboard",
  "/hours": "Hour Tracker",
  "/quiz": "Opportunity Quiz",
  "/competencies": "Competency Mapper",
  "/amcas": "AMCAS Generator",
  "/lor": "LOR Tracker",
  "/timeline": "Timeline Planner",
  "/secondaries": "Secondary Engine",
  "/costs": "Cost Simulator",
  "/school-list": "School List Builder",
  "/premium": "Premium",
  "/hospital-dashboard": "Hospital Dashboard",
  "/contact": "Contact",
  "/terms": "Terms",
  "/privacy": "Privacy",
  "/check-email": "Email Verification",
  "/verify-email": "Verify Email",
  "/verify": "Verify Email",
  "/reset-password": "Reset Password",
  "/pending-approval": "Pending Approval",
  "/projects": "Projects",
};

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: typeof Eye; color: string; bg: string }
> = {
  page_view: { label: "Viewed", icon: Eye, color: "text-blue-400", bg: "bg-blue-400/10" },
  button_click: { label: "Clicked", icon: MousePointer, color: "text-purple-400", bg: "bg-purple-400/10" },
  login: { label: "Logged In", icon: LogIn, color: "text-green-400", bg: "bg-green-400/10" },
  signup: { label: "Signed Up", icon: UserPlus, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  guest_conversion: { label: "Converted", icon: ArrowRightLeft, color: "text-amber-400", bg: "bg-amber-400/10" },
};

type ViewMode = "timeline" | "by-user";
type TimeRange = "1h" | "today" | "7d" | "30d" | "all";
type UserFilterType = "all" | "authenticated" | "guests";

// ── Helpers ─────────────────────────────────────────────────

function getPageName(url: string): string {
  const base = url.split("?")[0];
  if (PAGE_NAMES[base]) return PAGE_NAMES[base];
  if (base.startsWith("/opportunities/") && base.endsWith("/application")) return "Application Form";
  if (base.startsWith("/opportunities/") && base.endsWith("/admin")) return "Hospital Admin";
  if (base.startsWith("/opportunities/")) return "Opportunity Detail";
  return base;
}

function getTimeRangeDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case "1h": return new Date(now.getTime() - 60 * 60 * 1000);
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all": return null;
  }
}

function getEventDescription(event: TrackingEvent): string {
  const pageName = getPageName(event.page_url);

  switch (event.event_type) {
    case "page_view": {
      if (event.metadata?.action === "guest_mode_entered") return "Entered guest mode";
      return `Viewed ${pageName}`;
    }
    case "button_click":
      return `Clicked "${event.metadata?.button_name ?? "button"}" on ${pageName}`;
    case "login":
      return `Logged in via ${event.metadata?.method ?? "email"}`;
    case "signup":
      return `Signed up via ${event.metadata?.source ?? "email"}`;
    case "guest_conversion":
      return "Converted from guest to user";
    default:
      return `${event.event_type} on ${pageName}`;
  }
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Other";
}

function parseOS(ua: string | null): string {
  if (!ua) return "";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Linux")) return "Linux";
  return "";
}

// ── Subcomponents ───────────────────────────────────────────

function EventIcon({ eventType }: { eventType: string }) {
  const config = EVENT_CONFIG[eventType];
  if (!config) return <Globe className="h-3.5 w-3.5 text-muted-foreground" />;
  const Icon = config.icon;
  return <Icon className={`h-3.5 w-3.5 ${config.color}`} />;
}

function EventRow({
  event,
  userName,
  showUser = true,
}: {
  event: TrackingEvent;
  userName: string;
  showUser?: boolean;
}) {
  const description = getEventDescription(event);
  const config = EVENT_CONFIG[event.event_type];

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 hover:bg-muted/40 rounded-md transition-colors group">
      <span className="text-[11px] text-muted-foreground whitespace-nowrap pt-0.5 w-24 shrink-0 tabular-nums">
        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
      </span>
      <div className={`mt-0.5 p-1 rounded ${config?.bg ?? "bg-muted"}`}>
        <EventIcon eventType={event.event_type} />
      </div>
      {showUser && (
        <Badge
          variant="outline"
          className={`text-[11px] shrink-0 font-medium ${
            event.user_id ? "border-blue-500/30 text-blue-400" : "border-orange-500/30 text-orange-400"
          }`}
        >
          {event.user_id ? userName : "Guest"}
        </Badge>
      )}
      <span className="text-xs text-foreground/90 flex-1 min-w-0 truncate">{description}</span>
      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 tabular-nums">
        {format(new Date(event.created_at), "HH:mm:ss")}
      </span>
    </div>
  );
}

// ── User Summary ────────────────────────────────────────────

interface UserSummary {
  id: string | null;
  sessionId: string;
  name: string;
  eventCount: number;
  lastSeen: string;
  isGuest: boolean;
  pages: string[];
}

// ── User Journey Card ───────────────────────────────────────

function UserJourneyCard({
  user,
  events,
  userMap,
  guestSessionsMap,
  profilesMap,
  onBack,
  onViewProfile,
}: {
  user: UserSummary;
  events: TrackingEvent[];
  userMap: Map<string, string>;
  guestSessionsMap: Map<string, GuestSession>;
  profilesMap: Map<string, ProfileRow>;
  onBack: () => void;
  onViewProfile: (userId: string) => void;
}) {
  const [savedOpps, setSavedOpps] = useState<(SavedOpp & { name: string; type: string })[]>([]);
  const [hoursLogged, setHoursLogged] = useState<number>(0);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const userEvents = events.filter((e) =>
    user.id ? e.user_id === user.id : e.session_id === user.sessionId
  );

  const uniquePages = [...new Set(userEvents.map((e) => getPageName(e.page_url)))];
  const firstSeen = userEvents[userEvents.length - 1]?.created_at;
  const device = userEvents[0];
  const guestSession = guestSessionsMap.get(user.sessionId);
  const profile = user.id ? profilesMap.get(user.id) : null;

  useEffect(() => {
    if (!user.id) return;
    let cancelled = false;
    setLoadingExtra(true);

    (async () => {
      try {
        const [{ data: oppsData }, { data: hoursData }] = await Promise.all([
          supabase
            .from("saved_opportunities")
            .select("id, status, contacted, applied, heard_back, scheduled_interview, opportunity_id, created_at")
            .eq("user_id", user.id!)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("experience_entries")
            .select("hours")
            .eq("user_id", user.id!),
        ]);

        if (cancelled) return;

        const totalHrs = (hoursData ?? []).reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
        setHoursLogged(Math.round(totalHrs));

        if (oppsData && oppsData.length > 0) {
          const oppIds = [...new Set(oppsData.map((o) => o.opportunity_id))];
          const { data: oppNames } = await supabase
            .from("opportunities")
            .select("id, name, type")
            .in("id", oppIds);

          if (cancelled) return;

          const nameMap = new Map((oppNames ?? []).map((o: OppName) => [o.id, o]));
          setSavedOpps(
            oppsData.map((o) => ({
              ...o,
              name: nameMap.get(o.opportunity_id)?.name ?? "Unknown",
              type: nameMap.get(o.opportunity_id)?.type ?? "",
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching user extras:", err);
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user.id]);

  const statusColor = (s: string | null) => {
    switch (s) {
      case "Applied": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "Interviewing": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Completed": return "bg-green-500/10 text-green-400 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <X className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{user.name}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {user.isGuest ? (
              <span className="flex items-center gap-1"><Ghost className="h-3 w-3" /> Guest Session</span>
            ) : (
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Authenticated User</span>
            )}
            <span>{userEvents.length} events</span>
            {device?.screen_width && (
              <span className="flex items-center gap-1">
                <Monitor className="h-3 w-3" /> {device.screen_width}x{device.screen_height}
              </span>
            )}
            {device?.timezone && <span>{device.timezone}</span>}
          </div>
        </div>
        {user.id && (
          <Button variant="outline" size="sm" onClick={() => onViewProfile(user.id!)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Full Profile
          </Button>
        )}
      </div>

      {/* Guest session details */}
      {user.isGuest && guestSession && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Ghost className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-300">Guest Session Info</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Session Started</p>
                <p className="font-medium">{format(new Date(guestSession.created_at), "MMM d, yyyy HH:mm")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Browser</p>
                <p className="font-medium flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  {parseBrowser(guestSession.user_agent)} {parseOS(guestSession.user_agent) && `/ ${parseOS(guestSession.user_agent)}`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Session ID</p>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{guestSession.session_id.slice(0, 12)}...</code>
              </div>
              <div>
                <p className="text-muted-foreground">Converted?</p>
                {guestSession.converted_to_user_id ? (
                  <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">
                    <UserCheck className="h-3 w-3 mr-1" /> Yes
                  </Badge>
                ) : (
                  <span className="font-medium text-muted-foreground">No</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User profile quick info */}
      {!user.isGuest && profile && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Profile Summary</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">University</p>
                <p className="font-medium truncate">{profile.university || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Major</p>
                <p className="font-medium truncate">{profile.major || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="font-medium">{format(new Date(profile.created_at), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Clinical Hours</p>
                <p className="font-medium">{profile.clinical_hours ?? 0} hrs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{userEvents.length}</p>
            <p className="text-[11px] text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{uniquePages.length}</p>
            <p className="text-[11px] text-muted-foreground">Pages Visited</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-sm font-medium truncate">
              {firstSeen ? formatDistanceToNow(new Date(firstSeen), { addSuffix: true }) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">First Seen</p>
          </CardContent>
        </Card>
        {!user.isGuest ? (
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-4">
              <p className="text-lg font-bold">{hoursLogged}</p>
              <p className="text-[11px] text-muted-foreground">Hours Logged</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-4">
              <p className="text-sm font-medium truncate">
                {guestSession ? format(new Date(guestSession.created_at), "MMM d HH:mm") : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">Session Start</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Page journey badges */}
      <div className="flex flex-wrap gap-1.5">
        {uniquePages.map((page) => (
          <Badge key={page} variant="secondary" className="text-[11px]">{page}</Badge>
        ))}
      </div>

      {uniquePages.includes("Premium") && (
        <div className="flex items-center gap-1.5 text-xs text-amber-300">
          <BookmarkCheck className="h-3 w-3" />
          <span>Viewed the Premium page (likely considering upgrade)</span>
        </div>
      )}

      {/* Saved Opportunities (for authenticated users) */}
      {!user.isGuest && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-blue-400" />
              Saved Opportunities ({savedOpps.length})
              {loadingExtra && <Loader2 className="h-3 w-3 animate-spin" />}
            </CardTitle>
          </CardHeader>
          {savedOpps.length > 0 && (
            <CardContent className="pt-0 px-4 pb-3">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {savedOpps.map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {opp.type && <Badge variant="outline" className="text-[10px] shrink-0">{opp.type}</Badge>}
                      <span className="truncate">{opp.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opp.applied && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Applied</Badge>}
                      {opp.heard_back && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">Heard Back</Badge>}
                      {opp.scheduled_interview && <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">Interview</Badge>}
                      <Badge variant="outline" className={`text-[10px] ${statusColor(opp.status)}`}>
                        {opp.status || "Saved"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Event timeline */}
      <div className="border rounded-lg">
        <div className="px-3 py-2 border-b border-border/40 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Event Timeline
          </p>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="p-2">
            {userEvents.map((event) => (
              <EventRow key={event.id} event={event} userName={user.name} showUser={false} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export function AdminActivityTab() {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [profilesMap, setProfilesMap] = useState<Map<string, ProfileRow>>(new Map());
  const [guestSessionsMap, setGuestSessionsMap] = useState<Map<string, GuestSession>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [userFilter, setUserFilter] = useState<UserFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);

  // AdminUserProfile dialog state
  const [profileDialogUser, setProfileDialogUser] = useState<{
    id: string; email: string; full_name: string;
    university: string | null; major: string | null; graduation_year: number | null;
    city: string | null; state: string | null; phone: string | null;
    clinical_hours: number | null; email_opt_in: boolean; email_verified: boolean;
    created_at: string;
  } | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const fetchEvents = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        let query = supabase
          .from("tracking_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000);

        const rangeDate = getTimeRangeDate(timeRange);
        if (rangeDate) {
          query = query.gte("created_at", rangeDate.toISOString());
        }

        const { data: eventsData, error } = await query;
        if (error) throw error;

        const raw = (eventsData ?? []) as TrackingEvent[];
        setEvents(raw);

        // Fetch profiles for authenticated user IDs
        const userIds = [...new Set(raw.filter((e) => e.user_id).map((e) => e.user_id!))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email_verified, email_opt_in, university, major, graduation_year, city, state, phone, clinical_hours, created_at")
            .in("id", userIds);

          const nameMap = new Map<string, string>();
          const profMap = new Map<string, ProfileRow>();
          (profiles ?? []).forEach((p: ProfileRow) => {
            nameMap.set(p.id, p.full_name || `User ${p.id.slice(0, 6)}`);
            profMap.set(p.id, p);
          });
          setUserMap(nameMap);
          setProfilesMap(profMap);
        }

        // Fetch guest sessions for guest session IDs
        const guestSessionIds = [...new Set(raw.filter((e) => !e.user_id).map((e) => e.session_id))];
        if (guestSessionIds.length > 0) {
          const { data: guestData } = await supabase
            .from("guest_sessions")
            .select("session_id, created_at, user_agent, converted_to_user_id")
            .in("session_id", guestSessionIds);

          const gsMap = new Map<string, GuestSession>();
          (guestData ?? []).forEach((gs: GuestSession) => {
            gsMap.set(gs.session_id, gs);
          });
          setGuestSessionsMap(gsMap);
        }

        setLastFetched(new Date());
      } catch (err) {
        console.error("Error fetching activity:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeRange]
  );

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => fetchEvents(true), 10_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (userFilter === "authenticated") result = result.filter((e) => e.user_id);
    else if (userFilter === "guests") result = result.filter((e) => !e.user_id);
    if (eventTypeFilter.length > 0) result = result.filter((e) => eventTypeFilter.includes(e.event_type));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => {
        const name = e.user_id ? userMap.get(e.user_id) ?? "" : "";
        return (
          name.toLowerCase().includes(q) ||
          e.page_url.toLowerCase().includes(q) ||
          e.event_type.toLowerCase().includes(q) ||
          e.session_id.toLowerCase().includes(q) ||
          (e.user_id && e.user_id.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [events, userFilter, eventTypeFilter, searchQuery, userMap]);

  const userSummaries = useMemo(() => {
    const map = new Map<string, UserSummary>();
    filteredEvents.forEach((e) => {
      const key = e.user_id ?? `guest:${e.session_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.eventCount++;
        if (e.created_at > existing.lastSeen) existing.lastSeen = e.created_at;
        const pageName = getPageName(e.page_url);
        if (!existing.pages.includes(pageName)) existing.pages.push(pageName);
      } else {
        map.set(key, {
          id: e.user_id,
          sessionId: e.session_id,
          name: e.user_id ? userMap.get(e.user_id) ?? `User ${e.user_id.slice(0, 6)}` : `Guest ${e.session_id.slice(0, 8)}`,
          eventCount: 1,
          lastSeen: e.created_at,
          isGuest: !e.user_id,
          pages: [getPageName(e.page_url)],
        });
      }
    });
    return [...map.values()].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  }, [filteredEvents, userMap]);

  const eventTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredEvents.forEach((e) => { counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1); });
    return counts;
  }, [filteredEvents]);

  const toggleEventType = (type: string) => {
    setEventTypeFilter((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  const handleViewProfile = (userId: string) => {
    const profile = profilesMap.get(userId);
    if (!profile) return;

    // Fetch email from auth to complete the profile object
    // We don't have email in profiles, so use a placeholder from the user map
    setProfileDialogUser({
      id: profile.id,
      email: "", // will be populated by the AdminUserProfile edge function
      full_name: profile.full_name || "",
      university: profile.university,
      major: profile.major,
      graduation_year: profile.graduation_year,
      city: profile.city,
      state: profile.state,
      phone: profile.phone,
      clinical_hours: profile.clinical_hours,
      email_opt_in: profile.email_opt_in ?? false,
      email_verified: profile.email_verified ?? false,
      created_at: profile.created_at,
    });
    setProfileDialogOpen(true);
  };

  // ── Render: User Journey ────────────────────────────────────
  if (selectedUser) {
    return (
      <>
        <UserJourneyCard
          user={selectedUser}
          events={events}
          userMap={userMap}
          guestSessionsMap={guestSessionsMap}
          profilesMap={profilesMap}
          onBack={() => setSelectedUser(null)}
          onViewProfile={handleViewProfile}
        />
        <AdminUserProfile user={profileDialogUser} open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      </>
    );
  }

  // ── Render: Main View ───────────────────────────────────────
  const guestCount = events.filter((e) => !e.user_id).length;
  const authCount = events.filter((e) => e.user_id).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Activity Feed</h2>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
          {refreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{filteredEvents.length} events</span>
          {lastFetched && (
            <span className="text-[10px] text-muted-foreground">Updated {format(lastFetched, "HH:mm:ss")}</span>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchEvents()} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="py-2.5 px-3">
            <p className="text-lg font-bold tabular-nums">{filteredEvents.length}</p>
            <p className="text-[11px] text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-2.5 px-3">
            <p className="text-lg font-bold tabular-nums">{userSummaries.filter((u) => !u.isGuest).length}</p>
            <p className="text-[11px] text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-2.5 px-3">
            <p className="text-lg font-bold tabular-nums">{userSummaries.filter((u) => u.isGuest).length}</p>
            <p className="text-[11px] text-muted-foreground">Guest Sessions</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-2.5 px-3">
            <p className="text-lg font-bold tabular-nums">
              {userSummaries.filter((u) => u.pages.includes("Premium")).length}
            </p>
            <p className="text-[11px] text-muted-foreground">Viewed Premium</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={(v) => setUserFilter(v as UserFilterType)}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({authCount + guestCount})</SelectItem>
            <SelectItem value="authenticated">Users ({authCount})</SelectItem>
            <SelectItem value="guests">Guests ({guestCount})</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search user, page, session..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-56 h-8 text-xs" />
        <div className="flex items-center gap-1 ml-auto">
          <Button variant={viewMode === "timeline" ? "secondary" : "ghost"} size="sm" className="h-8 text-xs px-3" onClick={() => setViewMode("timeline")}>Timeline</Button>
          <Button variant={viewMode === "by-user" ? "secondary" : "ghost"} size="sm" className="h-8 text-xs px-3" onClick={() => setViewMode("by-user")}>By User</Button>
        </div>
      </div>

      {/* Event type pills */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EVENT_CONFIG).map(([type, cfg]) => {
          const count = eventTypeCounts.get(type) ?? 0;
          const active = eventTypeFilter.length === 0 || eventTypeFilter.includes(type);
          return (
            <button key={type} onClick={() => toggleEventType(type)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                active ? `${cfg.bg} ${cfg.color} border-current/20` : "bg-muted/20 text-muted-foreground border-transparent opacity-50"
              }`}
            >
              <cfg.icon className="h-3 w-3" /> {cfg.label} ({count})
            </button>
          );
        })}
        {eventTypeFilter.length > 0 && (
          <button onClick={() => setEventTypeFilter([])} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Content */}
      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : viewMode === "timeline" ? (
        <div className="border rounded-lg">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Filter className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>No activity found for this time range.</p>
              <p className="text-xs mt-1">Events will appear as users browse the site.</p>
            </div>
          ) : (
            <ScrollArea className="h-[520px]">
              <div className="p-2">
                {filteredEvents.map((event) => (
                  <EventRow key={event.id} event={event}
                    userName={event.user_id ? userMap.get(event.user_id) ?? `User ${event.user_id.slice(0, 6)}` : `Guest ${event.session_id.slice(0, 8)}`}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          {userSummaries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>No users found for this time range.</p>
            </div>
          ) : (
            <ScrollArea className="h-[520px]">
              <div className="divide-y divide-border/50">
                {userSummaries.map((user) => (
                  <button key={user.id ?? user.sessionId}
                    className="w-full flex items-center gap-3 py-3 px-4 hover:bg-muted/40 transition-colors text-left"
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      user.isGuest ? "bg-orange-400/10 text-orange-400" : "bg-blue-400/10 text-blue-400"
                    }`}>
                      {user.isGuest ? <Ghost className="h-4 w-4" /> : user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        {user.pages.includes("Premium") && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/30 text-amber-400"
                          >
                            Premium
                          </Badge>
                        )}
                        {user.isGuest && guestSessionsMap.get(user.sessionId)?.converted_to_user_id && (
                          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">Converted</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.pages.slice(0, 4).join(" → ")}
                        {user.pages.length > 4 && ` +${user.pages.length - 4}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium tabular-nums">{user.eventCount} events</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Profile dialog (rendered at root level) */}
      <AdminUserProfile user={profileDialogUser} open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </div>
  );
}
