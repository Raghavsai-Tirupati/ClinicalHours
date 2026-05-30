import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Plus, RefreshCw, MessageSquare, Send, Clock, CheckCircle2,
  XCircle, Eye, ShieldAlert, Users, Zap, ChevronRight, Mail,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// Message status config
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:        { label: 'Draft',        color: 'text-muted-foreground', icon: Clock },
  needs_review: { label: 'Needs Review', color: 'text-yellow-400',       icon: ShieldAlert },
  approved:     { label: 'Approved',     color: 'text-green-400',        icon: CheckCircle2 },
  queued:       { label: 'Queued',       color: 'text-blue-400',         icon: Clock },
  sent:         { label: 'Sent',         color: 'text-green-500',        icon: CheckCircle2 },
  failed:       { label: 'Failed',       color: 'text-red-400',          icon: XCircle },
  cancelled:    { label: 'Cancelled',    color: 'text-muted-foreground', icon: XCircle },
};

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  created_at: string;
}

interface CampaignMessage {
  id: string;
  campaign_id: string | null;
  recipient_email: string;
  recipient_type: string;
  subject: string;
  body_html: string;
  author_source: string;
  status: string;
  reasoning: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export default function MessagingTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Messaging</h2>
        <p className="text-sm text-muted-foreground">Draft, review, approve, and track all outbound messages</p>
      </div>

      <Tabs defaultValue="review-queue" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="review-queue" className="text-xs sm:text-sm">Review Queue</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs sm:text-sm">Campaigns</TabsTrigger>
          <TabsTrigger value="send-history" className="text-xs sm:text-sm">Send History</TabsTrigger>
          <TabsTrigger value="compose" className="text-xs sm:text-sm">Compose</TabsTrigger>
        </TabsList>

        <TabsContent value="review-queue">
          <ReviewQueue />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsPane />
        </TabsContent>
        <TabsContent value="send-history">
          <SendHistory />
        </TabsContent>
        <TabsContent value="compose">
          <ComposePane />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Queue — needs_review + draft messages awaiting human approval
// ---------------------------------------------------------------------------
function ReviewQueue() {
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CampaignMessage | null>(null);
  const [confirmSend, setConfirmSend] = useState<CampaignMessage | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('campaign_messages')
      .select('*')
      .in('status', ['needs_review', 'draft'])
      .order('created_at', { ascending: false });
    setMessages(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(msg: CampaignMessage) {
    await supabase.from('campaign_messages').update({
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', msg.id);
    toast({ title: 'Message approved' });
    load();
    setSelected(null);
  }

  async function reject(msg: CampaignMessage) {
    await supabase.from('campaign_messages').update({ status: 'cancelled' }).eq('id', msg.id);
    toast({ title: 'Message cancelled' });
    load();
    setSelected(null);
  }

  async function sendNow(msg: CampaignMessage) {
    // Approve + queue via edge function
    await supabase.from('campaign_messages').update({
      status: 'queued',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      queued_at: new Date().toISOString(),
    }).eq('id', msg.id);

    // Invoke send edge function
    const { error } = await supabase.functions.invoke('send-approved-campaign', {
      body: { message_id: msg.id },
    });

    if (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Message sent' });
    }
    setConfirmSend(null);
    setSelected(null);
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {messages.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="No messages awaiting review" />
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const cfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={msg.id}
                className="flex items-start gap-4 rounded-md border border-border/60 bg-card/60 p-4 hover:bg-card cursor-pointer transition-colors"
                onClick={() => setSelected(msg)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{msg.subject}</p>
                    <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    {msg.author_source === 'agent' && (
                      <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/30">agent</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    To: {msg.recipient_email} · {msg.recipient_type}
                  </p>
                  {msg.reasoning && (
                    <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">"{msg.reasoning}"</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="h-8 text-xs" onClick={e => { e.stopPropagation(); setConfirmSend(msg); }}>
                    <Send className="h-3 w-3 mr-1" /> Approve & Send
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={e => { e.stopPropagation(); reject(msg); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Message detail sheet */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base">{selected.subject}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">To</p><p>{selected.recipient_email}</p></div>
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="capitalize">{selected.recipient_type}</p></div>
                  <div><p className="text-xs text-muted-foreground">Author</p><p className="capitalize">{selected.author_source}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><p>{STATUS_CONFIG[selected.status]?.label}</p></div>
                </div>
                {selected.reasoning && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Agent reasoning</p>
                    <p className="text-sm italic text-muted-foreground border-l-2 border-border pl-3">{selected.reasoning}</p>
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Message body</p>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-sm whitespace-pre-wrap font-mono text-xs">
                    {selected.body_html}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => setConfirmSend(selected)}>
                    <Send className="h-4 w-4 mr-2" /> Approve & Send
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => reject(selected)}>
                    Cancel Message
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Send confirmation */}
      <AlertDialog open={!!confirmSend} onOpenChange={open => !open && setConfirmSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Send</AlertDialogTitle>
            <AlertDialogDescription>
              This will send an email to <strong>{confirmSend?.recipient_email}</strong> with subject: "{confirmSend?.subject}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmSend && sendNow(confirmSend)}>
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Campaigns pane
// ---------------------------------------------------------------------------
function CampaignsPane() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
    outreach: 'Outreach', nurture: 'Nurture', reactivation: 'Reactivation', conversion: 'Conversion',
  };
  const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
    draft: 'text-muted-foreground', active: 'text-green-400', paused: 'text-yellow-400',
    completed: 'text-blue-400', cancelled: 'text-red-400',
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Campaign
        </Button>
      </div>
      {campaigns.length === 0 ? (
        <EmptyState icon={Zap} message="No campaigns yet. Create one to start tracking outreach." />
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c.id} className="flex items-center gap-4 rounded-md border border-border/60 bg-card/60 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{c.name}</p>
                  <Badge variant="outline" className="text-xs">{CAMPAIGN_TYPE_LABELS[c.campaign_type] ?? c.campaign_type}</Badge>
                  <span className={`text-xs ${CAMPAIGN_STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <CreateCampaignDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
}

function CreateCampaignDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('outreach');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('campaigns').insert({ name: name.trim(), campaign_type: type, description: description || null });
    setSaving(false);
    toast({ title: 'Campaign created' });
    setName(''); setType('outreach'); setDescription('');
    onCreated(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Q3 Clinic Outreach" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outreach">Outreach</SelectItem>
                <SelectItem value="nurture">Nurture</SelectItem>
                <SelectItem value="reactivation">Reactivation</SelectItem>
                <SelectItem value="conversion">Conversion</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Send History
// ---------------------------------------------------------------------------
function SendHistory() {
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('campaign_messages')
      .select('*')
      .in('status', ['sent', 'failed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setMessages(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (messages.length === 0) return <EmptyState icon={Mail} message="No sent messages yet" />;

  return (
    <div className="space-y-2">
      {messages.map(msg => {
        const cfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.draft;
        const Icon = cfg.icon;
        return (
          <div key={msg.id} className="flex items-center gap-4 rounded-md border border-border/60 bg-card/60 p-4">
            <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{msg.subject}</p>
              <p className="text-xs text-muted-foreground">
                {msg.recipient_email} · {msg.sent_at ? format(new Date(msg.sent_at), 'MMM d, h:mmaaa') : cfg.label}
              </p>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compose — draft a new message
// ---------------------------------------------------------------------------
function ComposePane() {
  const [form, setForm] = useState({ recipient_email: '', recipient_type: 'student', subject: '', body_html: '', reasoning: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recipient_email || !form.subject || !form.body_html) return;
    setSaving(true);
    const { error } = await supabase.from('campaign_messages').insert({
      recipient_email: form.recipient_email,
      recipient_type: form.recipient_type,
      subject: form.subject,
      body_html: form.body_html,
      reasoning: form.reasoning || null,
      author_source: 'human',
      status: 'needs_review',
    });
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Draft saved for review', description: 'Message moved to Review Queue' });
    setForm({ recipient_email: '', recipient_type: 'student', subject: '', body_html: '', reasoning: '' });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">New Message</CardTitle>
        <p className="text-xs text-muted-foreground">All messages go through review before sending.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Recipient Email *</Label>
              <Input type="email" placeholder="student@example.com" {...field('recipient_email')} />
            </div>
            <div className="space-y-1.5">
              <Label>Recipient Type</Label>
              <Select value={form.recipient_type} onValueChange={v => setForm(f => ({ ...f, recipient_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                  <SelectItem value="clinic_contact">Clinic Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input placeholder="Your clinical hours await…" {...field('subject')} />
          </div>
          <div className="space-y-1.5">
            <Label>Body *</Label>
            <Textarea rows={8} placeholder="Message body…" {...field('body_html')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes / Reasoning</Label>
            <Input placeholder="Why are you sending this?" {...field('reasoning')} />
          </div>
          <Button type="submit" disabled={saving || !form.recipient_email || !form.subject || !form.body_html}>
            {saving ? 'Saving…' : 'Save for Review'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
