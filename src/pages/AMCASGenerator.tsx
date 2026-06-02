import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PremiumGate } from "@/components/PremiumGate";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { FileText, Plus, Sparkles, Loader2, Star, RotateCcw, Copy, Check, Save } from "lucide-react";
import { AMCAS_CATEGORIES } from "@/lib/premium";
import { localInsert, localSelect, localUpdate, TABLES } from "@/lib/localStore";

interface AMCASDraft {
  id: string;
  activity_type: string | null;
  amcas_category: string | null;
  organization_name: string | null;
  position_title: string | null;
  start_date: string | null;
  end_date: string | null;
  total_hours: number | null;
  description_draft: string | null;
  is_most_meaningful: boolean;
  meaningful_draft: string | null;
  user_notes: string | null;
  version: number;
  created_at: string;
}

function CharCounter({ text, max }: { text: string; max: number }) {
  const len = text.length;
  const pct = (len / max) * 100;
  const color = pct > 100 ? "text-red-400" : pct > 90 ? "text-amber-400" : "text-muted-foreground";
  return <span className={`text-xs font-mono ${color}`}>{len} / {max}</span>;
}

const AMCASGeneratorContent = () => {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<AMCASDraft[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDraft, setEditingDraft] = useState<AMCASDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingMeaningful, setGeneratingMeaningful] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    amcas_category: "",
    organization_name: "",
    position_title: "",
    start_date: "",
    end_date: "",
    total_hours: "",
    is_most_meaningful: false,
  });

  function loadDrafts() {
    setDrafts(localSelect<AMCASDraft>(TABLES.AMCAS_DRAFTS));
  }

  useEffect(() => { loadDrafts(); }, []);

  function handleAdd() {
    const newDraft = localInsert<Partial<AMCASDraft>>(TABLES.AMCAS_DRAFTS, {
      amcas_category: form.amcas_category,
      organization_name: form.organization_name,
      position_title: form.position_title,
      activity_type: null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      total_hours: parseFloat(form.total_hours) || null,
      is_most_meaningful: form.is_most_meaningful,
      description_draft: "",
      meaningful_draft: null,
      user_notes: null,
      version: 1,
    });

    setShowAdd(false);
    toast({ title: "Activity added!" });
    loadDrafts();
    setEditingDraft(newDraft as unknown as AMCASDraft);
    setForm({ amcas_category: "", organization_name: "", position_title: "", start_date: "", end_date: "", total_hours: "", is_most_meaningful: false });
  }

  function handleSaveDraft(draft: AMCASDraft) {
    localUpdate<AMCASDraft>(TABLES.AMCAS_DRAFTS, draft.id, {
      description_draft: draft.description_draft,
      meaningful_draft: draft.meaningful_draft,
      user_notes: draft.user_notes,
    });
    toast({ title: "Draft saved!" });
    loadDrafts();
  }

  async function handleGenerate(target: "description" | "meaningful" = "description") {
    if (!editingDraft) return;

    const isDesc = target === "description";
    if (isDesc) setGenerating(true);
    else setGeneratingMeaningful(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-amcas-description", {
        body: {
          activity_name: editingDraft.organization_name || "",
          activity_type: editingDraft.amcas_category || editingDraft.activity_type || "",
          role: editingDraft.position_title || "",
          hours_per_week: null,
          total_hours: editingDraft.total_hours,
          is_most_meaningful: isDesc ? false : editingDraft.is_most_meaningful,
          user_notes: editingDraft.user_notes || "",
          ...(target === "meaningful" && { max_chars: 1325, essay_type: "most_meaningful" }),
        },
      });

      if (error) throw error;

      if (data?.description) {
        const maxChars = isDesc ? 700 : 1325;
        const text = data.description.slice(0, maxChars);
        if (isDesc) {
          setEditingDraft({ ...editingDraft, description_draft: text });
        } else {
          setEditingDraft({ ...editingDraft, meaningful_draft: text });
        }
        toast({ title: `${isDesc ? "Description" : "Essay"} generated!` });
      } else {
        throw new Error("No description returned from AI");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Generation failed";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    } finally {
      if (isDesc) setGenerating(false);
      else setGeneratingMeaningful(false);
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const meaningfulCount = drafts.filter((d) => d.is_most_meaningful).length;

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-semibold text-foreground">{drafts.length}</p><p className="text-xs text-muted-foreground">Activities</p></div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-400" />
            <div><p className="text-2xl font-semibold text-foreground">{meaningfulCount} / 3</p><p className="text-xs text-muted-foreground">Most Meaningful</p></div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <div><p className="text-2xl font-semibold text-foreground">{drafts.filter((d) => d.description_draft && d.description_draft.length > 0).length}</p><p className="text-xs text-muted-foreground">Drafts Generated</p></div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Activities</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Activity</Button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No activities yet. Add your first activity to generate AMCAS descriptions.</p>
          <Button onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Your First Activity</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground text-sm">{draft.organization_name || "Unnamed"}</span>
                    {draft.amcas_category && <span className="inline-flex max-w-full items-center break-words rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{draft.amcas_category}</span>}
                    {draft.is_most_meaningful && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"><Star className="h-3 w-3" /> Most Meaningful</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {draft.position_title && <span>{draft.position_title}</span>}
                    {draft.total_hours && <span>{draft.total_hours}h</span>}
                    {draft.description_draft && <span className="text-emerald-400">{draft.description_draft.length}/700 chars</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {draft.description_draft && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(draft.description_draft || "", draft.id)}>
                      {copied === draft.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingDraft(draft)}>
                    <Sparkles className="h-3.5 w-3.5" /> Edit / Generate
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Activity Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add AMCAS Activity</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>AMCAS Category</Label>
              <Select value={form.amcas_category} onValueChange={(v) => setForm({ ...form, amcas_category: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{AMCAS_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Organization</Label><Input className="mt-1.5" value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} /></div>
              <div><Label>Position / Role</Label><Input className="mt-1.5" value={form.position_title} onChange={(e) => setForm({ ...form, position_title: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label>Start Date</Label><Input type="date" className="mt-1.5" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" className="mt-1.5" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div><Label>Total Hours</Label><Input type="number" className="mt-1.5" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <Switch checked={form.is_most_meaningful} onCheckedChange={(v) => setForm({ ...form, is_most_meaningful: v })} />
              <div><p className="text-sm font-medium text-foreground">Most Meaningful</p><p className="text-xs text-muted-foreground">You can mark up to 3 activities as most meaningful</p></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!form.amcas_category || !form.organization_name.trim()}>Add Activity</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Generate Dialog */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => !open && setEditingDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {editingDraft && (
            <>
              <DialogHeader><DialogTitle>{editingDraft.organization_name || "Activity"} — Description Editor</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {editingDraft.amcas_category && <span className="bg-muted px-2 py-0.5 rounded text-xs">{editingDraft.amcas_category}</span>}
                  {editingDraft.position_title && <span className="bg-muted px-2 py-0.5 rounded text-xs">{editingDraft.position_title}</span>}
                  {editingDraft.total_hours && <span>{editingDraft.total_hours}h</span>}
                </div>

                {/* User Notes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Your Notes / Bullet Points</Label>
                    <span className="text-xs text-muted-foreground">Optional — helps the AI write a better description</span>
                  </div>
                  <Textarea
                    rows={3}
                    value={editingDraft.user_notes || ""}
                    onChange={(e) => setEditingDraft({ ...editingDraft, user_notes: e.target.value })}
                    placeholder="e.g., Assisted with patient intake, learned to take vitals, worked closely with Dr. Smith in cardiology..."
                    className="text-sm"
                  />
                </div>

                {/* Activity Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Activity Description (700 char max)</Label>
                    <CharCounter text={editingDraft.description_draft || ""} max={700} />
                  </div>
                  {generating ? (
                    <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-border bg-muted/30">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-400 mb-3" />
                      <p className="text-sm text-muted-foreground">Generating description...</p>
                    </div>
                  ) : (
                    <Textarea
                      rows={8}
                      value={editingDraft.description_draft || ""}
                      onChange={(e) => setEditingDraft({ ...editingDraft, description_draft: e.target.value })}
                      placeholder="Describe your role, responsibilities, specific impact, and a brief reflective insight..."
                    />
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleGenerate("description")}
                      disabled={generating}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {editingDraft.description_draft ? "Regenerate" : "AI Generate"}
                    </Button>
                    {editingDraft.description_draft && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setEditingDraft({ ...editingDraft, description_draft: "" })}
                        disabled={generating}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Most Meaningful Essay */}
                {editingDraft.is_most_meaningful && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label>Most Meaningful Essay (1325 char max)</Label>
                      <CharCounter text={editingDraft.meaningful_draft || ""} max={1325} />
                    </div>
                    {generatingMeaningful ? (
                      <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-border bg-muted/30">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-400 mb-3" />
                        <p className="text-sm text-muted-foreground">Generating essay...</p>
                      </div>
                    ) : (
                      <Textarea
                        rows={10}
                        value={editingDraft.meaningful_draft || ""}
                        onChange={(e) => setEditingDraft({ ...editingDraft, meaningful_draft: e.target.value })}
                        placeholder="Describe the transformative moment, the impact you made, and your personal growth..."
                      />
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleGenerate("meaningful")}
                        disabled={generatingMeaningful}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {editingDraft.meaningful_draft ? "Regenerate" : "AI Generate"}
                      </Button>
                      {editingDraft.meaningful_draft && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditingDraft({ ...editingDraft, meaningful_draft: "" })}
                          disabled={generatingMeaningful}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Clear
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button variant="outline" onClick={() => setEditingDraft(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="gap-1.5"
                    onClick={() => { handleSaveDraft(editingDraft); setEditingDraft(null); }}
                    disabled={generating || generatingMeaningful}
                  >
                    <Save className="h-3.5 w-3.5" /> Save Draft
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AMCASGenerator = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-24 md:pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">AMCAS Activity Writer</h1>
        <p className="text-muted-foreground mt-1">AI-powered writing assistant for your Work & Activities descriptions.</p>
      </div>
      <PremiumGate featureName="AMCAS Activity Writer" description="Generate polished AMCAS activity descriptions with ClinicalHours Premium.">
        <AMCASGeneratorContent />
      </PremiumGate>
    </main>
    <Footer />
  </div>
);

export default AMCASGenerator;
