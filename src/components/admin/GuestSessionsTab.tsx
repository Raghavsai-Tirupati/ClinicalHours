import { useEffect, useMemo, useState, type ElementType } from "react";
import { format, formatDistanceToNow, parseISO, startOfDay, subDays } from "date-fns";
import {
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Ghost,
  Globe,
  Loader2,
  Monitor,
  MousePointer,
  RefreshCw,
  Search,
  Smartphone,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface GuestSessionRow {
  session_id: string;
  created_at: string | null;
  user_agent: string | null;
  converted_to_user_id: string | null;
}

interface TrackingEvent {
  id: string;
  session_id: string;
  event_type: string;
  page_url: string;
  referrer_url: string | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  timezone: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SessionSummary {
  sessionId: string;
  createdAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  durationMs: number;
  eventCount: number;
  pageCount: number;
  converted: boolean;
  premiumViewed: boolean;
  browser: string;
  os: string;
  device: string;
  timezone: string;
  referrer: string;
  landingPage: string;
  lastPage: string;
  pageSequence: string[];
  userAgent: string | null;
  convertedToUserId: string | null;
  events: TrackingEvent[];
}

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
}

type TimeRange = "all" | "30d" | "7d" | "24h";
type ConversionFilter = "all" | "converted" | "not-converted";
type SortKey = "lastSeen" | "createdAt" | "events" | "duration";

const PAGE_SIZE = 1000;

function getPageName(url: string): string {
  const base = url.split("?")[0];
  if (base === "/") return "Home";
  if (base === "/admin") return "Admin Dashboard";
  if (base === "/dashboard") return "Dashboard";
  if (base === "/opportunities") return "Opportunities";
  if (base === "/hours") return "Hour Tracker";
  if (base === "/premium") return "Premium";
  if (base.startsWith("/opportunities/") && base.endsWith("/application")) return "Application";
  if (base.startsWith("/opportunities/") && base.endsWith("/admin")) return "Hospital Admin";
  if (base.startsWith("/opportunities/")) return "Opportunity Detail";
  return base.replace(/^\//, "") || "Unknown";
}

function getFriendlyEventLabel(event: TrackingEvent): string {
  const pageName = getPageName(event.page_url);
  switch (event.event_type) {
    case "page_view":
      if (event.metadata?.action === "guest_mode_entered") return "Entered guest mode";
      return `Viewed ${pageName}`;
    case "button_click":
      return `Clicked ${String(event.metadata?.button_name ?? "button")}`;
    case "guest_conversion":
      return "Converted to account";
    case "signup":
      return "Signed up";
    case "login":
      return "Logged in";
    default:
      return `${event.event_type} on ${pageName}`;
  }
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Other";
}

function parseOS(ua: string | null): string {
  if (!ua) return "";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Other";
}

function formatDevice(screenWidth: number | null, screenHeight: number | null): string {
  if (!screenWidth || !screenHeight) return "Unknown device";
  if (screenWidth < 768) return `Mobile ${screenWidth}×${screenHeight}`;
  if (screenWidth < 1280) return `Tablet / Laptop ${screenWidth}×${screenHeight}`;
  return `Desktop ${screenWidth}×${screenHeight}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return "0m";
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatHostOrPath(url: string | null): string {
  if (!url) return "Direct / unknown";
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${host}${path}`;
  } catch {
    return url;
  }
}

function StatCard({ icon: Icon, label, value, sublabel }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function TopListCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{emptyLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          items.slice(0, 5).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums">{item.count}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SessionDetailDialog({
  session,
  open,
  onOpenChange,
}: {
  session: SessionSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="max-h-[90vh]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Ghost className="h-5 w-5 text-primary" />
              Guest Session
            </DialogTitle>
            <DialogDescription className="font-mono text-xs break-all">
              {session.sessionId}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-92px)] px-6 pb-6">
            <div className="space-y-6 pr-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  icon={Calendar}
                  label="Started"
                  value={format(parseISO(session.createdAt), "MMM d")}
                  sublabel={format(parseISO(session.createdAt), "h:mm a")}
                />
                <StatCard
                  icon={Clock}
                  label="Last seen"
                  value={formatDistanceToNow(parseISO(session.lastSeenAt), { addSuffix: true })}
                  sublabel={format(parseISO(session.lastSeenAt), "MMM d, h:mm a")}
                />
                <StatCard icon={Users} label="Events" value={session.eventCount} sublabel={`${session.pageCount} unique pages`} />
                <StatCard icon={ArrowRightLeft} label="Duration" value={formatDuration(session.durationMs)} sublabel={session.converted ? "Converted" : "Not converted"} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Session Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Browser</span>
                      <span className="font-medium">{session.browser}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Operating system</span>
                      <span className="font-medium">{session.os || "Unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Device</span>
                      <span className="font-medium text-right">{session.device}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Timezone</span>
                      <span className="font-medium">{session.timezone || "Unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Landing page</span>
                      <span className="font-medium text-right">{getPageName(session.landingPage)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Last page</span>
                      <span className="font-medium text-right">{getPageName(session.lastPage)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Referrer</span>
                      <span className="font-medium text-right">{formatHostOrPath(session.referrer)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Conversion</span>
                      <span className="font-medium">
                        {session.converted ? (
                          <Badge variant="outline" className="border-green-500/30 text-green-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Converted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground">
                            Not converted
                          </Badge>
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Path Sequence</CardTitle>
                    <CardDescription className="text-xs">The exact order of pages seen in this session.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {session.pageSequence.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No page views recorded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {session.pageSequence.map((page, index) => (
                          <Badge key={`${page}-${index}`} variant="outline" className="max-w-full">
                            <span className="truncate">{getPageName(page)}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Event Timeline</CardTitle>
                  <CardDescription className="text-xs">All tracked events in chronological order.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {session.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tracked events were captured for this session.</p>
                    ) : (
                      session.events
                        .slice()
                        .sort((a, b) => a.created_at.localeCompare(b.created_at))
                        .map((event, index) => (
                          <div key={event.id}>
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {event.event_type === "button_click" ? (
                                    <MousePointer className="h-4 w-4 text-primary" />
                                  ) : event.event_type === "guest_conversion" ? (
                                    <ArrowRightLeft className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium">{getFriendlyEventLabel(event)}</span>
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {event.event_type.replace(/_/g, " ")}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(event.created_at), "MMM d, h:mm:ss a")}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                                <div>
                                  <p className="text-muted-foreground">Page</p>
                                  <p className="font-medium break-all">{event.page_url}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Referrer</p>
                                  <p className="font-medium break-all">{formatHostOrPath(event.referrer_url)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Device</p>
                                  <p className="font-medium">
                                    {formatDevice(event.screen_width, event.screen_height)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Timezone</p>
                                  <p className="font-medium">{event.timezone || "Unknown"}</p>
                                </div>
                              </div>

                              {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                                    Metadata
                                  </p>
                                  <pre className="overflow-x-auto rounded-lg bg-background/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                                    {JSON.stringify(event.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            {index < session.events.length - 1 && <Separator className="my-3 opacity-40" />}
                          </div>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GuestSessionsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestSessions, setGuestSessions] = useState<GuestSessionRow[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [conversionFilter, setConversionFilter] = useState<ConversionFilter>("all");
  const [browserFilter, setBrowserFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastSeen");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const sessions: GuestSessionRow[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: sessionError } = await supabase
          .from("guest_sessions")
          .select("session_id, created_at, user_agent, converted_to_user_id")
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (sessionError) throw sessionError;
        if (!data?.length) break;

        sessions.push(...(data as GuestSessionRow[]));
        if (data.length < PAGE_SIZE) break;
      }

      const events: TrackingEvent[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: eventError } = await supabase
          .from("tracking_events")
          .select(
            "id, session_id, event_type, page_url, referrer_url, user_agent, screen_width, screen_height, timezone, metadata, created_at"
          )
          .is("user_id", null)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (eventError) throw eventError;
        if (!data?.length) break;

        events.push(...(data as TrackingEvent[]));
        if (data.length < PAGE_SIZE) break;
      }

      setGuestSessions(sessions);
      setTrackingEvents(events);
    } catch (fetchError) {
      console.error("Error fetching guest sessions:", fetchError);
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load guest sessions";
      setError(message);
      if (message.includes('relation "guest_sessions" does not exist') || message.includes("does not exist")) {
        setError("Guest sessions table not found. Please run the latest database migrations.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaries = useMemo(() => {
    const sessionMap = new Map<string, SessionSummary>();

    guestSessions.forEach((session) => {
      const createdAt = session.created_at ?? new Date().toISOString();
      sessionMap.set(session.session_id, {
        sessionId: session.session_id,
        createdAt,
        firstSeenAt: createdAt,
        lastSeenAt: createdAt,
        durationMs: 0,
        eventCount: 0,
        pageCount: 0,
        converted: Boolean(session.converted_to_user_id),
        premiumViewed: false,
        browser: parseBrowser(session.user_agent),
        os: parseOS(session.user_agent),
        device: "Unknown device",
        timezone: "",
        referrer: "",
        landingPage: "/",
        lastPage: "/",
        pageSequence: [],
        userAgent: session.user_agent,
        convertedToUserId: session.converted_to_user_id,
        events: [],
      });
    });

    trackingEvents.forEach((event) => {
      const createdAt = event.created_at;
      const current = sessionMap.get(event.session_id);
      if (!current) {
        sessionMap.set(event.session_id, {
          sessionId: event.session_id,
          createdAt,
          firstSeenAt: createdAt,
          lastSeenAt: createdAt,
          durationMs: 0,
          eventCount: 0,
          pageCount: 0,
          converted: false,
          premiumViewed: false,
          browser: parseBrowser(event.user_agent),
          os: parseOS(event.user_agent),
          device: formatDevice(event.screen_width, event.screen_height),
          timezone: event.timezone || "",
          referrer: event.referrer_url || "",
          landingPage: event.page_url,
          lastPage: event.page_url,
          pageSequence: [],
          userAgent: event.user_agent,
          convertedToUserId: null,
          events: [],
        });
      }

      const summary = sessionMap.get(event.session_id)!;
      summary.events.push(event);

      if (event.created_at < summary.firstSeenAt) summary.firstSeenAt = event.created_at;
      if (event.created_at > summary.lastSeenAt) summary.lastSeenAt = event.created_at;
      if (!summary.referrer && event.referrer_url) summary.referrer = event.referrer_url;
      if (!summary.timezone && event.timezone) summary.timezone = event.timezone;
      if (!summary.userAgent && event.user_agent) summary.userAgent = event.user_agent;
      if (!summary.browser || summary.browser === "Unknown") summary.browser = parseBrowser(event.user_agent);
      if (!summary.os) summary.os = parseOS(event.user_agent);
      summary.device = formatDevice(event.screen_width, event.screen_height);
      summary.eventCount += 1;
      summary.pageSequence.push(event.page_url);
      summary.lastPage = event.page_url;
      if (summary.pageSequence.length === 1) summary.landingPage = event.page_url;
      if (event.page_url.includes("/premium")) summary.premiumViewed = true;
      if (event.event_type === "guest_conversion") summary.converted = true;
      if (event.metadata?.converted_to_user_id && typeof event.metadata.converted_to_user_id === "string") {
        summary.converted = true;
        summary.convertedToUserId = event.metadata.converted_to_user_id;
      }
    });

    return Array.from(sessionMap.values()).map((summary) => {
      const first = parseISO(summary.firstSeenAt);
      const last = parseISO(summary.lastSeenAt);
      const pageCount = new Set(summary.pageSequence.map((page) => page.split("?")[0])).size;
      const browser = summary.browser || "Unknown";
      const os = summary.os || "";
      const eventsSorted = summary.events.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

      return {
        ...summary,
        eventCount: eventsSorted.length,
        pageCount,
        durationMs: Math.max(0, last.getTime() - first.getTime()),
        events: eventsSorted,
        browser,
        os,
        device: summary.device || "Unknown device",
      };
    }).sort((a, b) => parseISO(b.lastSeenAt).getTime() - parseISO(a.lastSeenAt).getTime());
  }, [guestSessions, trackingEvents]);

  const filteredSummaries = useMemo(() => {
    const now = new Date();
    const rangeStart =
      timeRange === "24h"
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : timeRange === "7d"
          ? subDays(now, 7)
          : timeRange === "30d"
            ? subDays(now, 30)
            : null;

    const q = searchQuery.trim().toLowerCase();

    let list = summaries.filter((summary) => {
      const createdAt = parseISO(summary.createdAt);
      if (rangeStart && createdAt < rangeStart) return false;
      if (conversionFilter === "converted" && !summary.converted) return false;
      if (conversionFilter === "not-converted" && summary.converted) return false;
      if (browserFilter !== "all" && summary.browser !== browserFilter) return false;
      if (!q) return true;

      return (
        summary.sessionId.toLowerCase().includes(q) ||
        summary.browser.toLowerCase().includes(q) ||
        summary.os.toLowerCase().includes(q) ||
        summary.device.toLowerCase().includes(q) ||
        summary.referrer.toLowerCase().includes(q) ||
        summary.pageSequence.some((page) => page.toLowerCase().includes(q)) ||
        summary.events.some((event) =>
          event.event_type.toLowerCase().includes(q) ||
          event.page_url.toLowerCase().includes(q) ||
          (event.referrer_url ?? "").toLowerCase().includes(q)
        )
      );
    });

    list = list.slice().sort((a, b) => {
      switch (sortKey) {
        case "createdAt":
          return parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime();
        case "events":
          return b.eventCount - a.eventCount;
        case "duration":
          return b.durationMs - a.durationMs;
        case "lastSeen":
        default:
          return parseISO(b.lastSeenAt).getTime() - parseISO(a.lastSeenAt).getTime();
      }
    });

    return list;
  }, [summaries, searchQuery, timeRange, conversionFilter, browserFilter, sortKey]);

  const selectedSession = useMemo(
    () => filteredSummaries.find((summary) => summary.sessionId === selectedSessionId) ?? null,
    [filteredSummaries, selectedSessionId]
  );

  const stats = useMemo(() => {
    const total = filteredSummaries.length;
    const converted = filteredSummaries.filter((summary) => summary.converted).length;
    const premiumViewed = filteredSummaries.filter((summary) => summary.premiumViewed).length;
    const active = filteredSummaries.filter((summary) => summary.eventCount > 0).length;
    const sessionsToday = filteredSummaries.filter((summary) => {
      const created = parseISO(summary.createdAt);
      const today = startOfDay(new Date());
      return created >= today;
    }).length;
    const avgEvents = total ? filteredSummaries.reduce((sum, summary) => sum + summary.eventCount, 0) / total : 0;
    const peakHourMap = new Map<number, number>();
    filteredSummaries.forEach((summary) => {
      const hour = parseISO(summary.createdAt).getHours();
      peakHourMap.set(hour, (peakHourMap.get(hour) ?? 0) + 1);
    });
    const peakHour = Array.from(peakHourMap.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      converted,
      conversionRate: total ? (converted / total) * 100 : 0,
      premiumViewed,
      active,
      sessionsToday,
      avgEvents,
      peakHour: peakHour ? peakHour[0] : null,
    };
  }, [filteredSummaries]);

  const browserBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredSummaries.forEach((summary) => {
      map.set(summary.browser, (map.get(summary.browser) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSummaries]);

  const deviceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredSummaries.forEach((summary) => {
      map.set(summary.device, (map.get(summary.device) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSummaries]);

  const landingPages = useMemo(() => {
    const map = new Map<string, number>();
    filteredSummaries.forEach((summary) => {
      const label = getPageName(summary.landingPage);
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSummaries]);

  const referrers = useMemo(() => {
    const map = new Map<string, number>();
    filteredSummaries.forEach((summary) => {
      const label = formatHostOrPath(summary.referrer);
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSummaries]);

  const browserOptions = useMemo(() => {
    return ["all", ...new Set(browserBreakdown.map((item) => item.label))];
  }, [browserBreakdown]);

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Ghost className="h-6 w-6 text-primary" />
            Guest Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Deep-dive analytics for anonymous users, session timelines, and conversion behavior.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-5">
            <p className="font-medium text-destructive">Error loading guest session data</p>
            <p className="text-sm mt-1 text-destructive/80">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} label="Total Sessions" value={stats.total.toLocaleString()} />
        <StatCard icon={ArrowRightLeft} label="Converted Sessions" value={stats.converted.toLocaleString()} />
        <StatCard icon={Monitor} label="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} />
        <StatCard icon={Calendar} label="Sessions Today" value={stats.sessionsToday.toLocaleString()} />
        <StatCard icon={Filter} label="Active Sessions" value={stats.active.toLocaleString()} sublabel="At least one tracked event" />
        <StatCard icon={CheckCircle2} label="Premium Viewers" value={stats.premiumViewed.toLocaleString()} />
        <StatCard icon={Clock} label="Avg Events / Session" value={stats.avgEvents.toFixed(1)} />
        <StatCard icon={Ghost} label="Peak Hour" value={stats.peakHour !== null ? formatHour(stats.peakHour) : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <TopListCard title="Top Browsers" items={browserBreakdown} emptyLabel="Browser distribution" />
        <TopListCard title="Device Mix" items={deviceBreakdown} emptyLabel="Screen-size distribution" />
        <TopListCard title="Top Landing Pages" items={landingPages} emptyLabel="Most common entry pages" />
        <TopListCard title="Top Referrers" items={referrers} emptyLabel="Where guests came from" />
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Session Explorer
              </CardTitle>
              <CardDescription>
                Search by session ID, browser, page path, or referrer and open any session to inspect the full timeline.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sessions..."
                  className="h-9 w-full pl-9 text-sm xl:w-[260px]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="h-9 w-[120px] text-xs">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={conversionFilter} onValueChange={(v) => setConversionFilter(v as ConversionFilter)}>
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <SelectValue placeholder="Conversion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sessions</SelectItem>
                    <SelectItem value="converted">Converted only</SelectItem>
                    <SelectItem value="not-converted">Not converted</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={browserFilter} onValueChange={setBrowserFilter}>
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <SelectValue placeholder="Browser" />
                  </SelectTrigger>
                  <SelectContent>
                    {browserOptions.map((browser) => (
                      <SelectItem key={browser} value={browser}>
                        {browser === "all" ? "All browsers" : browser}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[150px] text-xs">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastSeen">Latest activity</SelectItem>
                    <SelectItem value="createdAt">Newest sessions</SelectItem>
                    <SelectItem value="events">Most events</SelectItem>
                    <SelectItem value="duration">Longest duration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <p className="text-muted-foreground">
                No guest sessions match your filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden">
                <ScrollArea className="w-full">
                  <div className="min-w-[1100px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Last seen</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Events</TableHead>
                          <TableHead>Pages</TableHead>
                          <TableHead>Browser / OS</TableHead>
                          <TableHead>Device</TableHead>
                          <TableHead>Conversion</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSummaries.map((session) => (
                          <TableRow
                            key={session.sessionId}
                            className="cursor-pointer"
                            onClick={() => setSelectedSessionId(session.sessionId)}
                          >
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <Ghost className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{session.sessionId.slice(0, 12)}...</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(parseISO(session.createdAt), "MMM d, h:mm a")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(session.lastSeenAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-sm font-medium tabular-nums">
                              {formatDuration(session.durationMs)}
                            </TableCell>
                            <TableCell className="text-sm font-medium tabular-nums">
                              {session.eventCount}
                            </TableCell>
                            <TableCell className="text-sm font-medium tabular-nums">
                              {session.pageCount}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col">
                                <span className="font-medium">{session.browser}</span>
                                <span className="text-muted-foreground">{session.os || "Unknown"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {session.device}
                            </TableCell>
                            <TableCell>
                              {session.converted ? (
                                <Badge variant="outline" className="border-green-500/30 text-green-400">
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  Converted
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground">
                                  Not yet
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SessionDetailDialog
        session={selectedSession}
        open={Boolean(selectedSession)}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionId(null);
        }}
      />
    </div>
  );
}
