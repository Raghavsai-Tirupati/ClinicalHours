import { useState, useEffect } from 'react';
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  Code,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useWaitlistSettings } from './hooks';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export default function WaitlistSettings() {
  const { hospitalPage } = useHospitalPageContext();
  const clinicId = hospitalPage?.id;
  const clinicName = hospitalPage?.opportunity.name || '';
  const { settings, loading, createSettings, updateSettings } = useWaitlistSettings(clinicId);

  const [slugInput, setSlugInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);

  useEffect(() => {
    if (!settings && clinicName) {
      setSlugInput(generateSlug(clinicName));
    }
  }, [settings, clinicName]);

  const handleCreate = async () => {
    if (!slugInput.trim()) { toast.error('Please enter a URL slug.'); return; }
    setCreating(true);
    try {
      await createSettings(slugInput.trim());
      toast.success('Waitlist link created!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create waitlist settings.';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('This slug is already taken. Try a different one.');
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async () => {
    if (!settings) return;
    setToggling(true);
    try {
      await updateSettings({ is_open: !settings.is_open });
      toast.success(settings.is_open ? 'Waitlist closed.' : 'Waitlist opened!');
    } catch {
      toast.error('Failed to update waitlist status.');
    } finally {
      setToggling(false);
    }
  };

  const waitlistUrl = settings
    ? `${window.location.origin}/waitlist/${settings.slug}`
    : '';

  const embedSnippet = settings
    ? `<iframe src="${waitlistUrl}" width="100%" height="800" frameborder="0" style="border:none;border-radius:8px;"></iframe>`
    : '';

  const copyToClipboard = (text: string, type: 'link' | 'embed') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No settings yet — show setup
  if (!settings) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Set Up Your Waitlist</h3>
              <p className="text-sm text-muted-foreground">Create a public waitlist link for your clinic.</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{window.location.origin}/waitlist/</span>
              <input
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-clinic"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Only lowercase letters, numbers, and hyphens.</p>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={creating || !slugInput.trim()}
            onClick={handleCreate}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            Create Waitlist Link
          </button>
        </div>
      </div>
    );
  }

  // Settings exist — show controls
  return (
    <div className="space-y-6">
      {/* Status toggle */}
      <div className="rounded-lg border border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${settings.is_open ? 'bg-green-500/10' : 'bg-muted'}`}>
              {settings.is_open
                ? <ToggleRight size={20} className="text-green-400" />
                : <ToggleLeft size={20} className="text-muted-foreground" />}
            </div>
            <div>
              <h3 className="font-semibold">Waitlist Status</h3>
              <p className="text-sm text-muted-foreground">
                {settings.is_open ? 'Accepting submissions' : 'Waitlist is closed'}
              </p>
            </div>
          </div>
          <button
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              settings.is_open
                ? 'border border-border hover:bg-muted'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            disabled={toggling}
            onClick={handleToggle}
          >
            {toggling ? <Loader2 size={14} className="animate-spin" /> : null}
            {settings.is_open ? 'Close Waitlist' : 'Open Waitlist'}
          </button>
        </div>
      </div>

      {/* Shareable link */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Shareable Link</h3>
            <p className="text-sm text-muted-foreground">Share this link or embed it on your website.</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Waitlist URL</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
              value={waitlistUrl}
              readOnly
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
              onClick={() => copyToClipboard(waitlistUrl, 'link')}
            >
              {copied === 'link' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
            <a
              href={waitlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <ExternalLink size={14} /> Open
            </a>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
            <Code size={14} /> Embed Snippet
          </label>
          <div className="relative">
            <pre className="rounded-md border border-border bg-muted/50 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {embedSnippet}
            </pre>
            <button
              className="absolute top-2 right-2 inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
              onClick={() => copyToClipboard(embedSnippet, 'embed')}
            >
              {copied === 'embed' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied === 'embed' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Paste this into your website HTML to embed the waitlist form.
          </p>
        </div>
      </div>

      {/* Waitlist status badge */}
      <div className="rounded-lg border border-border p-6">
        <h3 className="font-semibold mb-2">Status</h3>
        <div className="flex items-center gap-2">
          <Badge className={settings.is_open ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}>
            {settings.is_open ? 'Open' : 'Closed'}
          </Badge>
          <span className="text-sm text-muted-foreground">Slug: {settings.slug}</span>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">Created {new Date(settings.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
