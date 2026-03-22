import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import HeroBanner from "@/components/HeroBanner";
import OpportunityDialog from "@/components/OpportunityDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { localSelect, TABLES } from "@/lib/localStore";
import { DashboardTutorial } from "@/components/DashboardTutorial";
import { getGuestSessionId } from "@/hooks/useAuth";
import { shouldShowGuestTutorial } from "@/lib/dashboardTutorial";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Briefcase,
  FileText,
  CalendarClock,
  Search,
  Plus,
  MoreHorizontal,
  Globe,
  Pencil,
  Trash2,
  Quote,
  ArrowRight,
  Loader2,
  Building2,
  Stethoscope,
  ExternalLink,
} from "lucide-react";
import HospitalLogo from "@/components/HospitalLogo";
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from "@/types/positions";
import type { ApplicationStatus, PositionType } from "@/types/positions";

// ─── Types ──────────────────────────────────────────────────────────────────

type OpportunityStatus = "Saved" | "Applied" | "Interviewing" | "Completed";

interface Opportunity {
  id: string;           // saved_opportunities.id — used for DB remove/update
  opportunityId: string; // opportunities.id — used for experience_entries lookup
  name: string;
  type: string;
  website: string;
  location: string;
  status: OpportunityStatus;
  deadline: string | null;
  hoursLogged: number;
  reflectionCount: number;
  logo_url: string | null;
}

interface Reflection {
  id: string;
  opportunityId: string;
  orgName: string;
  date: string;
  text: string;
}

interface SavedOpportunityRow {
  id: string;
  opportunity_id: string;
  status: string | null;
  opportunities: {
    id: string;
    name: string;
    type: string | null;
    location: string | null;
    website: string | null;
    logo_url: string | null;
  } | null;
}

interface ExperienceEntryRow {
  id: string;
  opportunity_id: string;
  hours: number | null;
  moment: string | null;
  entry_date: string;
}

interface DashboardApplication {
  id: string;
  status: ApplicationStatus;
  submitted_at: string;
  position_title: string;
  position_type: PositionType;
  hospital_name: string;
}

/** Preview count on the dashboard; full list is on /my-applications */
const DASHBOARD_APPLICATIONS_PREVIEW_LIMIT = 2;

/** Matches `opportunities.slug` in the database */
const BCS_OPPORTUNITY_SLUG = "bcs-free-health-clinic";

function isBcsHospitalName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("bcs free health clinic") || (n.includes("bcs") && n.includes("clinic"));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(deadline: string | null): string | null {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  if (days < 0) return "Past due";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

const statusColors: Record<OpportunityStatus, string> = {
  Saved: "bg-zinc-700/60 text-zinc-300",
  Applied: "bg-blue-900/50 text-blue-300",
  Interviewing: "bg-amber-900/50 text-amber-300",
  Completed: "bg-emerald-900/50 text-emerald-300",
};

const applicationStatusColors: Record<ApplicationStatus, string> = {
  new: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  under_review: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  accepted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-300 border-red-500/30",
  waitlisted: "bg-purple-500/10 text-purple-300 border-purple-500/30",
};

const typeColors: Record<string, string> = {
  hospital: "border-red-500/40 text-red-300",
  clinic: "border-blue-500/40 text-blue-300",
  hospice: "border-purple-500/40 text-purple-300",
  emt: "border-orange-500/40 text-orange-300",
  volunteer: "border-teal-500/40 text-teal-300",
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function OpportunityCard({
  opp,
  onStatusChange,
  onRemove,
  onLogHours,
  onAddReflection,
  onCardClick,
}: {
  opp: Opportunity;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onRemove: (id: string) => void;
  onLogHours: (opp: Opportunity) => void;
  onAddReflection: (opp: Opportunity) => void;
  onCardClick: (opp: Opportunity) => void;
}) {
  const dl = deadlineLabel(opp.deadline);
  const dlDays = opp.deadline ? daysUntil(opp.deadline) : null;
  const dlUrgent = dlDays !== null && dlDays >= 0 && dlDays <= 3;

  return (
    <div
      className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80 cursor-pointer"
      onClick={() => onCardClick(opp)}
    >
      {/* Top row: logo + name + 3-dot menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0 flex-1">
          <HospitalLogo
            logoUrl={opp.logo_url}
            hospitalName={opp.name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-medium text-foreground">
              {opp.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{opp.location}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {opp.website && (
              <DropdownMenuItem asChild>
                <a
                  href={opp.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" /> Visit Website
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onRemove(opp.id); }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pills row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            typeColors[opp.type] || "border-border text-muted-foreground"
          }`}
        >
          {opp.type === "emt" ? "EMT" : opp.type.charAt(0).toUpperCase() + opp.type.slice(1)}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[opp.status]}`}
        >
          {opp.status}
        </span>
        {dl && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              dlUrgent
                ? "bg-red-900/50 text-red-300"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {dl}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> {opp.hoursLogged}h logged
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> {opp.reflectionCount} reflections
        </span>
      </div>

      {/* Actions row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onLogHours(opp); }}
        >
          Log Hours
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onAddReflection(opp); }}
        >
          Add Reflection
        </Button>
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            value={opp.status}
            onValueChange={(val) =>
              onStatusChange(opp.id, val as OpportunityStatus)
            }
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Saved">Saved</SelectItem>
              <SelectItem value="Applied">Applied</SelectItem>
              <SelectItem value="Interviewing">Interviewing</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ReflectionBlock({ reflection }: { reflection: Reflection }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Quote className="h-3.5 w-3.5 text-primary/60" />
        <span className="font-medium text-foreground/80">
          {reflection.orgName}
        </span>
        <span>&middot;</span>
        <time>
          {new Date(reflection.date.includes("T") ? reflection.date : reflection.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {reflection.text}
      </p>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, isGuest } = useAuth();
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardTutorialComplete, setDashboardTutorialComplete] = useState(true);
  const [dashboardApplications, setDashboardApplications] = useState<DashboardApplication[]>([]);

  const recentDashboardApplications = useMemo(() => {
    const sorted = [...dashboardApplications].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
    return sorted.slice(0, DASHBOARD_APPLICATIONS_PREVIEW_LIMIT);
  }, [dashboardApplications]);

  const bcsDashboardApplications = useMemo(
    () => dashboardApplications.filter((app) => isBcsHospitalName(app.hospital_name)),
    [dashboardApplications]
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogOpp, setDialogOpp] = useState<Opportunity | null>(null);
  const [dialogTab, setDialogTab] = useState("overview");

  const localReflections = useMemo(
    () =>
      localSelect<{
        id: string;
        activity_log_id: string;
        what_happened: string | null;
        what_stood_out: string | null;
        what_learned: string | null;
        created_at: string;
      }>(TABLES.REFLECTIONS),
    []
  );

  const localLogs = useMemo(
    () =>
      localSelect<{
        id: string;
        custom_organization_name: string | null;
        session_date: string;
        hours: number;
      }>(TABLES.ACTIVITY_LOGS),
    []
  );

  // Get the user's first name from their metadata, or default for guests
  const firstName = useMemo(() => {
    if (isGuest || !user) return undefined;
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    if (fullName) return fullName.split(' ')[0];
    const email = user.email || '';
    return email.split('@')[0] || undefined;
  }, [user, isGuest]);

  // ── Fetch real data from DB ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || isGuest) {
      setLoadingData(false);
      return;
    }

    async function fetchDashboardData() {
      const fetchStart = performance.now();
      setLoadingData(true);
      try {
        const [profileRes, savedRes, entriesRes, clinicAppsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("dashboard_tutorial_complete")
            .eq("id", user!.id)
            .single(),
          supabase
            .from("saved_opportunities")
            .select(`
              id,
              opportunity_id,
              status,
              created_at,
              opportunities (
                id,
                name,
                type,
                location,
                website,
                logo_url
              )
            `)
            .eq("user_id", user!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("experience_entries")
            .select("id, opportunity_id, hours, moment, entry_date")
            .eq("user_id", user!.id)
            .order("entry_date", { ascending: false }),
          supabase
            .from("student_applications")
            .select(`
              id, status, submitted_at,
              hospital_positions (
                title, position_type, hospital_page_id,
                hospital_pages:hospital_page_id (
                  opportunities:hospital_id (name)
                )
              )
            `)
            .eq("student_id", user!.id)
            .order("submitted_at", { ascending: false }),
        ]);

        setDashboardTutorialComplete(Boolean(profileRes.data?.dashboard_tutorial_complete));

        if (savedRes.error) throw savedRes.error;
        if (entriesRes.error) throw entriesRes.error;
        if (clinicAppsRes.error) throw clinicAppsRes.error;

        const savedRows = ((savedRes.data || []) as unknown as Array<{
          id: string;
          opportunity_id: string;
          status: string | null;
          created_at: string;
          opportunities: { id: string; name: string; type: string; location: string; website: string; logo_url: string; } | { id: string; name: string; type: string; location: string; website: string; logo_url: string; }[];
        }>).map(row => ({
          id: row.id,
          opportunity_id: row.opportunity_id,
          status: row.status,
          opportunities: Array.isArray(row.opportunities) ? row.opportunities[0] ?? null : row.opportunities,
        })) as SavedOpportunityRow[];
        const entries = (entriesRes.data || []) as ExperienceEntryRow[];
        const parsedApplications = ((clinicAppsRes.data || []) as Record<string, unknown>[]).map((row) => {
          const position = row.hospital_positions as Record<string, unknown> | null;
          const page = position?.hospital_pages as Record<string, unknown> | null;
          const opportunity = page?.opportunities as Record<string, unknown> | null;
          return {
            id: row.id as string,
            status: (row.status || "new") as ApplicationStatus,
            submitted_at: row.submitted_at as string,
            position_title: (position?.title || "Unknown Position") as string,
            position_type: (position?.position_type || "volunteer") as PositionType,
            hospital_name: (opportunity?.name || "Unknown Hospital") as string,
          };
        });

        setDashboardApplications(parsedApplications);

        // Build aggregation maps keyed by opportunity_id
        const hoursMap: Record<string, number> = {};
        const reflCountMap: Record<string, number> = {};
        entries.forEach((e) => {
          const oid = e.opportunity_id;
          hoursMap[oid] = (hoursMap[oid] || 0) + (Number(e.hours) || 0);
          if (e.moment) reflCountMap[oid] = (reflCountMap[oid] || 0) + 1;
        });

        // Build name lookup for reflections section
        const nameMap: Record<string, string> = {};

        // Map saved rows to dashboard Opportunity objects
        const opps: Opportunity[] = savedRows.map((row) => {
          const opp = row.opportunities;
          const oppId = row.opportunity_id;
          const oppName = opp?.name || "Unknown";
          nameMap[oppId] = oppName;

          return {
            id: row.id,
            opportunityId: oppId,
            name: oppName,
            type: opp?.type || "hospital",
            website: opp?.website || "",
            location: opp?.location || "",
            status: ((row.status as string) || "Saved") as OpportunityStatus,
            deadline: null,
            hoursLogged: Math.round((hoursMap[oppId] || 0) * 10) / 10,
            reflectionCount: reflCountMap[oppId] || 0,
            logo_url: opp?.logo_url ?? null,
          };
        });

        setOpportunities(opps);

        // Map experience entries with moments to reflections
        const recentReflections: Reflection[] = entries
          .filter((e) => !!e.moment)
          .map((e) => ({
            id: e.id,
            opportunityId: e.opportunity_id,
            orgName: nameMap[e.opportunity_id] || "Unknown",
            date: e.entry_date,
            text: e.moment || "",
          }));

        // Merge in reflections from local store (Hour Tracker)
        const logMap = new Map(localLogs.map((l) => [l.id, l]));

        const localMapped: Reflection[] = localReflections.map((r) => {
          const log = logMap.get(r.activity_log_id);
          const text = [r.what_happened, r.what_stood_out, r.what_learned].filter(Boolean).join(" — ");
          return {
            id: `local-${r.id}`,
            opportunityId: "",
            orgName: log?.custom_organization_name || "Hour Tracker",
            date: log?.session_date || r.created_at,
            text: text || "Reflection recorded",
          };
        });

        const allReflections = [...recentReflections, ...localMapped]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 6);

        setReflections(allReflections);
        if (import.meta.env.DEV) {
          const elapsed = Math.round(performance.now() - fetchStart);
          console.info(`[Perf] Dashboard loaded in ${elapsed}ms`);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        toast({
          title: "Error loading dashboard",
          description: "Could not fetch your saved opportunities.",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    }

    fetchDashboardData();
  }, [user, isGuest, toast, localLogs, localReflections]);

  /** Guard: prompt sign-in for guest actions */
  const requireAuth = (action: string): boolean => {
    if (isGuest || !user) {
      toast({
        title: 'Sign in required',
        description: `Create an account to ${action}.`,
      });
      return false;
    }
    return true;
  };

  const openDialog = (opp: Opportunity, tab: string) => {
    setDialogOpp(opp);
    setDialogTab(tab);
    setDialogOpen(true);
  };

  // Derived data
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return opportunities;
    const q = searchQuery.toLowerCase();
    return opportunities.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.location.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q)
    );
  }, [opportunities, searchQuery]);

  const localTrackerHours = useMemo(
    () => localLogs.reduce((s, l) => s + (l.hours || 0), 0),
    [localLogs]
  );
  const totalHours = opportunities.reduce((s, o) => s + o.hoursLogged, 0) + localTrackerHours;
  const hasExperience = totalHours > 0;
  const hasTrackedOpportunities = opportunities.length > 0;
  const guestTutorialVisible = isGuest && shouldShowGuestTutorial(getGuestSessionId());
  const accountTutorialVisible = Boolean(user && !isGuest && !dashboardTutorialComplete);
  const activeCount = opportunities.filter(
    (o) => o.status !== "Completed"
  ).length;
  const reflectionCount = opportunities.reduce(
    (s, o) => s + o.reflectionCount,
    0
  );

  const nextDeadline = useMemo(() => {
    const upcoming = opportunities
      .filter((o) => o.deadline && daysUntil(o.deadline) >= 0)
      .sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!));
    if (upcoming.length === 0) return "No upcoming deadlines";
    return deadlineLabel(upcoming[0].deadline)!;
  }, [opportunities]);

  const handleStatusChange = async (id: string, status: OpportunityStatus) => {
    if (!requireAuth('update opportunity status')) return;
    // Optimistic update
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    const { error } = await supabase
      .from("saved_opportunities")
      .update({ status })
      .eq("id", id);
    if (error) {
      // Revert on failure
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      // Re-fetch would be cleaner but a revert by re-querying is simpler
    }
  };

  const handleRemove = async (id: string) => {
    if (!requireAuth('remove opportunities')) return;
    // Optimistic remove
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    const { error } = await supabase
      .from("saved_opportunities")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to remove opportunity.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* ─── Full-page background image layer ──────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero/clinicalhours-hero-bg.webp')" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "rgba(9,9,11,0.35)" }}
        />
      </div>

      <Navigation />

      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 relative z-10">
        {/* ─── Hero Banner ────────────────────────────────── */}
        <HeroBanner firstName={firstName} isGuest={isGuest} />

        {/* ─── Guest Banner ────────────────────────────────── */}
        {isGuest && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-200">You&apos;re browsing as a guest</p>
              <p className="text-xs text-amber-200/60 mt-0.5">Sign up to save opportunities, log hours, and track your progress.</p>
            </div>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center text-xs font-semibold uppercase tracking-widest px-5 py-2.5 bg-white text-black hover:bg-white/90 rounded-lg transition-all shrink-0"
            >
              Create Account
            </Link>
          </div>
        )}

        {/* ─── Featured: BCS Free Health Clinic ───────────── */}
        <section
          className="mt-6 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.07] backdrop-blur-sm overflow-hidden"
          aria-labelledby="dashboard-bcs-feature-heading"
        >
          <div className="px-5 py-5 sm:px-6 sm:py-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex gap-4 min-w-0">
              <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <Stethoscope className="h-5 w-5 text-emerald-400" aria-hidden />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
                  Featured — now accepting applications
                </p>
                <h2
                  id="dashboard-bcs-feature-heading"
                  className="text-lg sm:text-xl font-semibold text-foreground tracking-tight"
                >
                  BCS Free Health Clinic
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Free community health clinic in Bryan / College Station, Texas. Open positions are listed on the
                  opportunity page—apply to a role from there.
                </p>
                <a
                  href="https://bcshealthclinic.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  bcshealthclinic.org
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </a>
                {!isGuest && user && bcsDashboardApplications.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    You have {bcsDashboardApplications.length}{" "}
                    {bcsDashboardApplications.length === 1 ? "application" : "applications"} to this clinic —{" "}
                    <Link to="/my-applications" className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
                      view in My Applications
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <Button asChild className="h-10 gap-1.5 font-medium border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25">
                <Link to={`/opportunities/${BCS_OPPORTUNITY_SLUG}`}>
                  View opportunity <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ─── Dashboard content ─────────────────────────── */}
        <div className="mt-8">
          {(guestTutorialVisible || accountTutorialVisible) && (
            <DashboardTutorial
              mode={guestTutorialVisible ? "guest" : "account"}
              tutorialKey={guestTutorialVisible ? (getGuestSessionId() || user?.id || "guest") : (user?.id || "account")}
              hasExperience={hasExperience}
              hasTrackedOpportunities={hasTrackedOpportunities}
              onComplete={async () => {
                if (user && !isGuest) {
                  setDashboardTutorialComplete(true);
                  await supabase
                    .from("profiles")
                    .update({ dashboard_tutorial_complete: true })
                    .eq("id", user.id);
                }
              }}
            />
          )}
          {/* Toolbar */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-medium text-foreground">Your Dashboard</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search opportunities..."
                  className="h-9 w-[220px] pl-9 text-sm"
                  aria-label="Search opportunities"
                />
              </div>
              <Button size="sm" className="h-9 gap-1.5" asChild>
                <Link to="/opportunities">
                  <Plus className="h-4 w-4" /> Add
                </Link>
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {loadingData ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Progress Summary */}
              <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon={Clock} label="Total Hours Logged" value={Math.round(totalHours * 10) / 10} />
                <StatCard icon={Briefcase} label="Active Opportunities" value={activeCount} />
                <StatCard icon={FileText} label="Experiences Recorded" value={reflectionCount} />
                <StatCard icon={CalendarClock} label="Next Deadline" value={nextDeadline} />
              </div>

              {/* Applications preview (full list: /my-applications) */}
              <section className="mb-10">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-foreground">Applications</h2>
                  <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                    <Link to="/my-applications">
                      View all applications <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                {dashboardApplications.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                    No applications yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentDashboardApplications.map((app) => (
                      <div key={app.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="truncate">{app.hospital_name}</span>
                        </div>
                        <p className="font-medium text-foreground">{app.position_title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {POSITION_TYPE_LABELS[app.position_type]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${applicationStatusColors[app.status]}`}
                          >
                            {APPLICATION_STATUS_LABELS[app.status]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Applied {new Date(app.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Tracked Opportunities */}
              <section className="mb-10">
                <h2 className="mb-4 text-lg font-medium text-foreground">Tracked Opportunities</h2>
                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-16 text-center">
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No opportunities match your search."
                        : "No tracked opportunities yet. Browse and save some to get started."}
                    </p>
                    {!searchQuery && (
                      <Button asChild variant="outline" size="sm" className="mt-4">
                        <Link to="/opportunities">Browse Opportunities</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((opp) => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        onStatusChange={handleStatusChange}
                        onRemove={handleRemove}
                        onLogHours={(o) => { if (requireAuth('log hours')) openDialog(o, "hours"); }}
                        onAddReflection={(o) => { if (requireAuth('add reflections')) openDialog(o, "reflections"); }}
                        onCardClick={(o) => {
                          const isAppFlow = o.status === "Interviewing" || o.status === "Applied" || o.status === "Saved";
                          openDialog(o, isAppFlow ? "checklist" : "overview");
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Reflections */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-foreground">Recent Reflections</h2>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                    View all reflections <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {reflections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reflections yet. Log experience entries with notes to see them here.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {reflections.map((r) => (
                      <ReflectionBlock key={r.id} reflection={r} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />

      <OpportunityDialog
        opportunity={dialogOpp}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultTab={dialogTab}
      />
    </div>
  );
};

export default Dashboard;
