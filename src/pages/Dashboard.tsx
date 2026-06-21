import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
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
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { shouldShowGuestTutorial } from "@/lib/dashboardTutorial";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Briefcase,
  FileText,
  CalendarClock,
  Search,
  Plus,
  ArrowRight,
  Loader2,
  Building2,
  Sparkles,
  X,
  Download,
  MessageCircle,
} from "lucide-react";
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from "@/types/positions";
import type { ApplicationStatus, PositionType } from "@/types/positions";
import { type OpportunityStatus, type Opportunity, type Reflection, type DashboardApplication, daysUntil, deadlineLabel } from "@/components/dashboard/types";
import { StatCard } from "@/components/dashboard/StatCard";
import { OpportunityCard } from "@/components/dashboard/OpportunityCard";
import { ReflectionBlock } from "@/components/dashboard/ReflectionBlock";
import { ActivationChecklist } from "@/components/dashboard/ActivationChecklist";
import { ThisWeekRail } from "@/components/dashboard/ThisWeekRail";
import { HoursGoalWidget } from "@/components/dashboard/HoursGoalWidget";
import { RecommendedStrip } from "@/components/dashboard/RecommendedStrip";
import { ApplyYearCountdown } from "@/components/dashboard/ApplyYearCountdown";
import { PaceInsight } from "@/components/dashboard/PaceInsight";

interface SavedOpportunityRow {
  id: string;
  opportunity_id: string;
  status: string | null;
  notes: string | null;
  reminder_date: string | null;
  last_contact_date: string | null;
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

/** Preview count on the dashboard; full list is on /my-applications */
const DASHBOARD_APPLICATIONS_PREVIEW_LIMIT = 2;

/** Matches `opportunities.slug` in the database */
const BCS_OPPORTUNITY_SLUG = "bcs-free-health-clinic";

function isBcsHospitalName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("bcs free health clinic") || (n.includes("bcs") && n.includes("clinic"));
}

const applicationStatusColors: Record<ApplicationStatus, string> = {
  new: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  under_review: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  interview: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  accepted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-300 border-red-500/30",
  waitlisted: "bg-purple-500/10 text-purple-300 border-purple-500/30",
};

// ─── Dashboard Page ─────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, isGuest } = useAuth();
  const { isPremium } = usePremiumStatus();
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardTutorialComplete, setDashboardTutorialComplete] = useState(true);
  const [dashboardApplications, setDashboardApplications] = useState<DashboardApplication[]>([]);
  const [dashboardRefreshTick, setDashboardRefreshTick] = useState(0);
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem("clinicalhours_checklist_dismissed") === "true"
  );
  const [bcsBannerDismissed, setBcsBannerDismissed] = useState(
    () => localStorage.getItem("clinicalhours_bcs_banner_dismissed") === "true"
  );
  const [feedbackBannerDismissed, setFeedbackBannerDismissed] = useState(
    () => localStorage.getItem("clinicalhours_feedback_banner_dismissed") === "true"
  );
  const applyYear = useMemo<number | null>(() => {
    const raw = localStorage.getItem("ch_apply_year");
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 2024 ? parsed : null;
  }, []);
  const [hasCity, setHasCity] = useState(false);

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

  const savedOppIds = useMemo(
    () => new Set(opportunities.map((o) => o.opportunityId)),
    [opportunities]
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
            .select("dashboard_tutorial_complete, city, university")
            .eq("id", user!.id)
            .single(),
          supabase
            .from("saved_opportunities")
            .select(`
              id,
              opportunity_id,
              status,
              notes,
              reminder_date,
              last_contact_date,
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
        setHasCity(
          !!(profileRes.data?.city?.trim() || profileRes.data?.university?.trim())
        );

        if (savedRes.error) throw savedRes.error;
        if (entriesRes.error) throw entriesRes.error;
        if (clinicAppsRes.error) throw clinicAppsRes.error;

        const savedRows = ((savedRes.data || []) as unknown as Array<{
          id: string;
          opportunity_id: string;
          status: string | null;
          notes: string | null;
          reminder_date: string | null;
          last_contact_date: string | null;
          created_at: string;
          opportunities: { id: string; name: string; type: string; location: string; website: string; logo_url: string; } | { id: string; name: string; type: string; location: string; website: string; logo_url: string; }[];
        }>).map(row => ({
          id: row.id,
          opportunity_id: row.opportunity_id,
          status: row.status,
          notes: row.notes ?? null,
          reminder_date: row.reminder_date ?? null,
          last_contact_date: row.last_contact_date ?? null,
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
            notes: row.notes ?? null,
            reminder_date: row.reminder_date ?? null,
            last_contact_date: row.last_contact_date ?? null,
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
  }, [user, isGuest, toast, localLogs, localReflections, dashboardRefreshTick]);

  const handleDeleteReflection = async (entryId: string) => {
    if (!user) return;
    const { error } = await supabase.from("experience_entries").delete().eq("id", entryId).eq("user_id", user.id);
    if (error) {
      toast({ title: "Failed to delete reflection", variant: "destructive" });
      return;
    }
    setReflections((prev) => prev.filter((r) => r.id !== entryId));
    toast({ title: "Reflection deleted" });
  };

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
  const hasTrackedOpportunities = opportunities.length > 0;
  const guestTutorialVisible = isGuest && shouldShowGuestTutorial(getGuestSessionId());
  const accountTutorialVisible = Boolean(user && !isGuest && !dashboardTutorialComplete);
  const activeCount = opportunities.filter(
    (o) => o.status !== "Accepted" && o.status !== "Rejected" && o.status !== "Archived"
  ).length;
  const reflectionCount = opportunities.reduce(
    (s, o) => s + o.reflectionCount,
    0
  );

  const nearestDeadline = useMemo(() => {
    const withDeadline = opportunities.filter((o) => o.deadline);
    if (withDeadline.length === 0) return null;
    return withDeadline.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];
  }, [opportunities]);

  const nextDeadline = useMemo(() => {
    const upcoming = opportunities
      .filter((o) => o.deadline && daysUntil(o.deadline) >= 0)
      .sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!));
    if (upcoming.length === 0) return "No upcoming deadlines";
    return deadlineLabel(upcoming[0].deadline)!;
  }, [opportunities]);

  const handleChecklistDismiss = () => {
    localStorage.setItem("clinicalhours_checklist_dismissed", "true");
    setChecklistDismissed(true);
  };

  const handleBcsBannerDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem("clinicalhours_bcs_banner_dismissed", "true");
    setBcsBannerDismissed(true);
  };

  const handleFeedbackBannerDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem("clinicalhours_feedback_banner_dismissed", "true");
    setFeedbackBannerDismissed(true);
  };

  const handleRecommendedSave = async (opportunityId: string) => {
    if (!user || isGuest) return;
    await supabase
      .from("saved_opportunities")
      .insert({ user_id: user.id, opportunity_id: opportunityId });
    setDashboardRefreshTick((t) => t + 1);
  };

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

  const handleNotesChange = async (id: string, notes: string) => {
    if (!requireAuth('save notes')) return;
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, notes } : o))
    );
    const { error } = await supabase
      .from("saved_opportunities")
      .update({ notes })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
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
      <Helmet>
        <title>Dashboard — ClinicalHours</title>
        <meta name="description" content="Track your clinical hours, manage saved opportunities, log reflections, and monitor your pre-med application progress." />
      </Helmet>
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

      <main className="flex-1 container mx-auto px-4 pt-24 pb-24 md:pb-16 relative z-10">
        {/* ─── Hero Banner ────────────────────────────────── */}
        <HeroBanner
          firstName={firstName}
          isGuest={isGuest}
          compact={!!user && !isGuest}
          totalHours={Math.round(totalHours * 10) / 10}
          savedCount={opportunities.length}
        />

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

        {/* ─── Premium Upsell (non-premium only) ───────────── */}
        {!isGuest && user && !isPremium && (
          <div className="mt-6">
            <Link
              to="/premium"
              className="group flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] backdrop-blur-sm px-5 py-4 hover:bg-amber-500/[0.1] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <Sparkles className="h-5 w-5 text-amber-400" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Unlock Premium Tools</p>
                  <p className="text-xs text-muted-foreground">AI Matcher, AMCAS Writer, School List Builder, and more.</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-amber-400 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden />
            </Link>
          </div>
        )}

        {/* ─── Featured Opportunity ────────────────────────── */}
        {!bcsBannerDismissed && (
          <div className="mt-6 relative">
            <Link
              to="/opportunities/bcs-free-health-clinic"
              className="group flex items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] backdrop-blur-sm px-5 py-4 pr-10 hover:bg-emerald-500/[0.1] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <Building2 className="h-5 w-5 text-emerald-400" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">BCS Free Health Clinic</p>
                    <Badge className="text-[10px] py-0 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Apply on ClinicalHours</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">College Station, TX · Community clinic · Direct apply — no external website needed</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden />
            </Link>
            <button
              onClick={handleBcsBannerDismiss}
              className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              aria-label="Dismiss featured opportunity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ─── Student feedback ────────────────────────────── */}
        {!feedbackBannerDismissed && (
          <div className="mt-6 relative">
            <Link
              to="/contact?intent=student-feedback"
              className="group flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/[0.06] backdrop-blur-sm px-5 py-4 pr-10 hover:bg-primary/[0.1] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">We&apos;re trying to make the student platform better</p>
                  <p className="text-xs text-muted-foreground">What should we fix, add, or make easier? Send us feedback.</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden />
            </Link>
            <button
              onClick={handleFeedbackBannerDismiss}
              className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              aria-label="Dismiss feedback request"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ─── Dashboard content ─────────────────────────── */}
        <div className="mt-8">
          {(guestTutorialVisible || accountTutorialVisible) && (
            <DashboardTutorial
              mode={guestTutorialVisible ? "guest" : "account"}
              tutorialKey={guestTutorialVisible ? (getGuestSessionId() || user?.id || "guest") : (user?.id || "account")}
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
              {/* Onboarding card — shown when no opportunities are tracked yet */}
              {!isGuest && user && opportunities.length === 0 && (
                <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-6 py-8">
                  <div className="max-w-lg mx-auto text-center">
                    <p className="text-base font-semibold text-foreground mb-2">
                      Your clinical hours tracker starts here
                    </p>
                    <p className="text-sm text-muted-foreground mb-5">
                      Find a clinical volunteer position near you, save it to your tracker, and start logging hours. Every session builds toward your AMCAS Work &amp; Activities section.
                    </p>
                    <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                      <div className="rounded-lg border border-border bg-card/50 px-3 py-3">
                        <p className="text-lg font-bold text-foreground">100+</p>
                        <p className="text-xs text-muted-foreground">hours expected for competitive applicants</p>
                      </div>
                      <div className="rounded-lg border border-border bg-card/50 px-3 py-3">
                        <p className="text-lg font-bold text-foreground">9,500+</p>
                        <p className="text-xs text-muted-foreground">opportunities in our database</p>
                      </div>
                      <div className="rounded-lg border border-border bg-card/50 px-3 py-3">
                        <p className="text-lg font-bold text-foreground">Free</p>
                        <p className="text-xs text-muted-foreground">to track, log, and export</p>
                      </div>
                    </div>
                    <Button asChild>
                      <Link to="/opportunities">Browse Opportunities Near You</Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Activation Checklist */}
              {!isGuest && user && !checklistDismissed && (
                <div className="mb-8">
                  <ActivationChecklist
                    savedCount={opportunities.length}
                    totalHours={totalHours}
                    reflectionCount={reflectionCount + localReflections.length}
                    hasCity={hasCity}
                    onDismiss={handleChecklistDismiss}
                  />
                </div>
              )}

              {/* Progress Summary */}
              <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon={Clock} label="Total Hours Logged" value={Math.round(totalHours * 10) / 10} />
                <StatCard icon={Briefcase} label="Active Opportunities" value={activeCount} />
                <StatCard icon={FileText} label="Reflections Logged" value={reflectionCount} />
                <StatCard icon={Building2} label="Opportunities Saved" value={opportunities.length} />
                <HoursGoalWidget totalHours={Math.round(totalHours * 10) / 10} />
                <ApplyYearCountdown applyYear={applyYear} />
                <PaceInsight
                  totalHours={Math.round(totalHours * 10) / 10}
                  startedAt={user?.created_at ?? null}
                />
              </div>

              <ThisWeekRail
                nearestDeadline={nearestDeadline ? { name: nearestDeadline.name, deadline: nearestDeadline.deadline! } : null}
                profileIncomplete={!hasCity}
                savedCount={opportunities.filter((o) => o.status === "Saved").length}
                isGuest={isGuest}
              />

              <RecommendedStrip
                savedOpportunityIds={savedOppIds}
                onSave={handleRecommendedSave}
              />

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
                          <span className="min-w-0 break-words">{app.hospital_name}</span>
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
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-lg font-medium text-foreground">Tracked Opportunities</h2>
                  {opportunities.length > 0 && (
                    <Link
                      to="/hours"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-white/5 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export for AMCAS
                    </Link>
                  )}
                </div>
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
                  (() => {
                    const active = filtered.filter((o) => o.status !== "Archived");
                    const archived = filtered.filter((o) => o.status === "Archived");
                    const cardProps = (opp: Opportunity) => ({
                      key: opp.id,
                      opp,
                      onStatusChange: handleStatusChange,
                      onRemove: handleRemove,
                      onNotesChange: handleNotesChange,
                      onLogHours: (o: Opportunity) => { if (requireAuth('log hours')) openDialog(o, "hours"); },
                      onAddReflection: (o: Opportunity) => { if (requireAuth('add reflections')) openDialog(o, "reflections"); },
                      onCardClick: (o: Opportunity) => {
                        const isAppFlow = o.status === "Applied" || o.status === "Waiting" || o.status === "Interview" || o.status === "Saved" || o.status === "Researching";
                        openDialog(o, isAppFlow ? "checklist" : "overview");
                      },
                    });
                    return (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {active.map((opp) => (
                            <OpportunityCard {...cardProps(opp)} />
                          ))}
                        </div>
                        {archived.length > 0 && (
                          <details className="mt-6">
                            <summary className="cursor-pointer text-sm text-muted-foreground select-none mb-3">
                              Archived ({archived.length})
                            </summary>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {archived.map((opp) => (
                                <OpportunityCard {...cardProps(opp)} />
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    );
                  })()
                )}
              </section>

              {/* Recent Reflections */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-foreground">Recent Reflections</h2>
                  <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                    <Link to="/hours">
                      Go to Journal <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                {reflections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reflections yet. Log experience entries with notes to see them here.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {reflections.map((r) => (
                      <ReflectionBlock key={r.id} reflection={r} onDelete={handleDeleteReflection} />
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
        onDataChanged={() => setDashboardRefreshTick((prev) => prev + 1)}
      />
    </div>
  );
};

export default Dashboard;
