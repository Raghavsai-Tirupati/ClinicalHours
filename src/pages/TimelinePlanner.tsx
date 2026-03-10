import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Check,
  Clock,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Milestone {
  id: string;
  month: string;
  title: string;
  description: string;
  category: "mcat" | "amcas" | "secondary" | "interview" | "general" | "lor";
  status: "completed" | "in_progress" | "upcoming" | "overdue";
}

const CATEGORY_COLORS: Record<string, string> = {
  mcat: "border-l-blue-500 bg-blue-500/5",
  amcas: "border-l-emerald-500 bg-emerald-500/5",
  secondary: "border-l-violet-500 bg-violet-500/5",
  interview: "border-l-amber-500 bg-amber-500/5",
  general: "border-l-zinc-500 bg-zinc-500/5",
  lor: "border-l-pink-500 bg-pink-500/5",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <Check className="h-4 w-4 text-emerald-400" />,
  in_progress: <Clock className="h-4 w-4 text-amber-400 animate-pulse" />,
  upcoming: <ArrowRight className="h-4 w-4 text-muted-foreground" />,
  overdue: <AlertTriangle className="h-4 w-4 text-red-400" />,
};

function generateTimeline(targetYear: number, mcatStatus: string): Milestone[] {
  const appYear = targetYear - 1;
  const milestones: Milestone[] = [];

  if (mcatStatus === "not_started" || mcatStatus === "studying") {
    milestones.push(
      { id: "mcat-prep", month: `Jan ${appYear}`, title: "Begin MCAT Preparation", description: "Start structured MCAT study plan. 3-6 months of preparation recommended.", category: "mcat", status: "upcoming" },
      { id: "mcat-practice", month: `Mar ${appYear}`, title: "MCAT Practice Tests", description: "Take full-length practice exams. Identify weak areas and adjust study plan.", category: "mcat", status: "upcoming" },
      { id: "mcat-test", month: `Apr-May ${appYear}`, title: "Take the MCAT", description: "Ideal test window for application cycle. Scores return in ~30 days.", category: "mcat", status: "upcoming" },
    );
  }

  milestones.push(
    { id: "lor-ask", month: `Feb ${appYear}`, title: "Ask for Letters of Recommendation", description: "Request LORs from 4-6 recommenders. Give 2-3 months lead time before AMCAS opens.", category: "lor", status: "upcoming" },
    { id: "school-research", month: `Mar ${appYear}`, title: "Research Medical Schools", description: "Build your school list. Review MSAR data, mission statements, and curriculum.", category: "general", status: "upcoming" },
    { id: "amcas-prep", month: `Apr ${appYear}`, title: "Draft AMCAS Application", description: "Write personal statement and activity descriptions. Get feedback from advisors.", category: "amcas", status: "upcoming" },
    { id: "amcas-open", month: `May ${appYear}`, title: "AMCAS Opens", description: "Application portal opens. Begin entering information and finalizing school list.", category: "amcas", status: "upcoming" },
    { id: "amcas-submit", month: `Jun ${appYear}`, title: "Submit AMCAS (First Day)", description: "Submit as early as possible. First-day submission gives verification advantage.", category: "amcas", status: "upcoming" },
    { id: "amcas-verify", month: `Jun-Jul ${appYear}`, title: "AMCAS Verification (4-6 weeks)", description: "Application is being verified. Use this time to pre-write secondary essays.", category: "amcas", status: "upcoming" },
    { id: "secondary-start", month: `Jul ${appYear}`, title: "Secondary Applications Begin", description: "Schools start sending secondaries. Aim to return within 2 weeks of receipt.", category: "secondary", status: "upcoming" },
    { id: "secondary-done", month: `Aug ${appYear}`, title: "Complete All Secondaries", description: "Finish and submit all secondary applications. Earlier is better for rolling admissions.", category: "secondary", status: "upcoming" },
    { id: "casper", month: `Aug ${appYear}`, title: "CASPer Test (if required)", description: "Situational judgment test required by some schools. Prepare with practice scenarios.", category: "general", status: "upcoming" },
    { id: "interview-season", month: `Sep ${appYear}`, title: "Interview Season Begins", description: "Invitations start arriving. Prepare with mock interviews and school-specific research.", category: "interview", status: "upcoming" },
    { id: "acceptance", month: `Oct 15, ${appYear}`, title: "Acceptance Notifications Begin", description: "Schools begin sending acceptance letters (AMCAS traffic rules).", category: "interview", status: "upcoming" },
    { id: "interview-end", month: `Jan ${targetYear}`, title: "Late Interview Season", description: "Final interviews. Some schools interview into February.", category: "interview", status: "upcoming" },
    { id: "plan-enroll", month: `Feb 19, ${targetYear}`, title: "'Plan to Enroll' Available", description: "AMCAS allows you to indicate school preference.", category: "general", status: "upcoming" },
    { id: "commit", month: `Apr 30, ${targetYear}`, title: "'Commit to Enroll' Deadline", description: "Must commit to one school. All other acceptances forfeited.", category: "general", status: "upcoming" },
    { id: "start", month: `Jul-Aug ${targetYear}`, title: "Medical School Begins", description: "Orientation and classes start. Congratulations!", category: "general", status: "upcoming" },
  );

  // Auto-set status based on current date
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  milestones.forEach((m) => {
    const yearMatch = m.month.match(/(\d{4})/);
    const mIdx = monthNames.findIndex((mn) => m.month.includes(mn));
    if (yearMatch && mIdx >= 0) {
      const year = parseInt(yearMatch[1]);
      const milestoneMonth = year * 12 + mIdx;
      if (milestoneMonth < currentMonth - 1) m.status = "overdue";
      else if (milestoneMonth <= currentMonth) m.status = "in_progress";
    }
  });

  return milestones;
}

const TimelinePlannerContent = () => {
  const [targetYear, setTargetYear] = useState(2028);
  const [mcatStatus, setMcatStatus] = useState("not_started");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const milestones = useMemo(() => generateTimeline(targetYear, mcatStatus), [targetYear, mcatStatus]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 max-w-md">
        <div>
          <Label>Target Matriculation Year</Label>
          <Select value={String(targetYear)} onValueChange={(v) => setTargetYear(parseInt(v))}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2027, 2028, 2029, 2030].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>MCAT Status</Label>
          <Select value={mcatStatus} onValueChange={setMcatStatus}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="studying">Studying</SelectItem>
              <SelectItem value="taken">Already Taken</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">{STATUS_ICONS.completed} Completed</span>
        <span className="flex items-center gap-1.5">{STATUS_ICONS.in_progress} In Progress</span>
        <span className="flex items-center gap-1.5">{STATUS_ICONS.upcoming} Upcoming</span>
        <span className="flex items-center gap-1.5">{STATUS_ICONS.overdue} Overdue</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-3">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`relative ml-12 rounded-lg border-l-4 border ${CATEGORY_COLORS[m.category]} border-border p-4 cursor-pointer hover:opacity-90 transition-opacity`}
              onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
            >
              <div className="absolute -left-[2.15rem] top-4 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border">
                {STATUS_ICONS[m.status]}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{m.month}</span>
                    {m.status === "overdue" && (
                      <span className="text-[10px] text-red-400 font-medium">OVERDUE</span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-foreground mt-0.5">{m.title}</h3>
                </div>
                {expandedId === m.id ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
              {expandedId === m.id && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{m.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TimelinePlanner = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">Timeline & Deadline Planner</h1>
        <p className="text-muted-foreground mt-1">Your personalized application timeline with key milestones and deadlines.</p>
      </div>
      <TimelinePlannerContent />
    </main>
    <Footer />
  </div>
);

export default TimelinePlanner;
