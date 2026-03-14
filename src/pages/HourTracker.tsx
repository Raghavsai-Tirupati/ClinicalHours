import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

import { useAuth } from "@/hooks/useAuth";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Clock,
  Plus,
  Calendar,
  FileText,
  TrendingUp,
  Search,
  Filter,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/lib/premium";
import { localInsert, localSelect, localUpdate, TABLES } from "@/lib/localStore";

interface ActivityLog {
  id: string;
  user_id?: string;
  organization_id: string | null;
  custom_organization_name: string | null;
  activity_type: ActivityType;
  session_date: string;
  hours: number;
  supervisor_name: string | null;
  supervisor_title: string | null;
  department: string | null;
  specialty_area: string | null;
  notes: string | null;
  created_at: string;
}

interface Reflection {
  id: string;
  user_id?: string;
  activity_log_id: string;
  what_happened: string | null;
  what_stood_out: string | null;
  what_learned: string | null;
  is_meaningful: boolean;
  competency_tags: string[];
  created_at: string;
}

interface EnrichedLog extends ActivityLog {
  reflection?: Reflection | null;
}

interface ActivitySummary {
  type: ActivityType;
  totalHours: number;
  sessionCount: number;
  orgCount: number;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color || 'bg-primary/10'}`}>
        <Icon className={`h-5 w-5 ${color ? 'text-white' : 'text-primary'}`} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function LogForm({ onSubmit, onClose, canReflect }: {
  onSubmit: (log: Partial<ActivityLog>, addReflection: boolean) => void;
  onClose: () => void;
  canReflect?: boolean;
}) {
  const [activityType, setActivityType] = useState<ActivityType>("shadowing");
  const [orgName, setOrgName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState("1");
  const [supervisorName, setSupervisorName] = useState("");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");
  const [addReflection, setAddReflection] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Activity Type</Label>
          <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Organization</Label>
          <Input className="mt-1.5" placeholder="e.g., Houston Methodist" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Date</Label>
          <Input type="date" className="mt-1.5" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        </div>
        <div>
          <Label>Hours</Label>
          <Input type="number" step="0.5" min="0" className="mt-1.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div>
          <Label>Department</Label>
          <Input className="mt-1.5" placeholder="e.g., Cardiology" value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Supervisor Name (optional)</Label>
        <Input className="mt-1.5" placeholder="Dr. Jane Smith" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Textarea className="mt-1.5" placeholder="Brief notes about this session..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {canReflect && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Switch checked={addReflection} onCheckedChange={setAddReflection} />
          <div>
            <p className="text-sm font-medium text-foreground">Add a reflection?</p>
            <p className="text-xs text-muted-foreground">Capture what you learned while it's fresh (2-3 min)</p>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit({ activity_type: activityType, custom_organization_name: orgName, session_date: sessionDate, hours: parseFloat(hours) || 0, supervisor_name: supervisorName || null, department: department || null, notes: notes || null }, addReflection)}>
          {addReflection ? "Save & Add Reflection" : "Save Entry"}
        </Button>
      </div>
    </div>
  );
}

function ReflectionForm({ onSubmit, onClose }: {
  onSubmit: (data: { what_happened: string; what_stood_out: string; what_learned: string; is_meaningful: boolean }) => void;
  onClose: () => void;
}) {
  const [whatHappened, setWhatHappened] = useState("");
  const [whatStoodOut, setWhatStoodOut] = useState("");
  const [whatLearned, setWhatLearned] = useState("");
  const [isMeaningful, setIsMeaningful] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <Label>What happened today?</Label>
        <Textarea className="mt-1.5" placeholder="Describe what you did and observed..." rows={3} value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} />
      </div>
      <div>
        <Label>What stood out or surprised you?</Label>
        <Textarea className="mt-1.5" placeholder="A moment, interaction, or observation that stuck with you..." rows={3} value={whatStoodOut} onChange={(e) => setWhatStoodOut(e.target.value)} />
      </div>
      <div>
        <Label>What did you learn about medicine, patients, or yourself?</Label>
        <Textarea className="mt-1.5" placeholder="A takeaway or insight..." rows={3} value={whatLearned} onChange={(e) => setWhatLearned(e.target.value)} />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <Switch checked={isMeaningful} onCheckedChange={setIsMeaningful} />
        <div>
          <p className="text-sm font-medium text-foreground">Mark as meaningful moment</p>
          <p className="text-xs text-muted-foreground">This will be prioritized for AMCAS "Most Meaningful" descriptions</p>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>Skip</Button>
        <Button onClick={() => onSubmit({ what_happened: whatHappened, what_stood_out: whatStoodOut, what_learned: whatLearned, is_meaningful: isMeaningful })}>
          Save Reflection
        </Button>
      </div>
    </div>
  );
}

const HourTrackerContent = () => {
  const { user } = useAuth();
  const { isPremium } = usePremiumStatus();
  const { toast } = useToast();
  const [logs, setLogs] = useState<EnrichedLog[]>([]);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showReflectionDialog, setShowReflectionDialog] = useState(false);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  function loadLogs() {
    const allLogs = localSelect<ActivityLog>(TABLES.ACTIVITY_LOGS);
    const allReflections = localSelect<Reflection>(TABLES.REFLECTIONS);
    const reflMap = new Map<string, Reflection>();
    allReflections.forEach((r) => reflMap.set(r.activity_log_id, r));

    const enriched: EnrichedLog[] = allLogs.map((log) => ({
      ...log,
      reflection: reflMap.get(log.id) || null,
    }));
    setLogs(enriched);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const handleLogSubmit = async (logData: Partial<ActivityLog>, addReflection: boolean) => {
    const newLog = localInsert<Partial<ActivityLog>>(TABLES.ACTIVITY_LOGS, {
      user_id: user?.id,
      activity_type: logData.activity_type || "other",
      custom_organization_name: logData.custom_organization_name,
      organization_id: null,
      session_date: logData.session_date || new Date().toISOString().split("T")[0],
      hours: logData.hours || 0,
      supervisor_name: logData.supervisor_name,
      supervisor_title: null,
      department: logData.department,
      specialty_area: null,
      notes: logData.notes,
    });

    // Also write to experience_entries in Supabase so it shows on the existing dashboard
    if (user) {
      try {
        // experience_entries requires an opportunity_id. We'll skip the Supabase write
        // if we don't have one — the dashboard will read from both sources.
        // For now, just write to the first saved opportunity if available.
        const { data: savedOpp } = await supabase
          .from("saved_opportunities")
          .select("opportunity_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (savedOpp?.opportunity_id) {
          await supabase.from("experience_entries").insert({
            user_id: user.id,
            opportunity_id: savedOpp.opportunity_id,
            entry_date: logData.session_date || new Date().toISOString().split("T")[0],
            hours: logData.hours || 0,
            moment: logData.notes || null,
          });
        }
      } catch {
        // Non-critical — local store is the primary source
      }
    }

    setShowLogDialog(false);
    toast({ title: "Hours logged!" });

    if (addReflection) {
      setPendingLogId(newLog.id);
      setShowReflectionDialog(true);
    } else {
      loadLogs();
    }
  };

  const handleReflectionSubmit = (data: {
    what_happened: string;
    what_stood_out: string;
    what_learned: string;
    is_meaningful: boolean;
  }) => {
    if (!pendingLogId) return;

    localInsert<Partial<Reflection>>(TABLES.REFLECTIONS, {
      user_id: user?.id,
      activity_log_id: pendingLogId,
      what_happened: data.what_happened,
      what_stood_out: data.what_stood_out,
      what_learned: data.what_learned,
      is_meaningful: data.is_meaningful,
      competency_tags: [],
    });

    setShowReflectionDialog(false);
    setPendingLogId(null);
    toast({ title: "Reflection saved!" });
    loadLogs();
  };

  const summaries = useMemo<ActivitySummary[]>(() => {
    const map = new Map<ActivityType, { hours: number; sessions: number; orgs: Set<string> }>();
    logs.forEach((l) => {
      const existing = map.get(l.activity_type) || { hours: 0, sessions: 0, orgs: new Set<string>() };
      existing.hours += l.hours;
      existing.sessions += 1;
      existing.orgs.add(l.custom_organization_name || "unknown");
      map.set(l.activity_type, existing);
    });
    return Array.from(map.entries()).map(([type, data]) => ({
      type,
      totalHours: Math.round(data.hours * 10) / 10,
      sessionCount: data.sessions,
      orgCount: data.orgs.size,
    }));
  }, [logs]);

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const totalSessions = logs.length;
  const totalReflections = logs.filter((l) => l.reflection).length;
  const meaningfulCount = logs.filter((l) => l.reflection?.is_meaningful).length;

  const filtered = useMemo(() => {
    let result = logs;
    if (filterType !== "all") result = result.filter((l) => l.activity_type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        (l.custom_organization_name || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q) ||
        (l.department || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterType, searchQuery]);

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Total Hours" value={Math.round(totalHours * 10) / 10} />
        <StatCard icon={Calendar} label="Sessions Logged" value={totalSessions} />
        {isPremium && <StatCard icon={BookOpen} label="Reflections Written" value={totalReflections} />}
        {isPremium && <StatCard icon={TrendingUp} label="Meaningful Moments" value={meaningfulCount} />}
      </div>

      {isPremium && summaries.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Activity Breakdown</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaries.map((s) => (
              <div key={s.type} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{ACTIVITY_TYPE_LABELS[s.type]}</p>
                <p className="text-lg font-semibold text-foreground mt-1">{s.totalHours}h</p>
                <p className="text-xs text-muted-foreground">{s.sessionCount} sessions &middot; {s.orgCount} org{s.orgCount !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-foreground">Activity Log</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs..." className="h-9 w-[180px] pl-9 text-sm" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowLogDialog(true)}>
            <Plus className="h-4 w-4" /> Log Hours
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            {logs.length === 0 ? "No hours logged yet. Start tracking!" : "No logs match your filters."}
          </p>
          {logs.length === 0 && (
            <Button onClick={() => setShowLogDialog(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Log Your First Hours
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <div key={log.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm truncate">{log.custom_organization_name || "Unnamed Organization"}</span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{ACTIVITY_TYPE_LABELS[log.activity_type]}</span>
                    {log.reflection?.is_meaningful && <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">Meaningful</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{new Date(log.session_date + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>{log.hours}h</span>
                    {log.department && <span>{log.department}</span>}
                    {log.reflection && <span className="flex items-center gap-1 text-emerald-400"><FileText className="h-3 w-3" /> Reflection</span>}
                  </div>
                </div>
                {expandedLog === log.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
              {expandedLog === log.id && (
                <div className="border-t border-border px-4 py-4 space-y-3">
                  {log.notes && <div><p className="text-xs font-medium text-muted-foreground mb-1">Notes</p><p className="text-sm text-foreground">{log.notes}</p></div>}
                  {log.supervisor_name && <div><p className="text-xs font-medium text-muted-foreground mb-1">Supervisor</p><p className="text-sm text-foreground">{log.supervisor_name}</p></div>}
                  {log.reflection && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Reflection</p>
                      {log.reflection.what_happened && <div><p className="text-xs text-muted-foreground mb-0.5">What happened?</p><p className="text-sm text-foreground">{log.reflection.what_happened}</p></div>}
                      {log.reflection.what_stood_out && <div><p className="text-xs text-muted-foreground mb-0.5">What stood out?</p><p className="text-sm text-foreground">{log.reflection.what_stood_out}</p></div>}
                      {log.reflection.what_learned && <div><p className="text-xs text-muted-foreground mb-0.5">What did you learn?</p><p className="text-sm text-foreground">{log.reflection.what_learned}</p></div>}
                      {log.reflection.competency_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {log.reflection.competency_tags.map((tag) => <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{tag}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                  {!log.reflection && isPremium && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setPendingLogId(log.id); setShowReflectionDialog(true); }}>
                      <BookOpen className="h-3.5 w-3.5" /> Add Reflection
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Hours</DialogTitle></DialogHeader>
          <LogForm onSubmit={handleLogSubmit} onClose={() => setShowLogDialog(false)} canReflect={isPremium} />
        </DialogContent>
      </Dialog>

      <Dialog open={showReflectionDialog} onOpenChange={(open) => { setShowReflectionDialog(open); if (!open) { setPendingLogId(null); loadLogs(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Quick Reflection</DialogTitle></DialogHeader>
          <ReflectionForm onSubmit={handleReflectionSubmit} onClose={() => { setShowReflectionDialog(false); setPendingLogId(null); loadLogs(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const HourTracker = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">Clinical Hours Journal</h1>
        <p className="text-muted-foreground mt-1">Log clinical hours, write reflections, and track your progress.</p>
      </div>
      <HourTrackerContent />
    </main>
    <Footer />
  </div>
);

export default HourTracker;
