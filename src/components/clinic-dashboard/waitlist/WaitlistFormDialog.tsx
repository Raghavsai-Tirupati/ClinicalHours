import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Waitlist, WaitlistInput } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Waitlist | null;
  onSubmit: (input: WaitlistInput) => Promise<void>;
}

export default function WaitlistFormDialog({ open, onOpenChange, initial, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setDescription(initial?.description ?? '');
      setStatus(initial?.status ?? 'open');
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!description.trim()) {
      // Enforces the requirement: block publish/save if description empty.
      toast.error('Description is required.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), status });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save waitlist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit waitlist' : 'Create waitlist'}</DialogTitle>
          <DialogDescription>
            Waitlists let students sign up for a specific position or purpose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wl-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="wl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer 2026 Clinical Volunteer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-desc">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="wl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this waitlist for? Who should sign up?"
              rows={4}
            />
            {!description.trim() && (
              <p className="text-xs text-destructive">Description cannot be empty.</p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label className="text-sm">Status</Label>
              <p className="text-xs text-muted-foreground">
                {status === 'open' ? 'Accepting signups' : 'Closed — not accepting signups'}
              </p>
            </div>
            <Switch
              checked={status === 'open'}
              onCheckedChange={(v) => setStatus(v ? 'open' : 'closed')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !description.trim()}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create waitlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
