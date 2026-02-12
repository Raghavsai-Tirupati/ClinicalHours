import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import HeroBanner from "@/components/HeroBanner";
import OpportunityDialog from "@/components/OpportunityDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type OpportunityStatus = "Saved" | "Applied" | "Interviewing" | "Completed";

interface Opportunity {
  id: string;
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

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockOpportunities: Opportunity[] = [
  {
    id: "1",
    name: "Stanford Medical Center",
    type: "Clinical Shadowing",
    website: "https://stanfordhealthcare.org",
    location: "Palo Alto, CA",
    status: "Interviewing",
    deadline: "2026-02-20",
    hoursLogged: 48,
    reflectionCount: 3,
  },
  {
    id: "2",
    name: "UCSF Emergency Department",
    type: "Volunteering",
    website: "https://ucsf.edu",
    location: "San Francisco, CA",
    status: "Applied",
    deadline: "2026-03-01",
    hoursLogged: 12,
    reflectionCount: 1,
  },
  {
    id: "3",
    name: "Kaiser Permanente Research",
    type: "Research",
    website: "https://kaiserpermanente.org",
    location: "Oakland, CA",
    status: "Saved",
    deadline: null,
    hoursLogged: 0,
    reflectionCount: 0,
  },
  {
    id: "4",
    name: "Community Health Clinic",
    type: "EMT",
    website: "https://communityhealthclinic.org",
    location: "San Jose, CA",
    status: "Completed",
    deadline: null,
    hoursLogged: 120,
    reflectionCount: 5,
  },
];

const mockReflections: Reflection[] = [
  {
    id: "r1",
    opportunityId: "1",
    orgName: "Stanford Medical Center",
    date: "2026-02-10",
    text: "Today I observed a complex cardiac surgery. The attending explained each step with patience. I was struck by how the entire team communicated seamlessly under pressure. It reinforced my desire to pursue surgery.",
  },
  {
    id: "r2",
    opportunityId: "4",
    orgName: "Community Health Clinic",
    date: "2026-02-05",
    text: "Worked with underserved patients in the free clinic today. A mother brought her three children for check-ups they'd been putting off for months. Moments like these remind me why access to healthcare matters so deeply.",
  },
  {
    id: "r3",
    opportunityId: "2",
    orgName: "UCSF Emergency Department",
    date: "2026-01-28",
    text: "My first shift in the ED was overwhelming in the best way. The pace, the variety of cases, the adrenaline. I helped comfort a patient while they waited for imaging results. Small gestures can make a huge difference.",
  },
];

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
  "Clinical Shadowing": "border-purple-500/40 text-purple-300",
  Volunteering: "border-sky-500/40 text-sky-300",
  Research: "border-teal-500/40 text-teal-300",
  EMT: "border-rose-500/40 text-rose-300",
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
              onClick={() => onRemove(opp.id)}
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
          {opp.type}
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
          {new Date(reflection.date).toLocaleDateString("en-US", {
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
  const [opportunities, setOpportunities] = useState(mockOpportunities);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogOpp, setDialogOpp] = useState<Opportunity | null>(null);
  const [dialogTab, setDialogTab] = useState("overview");

  // Get the user's first name from their metadata, or default for guests
  const firstName = useMemo(() => {
    if (isGuest || !user) return undefined; // HeroBanner defaults to "there"
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    if (fullName) return fullName.split(' ')[0];
    // Fall back to email prefix
    const email = user.email || '';
    return email.split('@')[0] || undefined;
  }, [user, isGuest]);

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

  const totalHours = opportunities.reduce((s, o) => s + o.hoursLogged, 0);
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

  const handleStatusChange = (id: string, status: OpportunityStatus) => {
    if (!requireAuth('update opportunity status')) return;
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  };

  const handleRemove = (id: string) => {
    if (!requireAuth('remove opportunities')) return;
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
  };

    return (
      <div className="min-h-screen flex flex-col bg-background relative">
        {/* ─── Full-page background image layer ──────────────── */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero/clinicalhours-hero-bg.webp')" }}
          />
          {/* Top area: lighter so hero content pops */}
          <div
              className="absolute inset-0"
              style={{
                background: "rgba(9,9,11,0.35)",
              }}
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

          {/* Progress Summary */}
          <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Clock} label="Total Hours Logged" value={totalHours} />
            <StatCard icon={Briefcase} label="Active Opportunities" value={activeCount} />
            <StatCard icon={FileText} label="Experiences Recorded" value={reflectionCount} />
            <StatCard icon={CalendarClock} label="Next Deadline" value={nextDeadline} />
          </div>

          {/* Active Opportunities */}
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-medium text-foreground">Active Opportunities</h2>
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-16 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No opportunities match your search."
                    : "No opportunities yet. Browse and save some to get started."}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/opportunities">Browse Opportunities</Link>
                </Button>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockReflections.map((r) => (
                <ReflectionBlock key={r.id} reflection={r} />
              ))}
            </div>
          </section>
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
