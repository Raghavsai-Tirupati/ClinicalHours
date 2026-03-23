import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Clock,
  FileText,
  ClipboardList,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  opportunityId: string;
  name: string;
  type: string;
  website: string;
  location: string;
  status: string;
  deadline: string | null;
  hoursLogged: number;
  reflectionCount: number;
}

interface HourEntry {
  id: string;
  date: string;
  hours: number;
  note: string | null;
}

type ReflectionEntry = HourEntry & { text: string };

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

// ─── Default checklists by status ─────────────────────────────────────────

const applicationChecklist: ChecklistItem[] = [
  { id: "c1", label: "Research the organization", checked: false },
  { id: "c2", label: "Prepare resume / CV", checked: false },
  { id: "c3", label: "Write cover letter", checked: false },
  { id: "c4", label: "Gather references", checked: false },
  { id: "c5", label: "Submit application", checked: false },
  { id: "c6", label: "Follow up on application", checked: false },
];

const interviewChecklist: ChecklistItem[] = [
  { id: "i1", label: "Research the organization", checked: true },
  { id: "i2", label: "Prepare resume / CV", checked: true },
  { id: "i3", label: "Submit application", checked: true },
  { id: "i4", label: "Schedule interview", checked: false },
  { id: "i5", label: "Prepare for interview questions", checked: false },
  { id: "i6", label: "Send thank-you email", checked: false },
  { id: "i7", label: "Follow up on decision", checked: false },
];

function getDefaultChecklist(status: string): ChecklistItem[] {
  if (status === "Interviewing") return interviewChecklist.map((c) => ({ ...c }));
  if (status === "Applied") return applicationChecklist.map((c) => ({ ...c }));
  return [];
}

// ─── Component ───────────────────────────────────────────────────────────

interface OpportunityDialogProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  onDataChanged?: () => void;
}

export default function OpportunityDialog({
  opportunity,
  open,
  onOpenChange,
  defaultTab = "overview",
  onDataChanged,
}: OpportunityDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const opp = opportunity;
  const isApplicationFlow =
    opp?.status === "Interviewing" ||
    opp?.status === "Applied" ||
    opp?.status === "Saved";

  const [hours, setHours] = useState<HourEntry[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // New entry forms
  const [newHoursDate, setNewHoursDate] = useState("");
  const [newHoursAmount, setNewHoursAmount] = useState("");
  const [newHoursNote, setNewHoursNote] = useState("");

  const [newReflectionText, setNewReflectionText] = useState("");

  const [newChecklistItem, setNewChecklistItem] = useState("");

  useEffect(() => {
    if (!open || !opp || !user) return;

    let isMounted = true;
    const loadEntries = async () => {
      setLoadingEntries(true);
      const { data, error } = await supabase
        .from("experience_entries")
        .select("id, entry_date, hours, moment")
        .eq("user_id", user.id)
        .eq("opportunity_id", opp.opportunityId)
        .order("entry_date", { ascending: false });

      if (!isMounted) return;
      if (error) {
        toast({
          title: "Couldn't load entries",
          description: "Please try again.",
          variant: "destructive",
        });
      } else {
        const mapped: HourEntry[] = (data || []).map((row) => ({
          id: row.id,
          date: row.entry_date,
          hours: Number(row.hours) || 0,
          note: row.moment,
        }));
        setHours(mapped);
      }
      setLoadingEntries(false);
    };

    setChecklist(getDefaultChecklist(opp.status));
    setNewHoursDate(new Date().toISOString().split("T")[0]);
    setNewHoursAmount("");
    setNewHoursNote("");
    setNewReflectionText("");
    setNewChecklistItem("");
    loadEntries();

    return () => {
      isMounted = false;
    };
  }, [open, opp, user, toast]);

  if (!opp) return null;

  // ─── Handlers ──────────────────────────────────────────────────────────

  const addHourEntry = async () => {
    if (!opp || !user || !newHoursDate || !newHoursAmount) return;
    const parsedHours = Number(newHoursAmount);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) return;

    const { data, error } = await supabase
      .from("experience_entries")
      .insert({
        user_id: user.id,
        opportunity_id: opp.opportunityId,
        entry_date: newHoursDate,
        hours: parsedHours,
        moment: newHoursNote.trim() || null,
      })
      .select("id, entry_date, hours, moment")
      .single();

    if (error || !data) {
      toast({
        title: "Couldn't save hour entry",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    const entry: HourEntry = {
      id: data.id,
      date: data.entry_date,
      hours: Number(data.hours) || 0,
      note: data.moment,
    };
    setHours((prev) => [entry, ...prev]);
    setNewHoursAmount("");
    setNewHoursNote("");
    onDataChanged?.();
  };

  const removeHourEntry = async (id: string) => {
    const { error } = await supabase.from("experience_entries").delete().eq("id", id);
    if (error) {
      toast({
        title: "Couldn't delete entry",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }
    setHours((prev) => prev.filter((h) => h.id !== id));
    onDataChanged?.();
  };

  const addReflection = async () => {
    if (!opp || !user || !newReflectionText.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("experience_entries")
      .insert({
        user_id: user.id,
        opportunity_id: opp.opportunityId,
        entry_date: today,
        hours: 0,
        moment: newReflectionText.trim(),
      })
      .select("id, entry_date, hours, moment")
      .single();

    if (error || !data) {
      toast({
        title: "Couldn't save reflection",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }
    setHours((prev) => [
      {
        id: data.id,
        date: data.entry_date,
        hours: Number(data.hours) || 0,
        note: data.moment,
      },
      ...prev,
    ]);
    setNewReflectionText("");
    onDataChanged?.();
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, label: newChecklistItem, checked: false },
    ]);
    setNewChecklistItem("");
  };

  const removeChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((c) => c.id !== id));
  };

  const completedCount = checklist.filter((c) => c.checked).length;
  const totalHoursLogged = hours.reduce((s, h) => s + h.hours, 0);
  const reflections: ReflectionEntry[] = hours
    .filter((h) => Boolean(h.note?.trim()))
    .map((h) => ({
      ...h,
      text: h.note || "",
    }));

  // ─── Choose which tab to show first ────────────────────────────────────
  const resolvedDefault =
    defaultTab === "checklist" && !isApplicationFlow ? "overview" : defaultTab;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{opp.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {opp.type} &middot; {opp.location}
          </p>
        </DialogHeader>

        <Tabs defaultValue={resolvedDefault} key={`${opp.id}-${resolvedDefault}`} className="mt-2">
          <TabsList className="w-full justify-start gap-1">
            {isApplicationFlow && (
              <TabsTrigger value="checklist" className="gap-1.5 text-xs">
                <ClipboardList className="h-3.5 w-3.5" /> Checklist
              </TabsTrigger>
            )}
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <Info className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Log Hours
            </TabsTrigger>
            <TabsTrigger value="reflections" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Reflections
            </TabsTrigger>
          </TabsList>

          {/* ─── Checklist Tab ──────────────────────────────────── */}
          {isApplicationFlow && (
            <TabsContent value="checklist" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {checklist.length} completed
                </p>
                <div className="h-2 w-32 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: checklist.length
                        ? `${(completedCount / checklist.length) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-card/50 p-3 group"
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleChecklistItem(item.id)}
                      id={item.id}
                    />
                    <label
                      htmlFor={item.id}
                      className={`flex-1 text-sm cursor-pointer ${
                        item.checked
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </label>
                    <button
                      onClick={() => removeChecklistItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add a checklist item..."
                  className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                />
                <Button size="sm" onClick={addChecklistItem} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </TabsContent>
          )}

          {/* ─── Overview Tab ──────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-border bg-card/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p className="text-sm font-medium text-foreground">{opp.status}</p>
              </div>
              <div className="rounded-md border border-border bg-card/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Hours Logged</p>
                <p className="text-sm font-medium text-foreground">{totalHoursLogged}h</p>
              </div>
              <div className="rounded-md border border-border bg-card/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Reflections</p>
                <p className="text-sm font-medium text-foreground">{reflections.length}</p>
              </div>
              <div className="rounded-md border border-border bg-card/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Deadline</p>
                <p className="text-sm font-medium text-foreground">
                  {opp.deadline
                    ? new Date(opp.deadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "None set"}
                </p>
              </div>
            </div>
            {opp.website && (
              <a
                href={opp.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Visit website &rarr;
              </a>
            )}
          </TabsContent>

          {/* ─── Log Hours Tab ─────────────────────────────────── */}
          <TabsContent value="hours" className="mt-4 space-y-4">
            {/* Add form */}
            <div className="rounded-md border border-border bg-card/50 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Log New Hours</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={newHoursDate}
                    onChange={(e) => setNewHoursDate(e.target.value)}
                    className="text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hours</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newHoursAmount}
                    onChange={(e) => setNewHoursAmount(e.target.value)}
                    placeholder="e.g. 4"
                    className="text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  value={newHoursNote}
                  onChange={(e) => setNewHoursNote(e.target.value)}
                  placeholder="What did you do?"
                  className="text-sm mt-1"
                />
              </div>
              <Button size="sm" onClick={addHourEntry} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Entry
              </Button>
            </div>

            {/* Existing entries */}
            {loadingEntries ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading entries...</p>
            ) : hours.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Previous Entries ({totalHoursLogged}h total)
                </p>
                {hours.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between rounded-md border border-border bg-card/50 p-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-foreground">{h.hours}h</span>
                        <span className="text-muted-foreground">&middot;</span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(h.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {h.note && (
                        <p className="text-xs text-muted-foreground mt-1">{h.note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeHourEntry(h.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity mt-0.5"
                      aria-label="Remove entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!loadingEntries && hours.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hours logged yet. Add your first entry above.
              </p>
            )}
          </TabsContent>

          {/* ─── Reflections Tab ───────────────────────────────── */}
          <TabsContent value="reflections" className="mt-4 space-y-4">
            {/* Add form */}
            <div className="rounded-md border border-border bg-card/50 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Add Reflection</p>
              <Textarea
                value={newReflectionText}
                onChange={(e) => setNewReflectionText(e.target.value)}
                placeholder="What did you learn? What stood out to you?"
                className="text-sm min-h-[100px]"
              />
              <Button size="sm" onClick={addReflection} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Save Reflection
              </Button>
            </div>

            {/* Existing reflections */}
            {reflections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Previous Reflections
                </p>
                {reflections.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border border-border bg-card/50 p-3"
                  >
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {new Date(r.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {r.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {reflections.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reflections yet. Write about your experiences above.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
