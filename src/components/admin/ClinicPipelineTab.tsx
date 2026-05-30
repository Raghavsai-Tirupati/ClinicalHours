import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Search, RefreshCw, ChevronRight, MapPin, Globe, User, Phone, Mail,
  TrendingUp, Clock, ExternalLink, Edit2, Trash2, History,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const STAGES = [
  { value: 'discovered', label: 'Discovered', color: 'bg-gray-500' },
  { value: 'researched', label: 'Researched', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'replied', label: 'Replied', color: 'bg-orange-500' },
  { value: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { value: 'pilot', label: 'Pilot', color: 'bg-cyan-500' },
  { value: 'live', label: 'Live', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

interface ClinicLead {
  id: string;
  name: string;
  website: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  source: string;
  pipeline_stage: string;
  fit_score: number | null;
  urgency_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

interface StageHistory {
  id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  created_at: string;
}

export default function ClinicPipelineTab() {
  const [leads, setLeads] = useState<ClinicLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<ClinicLead | null>(null);
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [history, setHistory] = useState<StageHistory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();

  const loadLeads = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('clinic_leads').select('*').order('updated_at', { ascending: false });
    if (stageFilter !== 'all') q = q.eq('pipeline_stage', stageFilter);
    const { data } = await q;
    setLeads(data ?? []);
    setLoading(false);
  }, [stageFilter]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  async function openLead(lead: ClinicLead) {
    setSelectedLead(lead);
    const [contactsRes, historyRes] = await Promise.all([
      supabase.from('lead_contacts').select('*').eq('lead_id', lead.id).order('is_primary', { ascending: false }),
      supabase.from('lead_pipeline_history').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
    ]);
    setContacts(contactsRes.data ?? []);
    setHistory(historyRes.data ?? []);
  }

  async function advanceStage(lead: ClinicLead) {
    const idx = STAGES.findIndex(s => s.value === lead.pipeline_stage);
    if (idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1].value;
    await supabase.from('lead_pipeline_history').insert({ lead_id: lead.id, from_stage: lead.pipeline_stage, to_stage: next });
    await supabase.from('clinic_leads').update({ pipeline_stage: next, updated_at: new Date().toISOString() }).eq('id', lead.id);
    toast({ title: `Lead moved to ${STAGES[idx + 1].label}` });
    loadLeads();
    if (selectedLead?.id === lead.id) openLead({ ...lead, pipeline_stage: next });
  }

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s.value] = leads.filter(l => l.pipeline_stage === s.value).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase()) ||
    l.specialty?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Clinic Pipeline</h2>
          <p className="text-sm text-muted-foreground">Track clinic leads from discovery to live</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Lead
        </Button>
      </div>

      {/* Stage kanban counts */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STAGES.map(s => (
          <button
            key={s.value}
            onClick={() => setStageFilter(stageFilter === s.value ? 'all' : s.value)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              stageFilter === s.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted/40 hover:bg-muted'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            {s.label}
            <span className="font-semibold">{stageCounts[s.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Lead table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No leads found. Add your first clinic lead to start the pipeline.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const stage = STAGES.find(s => s.value === lead.pipeline_stage);
            return (
              <div
                key={lead.id}
                className="flex items-center gap-4 rounded-md border border-border/60 bg-card/60 p-4 hover:bg-card cursor-pointer transition-colors"
                onClick={() => openLead(lead)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{lead.name}</p>
                    {stage && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${stage.color}/20 text-foreground`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stage.color}`} />
                        {stage.label}
                      </span>
                    )}
                    {lead.source === 'agent_research' && (
                      <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/30">agent</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {lead.city && lead.state && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.city}, {lead.state}</span>
                    )}
                    {lead.specialty && <span>{lead.specialty}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {lead.fit_score != null && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Fit</p>
                      <p className="text-sm font-semibold">{lead.fit_score}</p>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={e => { e.stopPropagation(); advanceStage(lead); }}
                    disabled={lead.pipeline_stage === 'live' || lead.pipeline_stage === 'lost'}
                  >
                    Advance
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead detail sheet */}
      <Sheet open={!!selectedLead} onOpenChange={open => !open && setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selectedLead.name}</SheetTitle>
              </SheetHeader>

              <div className="space-y-6">
                {/* Stage + actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  {STAGES.map(s => (
                    <button
                      key={s.value}
                      onClick={async () => {
                        if (s.value === selectedLead.pipeline_stage) return;
                        await supabase.from('lead_pipeline_history').insert({ lead_id: selectedLead.id, from_stage: selectedLead.pipeline_stage, to_stage: s.value });
                        await supabase.from('clinic_leads').update({ pipeline_stage: s.value }).eq('id', selectedLead.id);
                        setSelectedLead({ ...selectedLead, pipeline_stage: s.value });
                        loadLeads();
                      }}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition-colors ${
                        s.value === selectedLead.pipeline_stage
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedLead.city && (
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p>{selectedLead.city}{selectedLead.state ? `, ${selectedLead.state}` : ''}</p>
                    </div>
                  )}
                  {selectedLead.specialty && (
                    <div>
                      <p className="text-xs text-muted-foreground">Specialty</p>
                      <p>{selectedLead.specialty}</p>
                    </div>
                  )}
                  {selectedLead.fit_score != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Fit Score</p>
                      <p className="font-semibold">{selectedLead.fit_score}/100</p>
                    </div>
                  )}
                  {selectedLead.urgency_score != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Urgency Score</p>
                      <p className="font-semibold">{selectedLead.urgency_score}/100</p>
                    </div>
                  )}
                  {selectedLead.website && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Website</p>
                      <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        {selectedLead.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {selectedLead.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                )}

                <Separator />

                {/* Contacts */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" /> Contacts
                    </p>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No contacts yet</p>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map(c => (
                        <div key={c.id} className="rounded-md border border-border/60 p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium">{c.name}</p>
                              {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                            </div>
                            {c.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                          </div>
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                            {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Stage history */}
                <div>
                  <p className="text-sm font-medium flex items-center gap-2 mb-3">
                    <History className="h-4 w-4" /> Stage History
                  </p>
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No stage changes recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map(h => (
                        <div key={h.id} className="flex items-start gap-3 text-sm">
                          <div className="text-xs text-muted-foreground mt-0.5 w-24 shrink-0">
                            {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                          </div>
                          <div>
                            <span className="text-muted-foreground">{h.from_stage ?? '—'}</span>
                            <span className="mx-2">→</span>
                            <span className="font-medium">{h.to_stage}</span>
                            {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Lead dialog */}
      <AddLeadDialog open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadLeads} />
    </div>
  );
}

function AddLeadDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', city: '', state: '', specialty: '', website: '', notes: '', fit_score: '', urgency_score: '', source: 'manual' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function field(key: keyof typeof form) {
    return { value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value })) };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('clinic_leads').insert({
      name: form.name.trim(),
      city: form.city || null,
      state: form.state || null,
      specialty: form.specialty || null,
      website: form.website || null,
      notes: form.notes || null,
      fit_score: form.fit_score ? parseInt(form.fit_score) : null,
      urgency_score: form.urgency_score ? parseInt(form.urgency_score) : null,
      source: form.source,
      pipeline_stage: 'discovered',
    });
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Lead added' });
    setForm({ name: '', city: '', state: '', specialty: '', website: '', notes: '', fit_score: '', urgency_score: '', source: 'manual' });
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Clinic Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Clinic Name *</Label>
            <Input placeholder="Memorial Clinic" {...field('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Austin" {...field('city')} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input placeholder="TX" {...field('state')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Specialty</Label>
            <Input placeholder="Internal Medicine" {...field('specialty')} />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input placeholder="https://..." {...field('website')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fit Score (0-100)</Label>
              <Input type="number" min="0" max="100" {...field('fit_score')} />
            </div>
            <div className="space-y-1.5">
              <Label>Urgency Score (0-100)</Label>
              <Input type="number" min="0" max="100" {...field('urgency_score')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} placeholder="Research notes, context…" {...field('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? 'Adding…' : 'Add Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
