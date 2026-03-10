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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
}

interface Reflection {
  id: string;
  opportunityId: string;
  orgName: string;
  date: string;
  text: string;
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
      {/* Top row: name + 3-dot menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium text-foreground">
            {opp.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{opp.location}</p>
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogOpp, setDialogOpp] = useState<Opportunity | null>(null);
  const [dialogTab, setDialogTab] = useState("overview");

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
      setLoadingData(true);
      try {
        // 1. Fetch saved opportunities joined with the opportunity details
        const { data: savedRows, error: savedErr } = await supabase
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
              website
            )
          `)
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false });

        if (savedErr) throw savedErr;

        // 2. Fetch experience entries for hours + reflections aggregation
        const { data: entries, error: entryErr } = await supabase
          .from("experience_entries")
          .select("id, opportunity_id, hours, moment, entry_date")
          .eq("user_id", user!.id)
          .order("entry_date", { ascending: false });

        if (entryErr) throw entryErr;

        // Build aggregation maps keyed by opportunity_id
        const hoursMap: Record<string, number> = {};
        const reflCountMap: Record<string, number> = {};
        (entries || []).forEach((e) => {
          const oid = e.opportunity_id as string;
          hoursMap[oid] = (hoursMap[oid] || 0) + (Number(e.hours) || 0);
          if (e.moment) reflCountMap[oid] = (reflCountMap[oid] || 0) + 1;
        });

        // Build name lookup for reflections section
        const nameMap: Record<string, string> = {};

        // Map saved rows to dashboard Opportunity objects
        const opps: Opportunity[] = (savedRows || []).map((row) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opp = (row as any).opportunities as {
            id: string;
            name: string;
            type: string;
            location: string;
            website: string | null;
          } | null;

          const oppId = row.opportunity_id as string;
          const oppName = opp?.name || "Unknown";
          nameMap[oppId] = oppName;

          return {
            id: row.id as string,
            opportunityId: oppId,
            name: oppName,
            type: opp?.type || "hospital",
            website: opp?.website || "",
            location: opp?.location || "",
            status: ((row.status as string) || "Saved") as OpportunityStatus,
            deadline: null,
            hoursLogged: Math.round((hoursMap[oppId] || 0) * 10) / 10,
            reflectionCount: reflCountMap[oppId] || 0,
          };
        });

        setOpportunities(opps);

        // Map experience entries with moments to reflections
        const recentReflections: Reflection[] = (entries || [])
          .filter((e) => !!e.moment)
          .map((e) => ({
            id: e.id as string,
            opportunityId: e.opportunity_id as string,
            orgName: nameMap[e.opportunity_id as string] || "Unknown",
            date: e.entry_date as string,
            text: e.moment as string,
          }));

        // Merge in reflections from local store (Hour Tracker)
        const localReflections = localSelect<{
          id: string; activity_log_id: string;
          what_happened: string | null; what_stood_out: string | null;
          what_learned: string | null; created_at: string;
        }>(TABLES.REFLECTIONS);
        const localLogs = localSelect<{
          id: string; custom_organization_name: string | null; session_date: string; hours: number;
        }>(TABLES.ACTIVITY_LOGS);
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
  }, [user, isGuest, toast]);

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

  const localTrackerLogs = localSelect<{ id: string; hours: number }>(TABLES.ACTIVITY_LOGS);
  const localTrackerHours = localTrackerLogs.reduce((s, l) => s + (l.hours || 0), 0);
  const totalHours = opportunities.reduce((s, o) => s + o.hoursLogged, 0) + localTrackerHours;
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

        {/* ─── Dashboard content ─────────────────────────── */}
        <div className="mt-8">
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
