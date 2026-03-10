import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PremiumGate } from "@/components/PremiumGate";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Users, Plus, Star, AlertTriangle, Loader2, GraduationCap, Trash2 } from "lucide-react";
import { LETTER_STATUS_LABELS, type LetterStatus } from "@/lib/premium";
import { localInsert, localSelect, localUpdate, localDelete, TABLES } from "@/lib/localStore";

interface LORContact {
  id: string;
  recommender_name: string;
  recommender_title: string | null;
  recommender_email: string | null;
  institution: string | null;
  relationship_type: string | null;
  classes_or_projects: string | null;
  strength_score: number;
  last_interaction_date: string | null;
  letter_status: LetterStatus;
  schools_assigned: string[];
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<LetterStatus, string> = {
  not_asked: "bg-zinc-700/60 text-zinc-300",
  asked_pending: "bg-blue-900/50 text-blue-300",
  confirmed: "bg-emerald-900/50 text-emerald-300",
  writing: "bg-amber-900/50 text-amber-300",
  submitted_to_amcas: "bg-violet-900/50 text-violet-300",
  received_by_amcas: "bg-emerald-900/60 text-emerald-200",
};

const PIPELINE_STAGES: LetterStatus[] = ["not_asked", "asked_pending", "confirmed", "writing", "submitted_to_amcas", "received_by_amcas"];

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className="p-0">
          <Star className={`h-4 w-4 ${n <= value ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const LORTrackerContent = () => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<LORContact[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"list" | "pipeline">("list");

  const [form, setForm] = useState({
    recommender_name: "", recommender_title: "", recommender_email: "", institution: "",
    relationship_type: "science_professor", classes_or_projects: "", strength_score: 3,
    letter_status: "not_asked" as LetterStatus, notes: "",
  });

  function loadContacts() {
    setContacts(localSelect<LORContact>(TABLES.LOR_CONTACTS).map((c) => ({
      ...c,
      letter_status: (c.letter_status || "not_asked") as LetterStatus,
      schools_assigned: c.schools_assigned || [],
      strength_score: c.strength_score || 3,
    })));
  }

  useEffect(() => { loadContacts(); }, []);

  function handleAdd() {
    localInsert(TABLES.LOR_CONTACTS, {
      recommender_name: form.recommender_name,
      recommender_title: form.recommender_title || null,
      recommender_email: form.recommender_email || null,
      institution: form.institution || null,
      relationship_type: form.relationship_type,
      classes_or_projects: form.classes_or_projects || null,
      strength_score: form.strength_score,
      last_interaction_date: null,
      letter_status: form.letter_status,
      schools_assigned: [],
      notes: form.notes || null,
    });
    setShowAdd(false);
    toast({ title: "Recommender added!" });
    loadContacts();
    setForm({ recommender_name: "", recommender_title: "", recommender_email: "", institution: "", relationship_type: "science_professor", classes_or_projects: "", strength_score: 3, letter_status: "not_asked", notes: "" });
  }

  function handleStatusChange(id: string, status: LetterStatus) {
    localUpdate<LORContact>(TABLES.LOR_CONTACTS, id, { letter_status: status });
    loadContacts();
  }

  function handleDelete(id: string) {
    localDelete(TABLES.LOR_CONTACTS, id);
    loadContacts();
    toast({ title: "Recommender removed." });
  }

  const scienceCount = contacts.filter((c) => c.relationship_type === "science_professor" && ["confirmed", "writing", "submitted_to_amcas", "received_by_amcas"].includes(c.letter_status)).length;
  const confirmedCount = contacts.filter((c) => ["confirmed", "writing", "submitted_to_amcas", "received_by_amcas"].includes(c.letter_status)).length;

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold text-foreground">{contacts.length}</p><p className="text-xs text-muted-foreground">Total Recommenders</p></div></div></div>
        <div className="rounded-lg border border-border bg-card p-5"><div className="flex items-center gap-3"><GraduationCap className="h-5 w-5 text-emerald-400" /><div><p className="text-2xl font-semibold text-foreground">{confirmedCount}</p><p className="text-xs text-muted-foreground">Confirmed Letters</p></div></div></div>
        <div className={`rounded-lg border p-5 ${scienceCount < 2 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-3">
            {scienceCount < 2 ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : <Star className="h-5 w-5 text-amber-400" />}
            <div><p className="text-2xl font-semibold text-foreground">{scienceCount} / 2</p><p className="text-xs text-muted-foreground">Science Faculty Letters</p>{scienceCount < 2 && <p className="text-xs text-amber-400 mt-0.5">You need at least 2 science faculty letters</p>}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")} className={`text-xs font-medium px-3 py-1.5 rounded-lg ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>List</button>
          <button onClick={() => setView("pipeline")} className={`text-xs font-medium px-3 py-1.5 rounded-lg ${view === "pipeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Pipeline</button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Recommender</Button>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No recommenders added yet.</p>
          <Button onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Your First Recommender</Button>
        </div>
      ) : view === "list" ? (
        <div className="space-y-3">
          {contacts.map((c) => {
            const lastContactDays = daysSince(c.last_interaction_date);
            const stale = lastContactDays !== null && lastContactDays > 90;
            return (
              <div key={c.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{c.recommender_name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.letter_status]}`}>{LETTER_STATUS_LABELS[c.letter_status]}</span>
                    </div>
                    {c.recommender_title && <p className="text-xs text-muted-foreground">{c.recommender_title}{c.institution ? ` — ${c.institution}` : ""}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      <StarRating value={c.strength_score} />
                      {stale && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="h-3 w-3" /> Last contact {lastContactDays}d ago</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={c.letter_status} onValueChange={(v) => handleStatusChange(c.id, v as LetterStatus)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(LETTER_STATUS_LABELS).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)} aria-label="Remove recommender">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageContacts = contacts.filter((c) => c.letter_status === stage);
            return (
              <div key={stage} className="min-w-0">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{LETTER_STATUS_LABELS[stage]}</span><span className="text-xs text-muted-foreground">{stageContacts.length}</span></div>
                <div className="space-y-2">
                  {stageContacts.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-medium text-foreground truncate">{c.recommender_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.institution || ""}</p>
                      <div className="mt-1.5"><StarRating value={c.strength_score} /></div>
                    </div>
                  ))}
                  {stageContacts.length === 0 && <div className="rounded-lg border border-dashed border-border p-4 text-center"><p className="text-[10px] text-muted-foreground">Empty</p></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Recommender</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Name</Label><Input className="mt-1.5" value={form.recommender_name} onChange={(e) => setForm({ ...form, recommender_name: e.target.value })} placeholder="Dr. Jane Smith" /></div>
              <div><Label>Title</Label><Input className="mt-1.5" value={form.recommender_title} onChange={(e) => setForm({ ...form, recommender_title: e.target.value })} placeholder="Professor of Biology" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Email</Label><Input className="mt-1.5" type="email" value={form.recommender_email} onChange={(e) => setForm({ ...form, recommender_email: e.target.value })} /></div>
              <div><Label>Institution</Label><Input className="mt-1.5" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></div>
            </div>
            <div>
              <Label>Relationship Type</Label>
              <Select value={form.relationship_type} onValueChange={(v) => setForm({ ...form, relationship_type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="science_professor">Science Professor</SelectItem>
                  <SelectItem value="non_science_professor">Non-Science Professor</SelectItem>
                  <SelectItem value="research_pi">Research PI</SelectItem>
                  <SelectItem value="physician_shadowing">Physician (Shadowing)</SelectItem>
                  <SelectItem value="clinical_supervisor">Clinical Supervisor</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                  <SelectItem value="committee">Committee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Classes / Projects / Shared Work</Label><Textarea className="mt-1.5" value={form.classes_or_projects} onChange={(e) => setForm({ ...form, classes_or_projects: e.target.value })} rows={2} /></div>
            <div><Label>Strength Score</Label><div className="mt-1.5"><StarRating value={form.strength_score} onChange={(v) => setForm({ ...form, strength_score: v })} /></div></div>
            <div><Label>Notes</Label><Textarea className="mt-1.5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!form.recommender_name.trim()}>Add Recommender</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LORTracker = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">LOR Tracker</h1>
        <p className="text-muted-foreground mt-1">Track recommendation letters, manage relationships, and monitor submission status.</p>
      </div>
      <PremiumGate featureName="LOR Tracker" description="Manage your recommendation letters with ClinicalHours Premium.">
        <LORTrackerContent />
      </PremiumGate>
    </main>
    <Footer />
  </div>
);

export default LORTracker;
