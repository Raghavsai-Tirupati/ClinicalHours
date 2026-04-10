import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, MessageSquarePlus, Pencil, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

interface PersonNote {
  id: string;
  clinic_id: string;
  student_id: string;
  body: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  clinicId: string;
  studentId: string;
}

export default function PersonNotesPanel({ clinicId, studentId }: Props) {
  const [notes, setNotes] = useState<PersonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!clinicId || !studentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('person_notes')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[person-notes] fetch failed', error);
      toast.error(error.message || 'Failed to load notes');
    } else {
      setNotes((data as PersonNote[]) || []);
    }
    setLoading(false);
  }, [clinicId, studentId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      const { error } = await supabase.from('person_notes').insert({
        clinic_id: clinicId,
        student_id: studentId,
        body,
        created_by: user?.id ?? null,
        created_by_email: user?.email ?? null,
      });
      if (error) throw error;
      setDraft('');
      await fetchNotes();
    } catch (err: any) {
      console.error('[person-notes] add failed', err);
      toast.error(err?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (note: PersonNote) => {
    setEditingId(note.id);
    setEditBody(note.body);
  };

  const handleEditSave = async (id: string) => {
    const body = editBody.trim();
    if (!body) return;
    try {
      const { error } = await supabase
        .from('person_notes')
        .update({ body })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      setEditBody('');
      await fetchNotes();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update note');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('person_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchNotes();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete note');
    }
  };

  return (
    <div className="space-y-4">
      {/* New note composer */}
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about this person..."
          rows={3}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !draft.trim()}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-3.5 w-3.5" />
            )}
            Add note
          </Button>
        </div>
      </div>

      {/* Notes feed */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isEditing = editingId === note.id;
            const wasEdited =
              new Date(note.updated_at).getTime() -
                new Date(note.created_at).getTime() >
              1000;
            return (
              <div
                key={note.id}
                className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                    {note.created_by_email && ` · ${note.created_by_email}`}
                    {wasEdited && ' · edited'}
                  </span>
                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditStart(note)}
                        className="p-1 hover:text-foreground transition-colors"
                        aria-label="Edit note"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="p-1 hover:text-destructive transition-colors"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditBody('');
                        }}
                        className="h-7 gap-1 text-xs"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEditSave(note.id)}
                        disabled={!editBody.trim()}
                        className="h-7 gap-1 text-xs"
                      >
                        <Check className="h-3 w-3" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {note.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
