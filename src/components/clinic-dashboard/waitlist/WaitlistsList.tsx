import { useEffect, useMemo, useState } from 'react';
import { Plus, ClipboardList, Users, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useWaitlists, type Waitlist } from './hooks';
import WaitlistFormDialog from './WaitlistFormDialog';

interface Props {
  onSelect: (waitlist: Waitlist) => void;
}

export default function WaitlistsList({ onSelect }: Props) {
  const { hospitalPage } = useHospitalPageContext();
  const clinicId = hospitalPage?.id;
  const { waitlists, loading, createWaitlist, updateWaitlist, deleteWaitlist } = useWaitlists(clinicId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Waitlist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Waitlist | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Fetch signup counts per waitlist
  useEffect(() => {
    if (!clinicId || waitlists.length === 0) { setCounts({}); return; }
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('waitlist_submissions')
        .select('waitlist_id')
        .eq('clinic_id', clinicId);
      if (!data) return;
      const next: Record<string, number> = {};
      for (const row of data as { waitlist_id: string | null }[]) {
        if (row.waitlist_id) next[row.waitlist_id] = (next[row.waitlist_id] ?? 0) + 1;
      }
      setCounts(next);
    })();
  }, [clinicId, waitlists]);

  const openCount = useMemo(() => waitlists.filter((w) => w.status === 'open').length, [waitlists]);

  const handleCreate = () => { setEditing(null); setFormOpen(true); };
  const handleEdit = (w: Waitlist) => { setEditing(w); setFormOpen(true); };

  const handleSubmit = async (input: { title: string; description: string; status?: 'open' | 'closed' }) => {
    if (editing) {
      await updateWaitlist(editing.id, input);
      toast.success('Waitlist updated.');
    } else {
      await createWaitlist(input);
      toast.success('Waitlist created.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWaitlist(deleteTarget.id);
      toast.success('Waitlist deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete waitlist.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${waitlists.length} waitlist${waitlists.length === 1 ? '' : 's'} · ${openCount} open`}
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New waitlist
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : waitlists.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">No waitlists yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first waitlist to start collecting interest signups.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Create waitlist
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {waitlists.map((w) => (
            <div
              key={w.id}
              className="border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer bg-card"
              onClick={() => onSelect(w)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold line-clamp-2">{w.title}</h3>
                <Badge variant={w.status === 'open' ? 'default' : 'secondary'}>
                  {w.status === 'open' ? 'Open' : 'Closed'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{w.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {counts[w.id] ?? 0} signup{(counts[w.id] ?? 0) === 1 ? '' : 's'}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleEdit(w); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(w); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <WaitlistFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete waitlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}" and all its signups. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
