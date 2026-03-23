import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { usePositionDetail } from '@/hooks/usePositionDetail';
import PositionQuestionsEditor from './PositionQuestionsEditor';
import type { PositionType, PositionStatus, QuestionFormData } from '@/types/positions';
import { POSITION_TYPE_LABELS } from '@/types/positions';

export default function PositionForm() {
  const navigate = useNavigate();
  const { positionId } = useParams<{ positionId: string }>();
  const { hospitalPage, basePath } = useHospitalPageContext();
  const pageId = hospitalPage?.id || '';
  const isEdit = !!positionId;

  const { position: existingPosition, questions: existingQuestions, loading: detailLoading } = usePositionDetail(
    isEdit ? positionId : undefined
  );

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [location, setLocation] = useState('');
  const [positionType, setPositionType] = useState<PositionType>('volunteer');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [duration, setDuration] = useState('');
  const [startDate, setStartDate] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [spotsAvailable, setSpotsAvailable] = useState('');
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const isArchived = existingPosition?.status === 'archived';

  const handleArchive = useCallback(async () => {
    if (!positionId) return;
    setArchiving(true);
    try {
      const { error } = await supabase
        .from('hospital_positions')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', positionId);
      if (error) throw error;
      toast.success('Position archived. All applicant data has been preserved.');
      navigate(basePath);
    } catch (err: unknown) {
      console.error('Archive position error:', err);
      toast.error((err as Error)?.message || 'Failed to archive position');
    } finally {
      setArchiving(false);
      setArchiveDialogOpen(false);
    }
  }, [positionId, basePath, navigate]);

  const handleUnarchive = useCallback(async () => {
    if (!positionId) return;
    setArchiving(true);
    try {
      const { error } = await supabase
        .from('hospital_positions')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', positionId);
      if (error) throw error;
      toast.success('Position restored as draft.');
      navigate(`${basePath}/positions/${positionId}`);
    } catch (err: unknown) {
      console.error('Unarchive position error:', err);
      toast.error((err as Error)?.message || 'Failed to restore position');
    } finally {
      setArchiving(false);
    }
  }, [positionId, basePath, navigate]);

  // Pre-fill location from opportunity
  useEffect(() => {
    if (!isEdit && hospitalPage) {
      setLocation(hospitalPage.opportunity.location || '');
    }
  }, [hospitalPage, isEdit]);

  // Populate form for editing
  useEffect(() => {
    if (isEdit && existingPosition) {
      setTitle(existingPosition.title);
      setDescription(existingPosition.description || '');
      setRequirements(existingPosition.requirements || '');
      setLocation(existingPosition.location || '');
      setPositionType(existingPosition.position_type);
      setHoursPerWeek(existingPosition.hours_per_week?.toString() || '');
      setDuration(existingPosition.duration || '');
      setStartDate(existingPosition.start_date || '');
      setApplicationDeadline(existingPosition.application_deadline || '');
      setSpotsAvailable(existingPosition.spots_available?.toString() || '');
    }
  }, [isEdit, existingPosition]);

  useEffect(() => {
    if (isEdit && existingQuestions.length > 0) {
      setQuestions(
        existingQuestions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          is_required: q.is_required,
          options: (q.options as string[]) || [],
          display_order: q.display_order,
        }))
      );
    }
  }, [isEdit, existingQuestions]);

  const handleSave = async (status: PositionStatus) => {
    if (!title.trim()) {
      toast.error('Position title is required');
      return;
    }
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    if (!pageId || pageId.startsWith('virtual-')) {
      toast.error('Hospital page not set up yet. Please refresh the page and try again.');
      console.error('Invalid pageId for position save:', pageId);
      return;
    }

    setSaving(true);
    try {
      const positionData = {
        hospital_page_id: pageId,
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim() || null,
        location: location.trim() || null,
        position_type: positionType,
        hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : null,
        duration: duration.trim() || null,
        start_date: startDate || null,
        application_deadline: applicationDeadline || null,
        spots_available: spotsAvailable ? parseInt(spotsAvailable) : null,
        status,
      };

      let savedPositionId = positionId;

      if (isEdit && positionId) {
        const { error } = await supabase
          .from('hospital_positions')
          .update(positionData)
          .eq('id', positionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('hospital_positions')
          .insert(positionData)
          .select('id')
          .single();
        if (error) throw error;
        savedPositionId = data.id;
      }

      // Handle questions
      if (savedPositionId) {
        // Delete removed questions (ones that had an id but are no longer in the list)
        if (isEdit) {
          const existingIds = existingQuestions.map((q) => q.id);
          const currentIds = questions.filter((q) => q.id).map((q) => q.id!);
          const removedIds = existingIds.filter((id) => !currentIds.includes(id));
          if (removedIds.length > 0) {
            await supabase
              .from('position_questions')
              .delete()
              .in('id', removedIds);
          }
        }

        // Upsert questions
        for (const q of questions) {
          if (!q.question_text.trim()) continue;

          const questionData = {
            position_id: savedPositionId,
            question_text: q.question_text.trim(),
            question_type: q.question_type,
            is_required: q.is_required,
            options: q.question_type === 'multiple_choice' ? q.options.filter(Boolean) : null,
            display_order: q.display_order,
          };

          if (q.id) {
            await supabase
              .from('position_questions')
              .update(questionData)
              .eq('id', q.id);
          } else {
            await supabase
              .from('position_questions')
              .insert(questionData);
          }
        }
      }

      toast.success(
        isEdit
          ? 'Position updated'
          : status === 'active'
            ? 'Position published!'
            : 'Position saved as draft'
      );
      navigate(`${basePath}/positions/${savedPositionId}`);
    } catch (err: unknown) {
      console.error('Position save error:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message || (err as any)?.details || 'Failed to save position';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && detailLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(basePath)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">
          {isEdit ? 'Edit Position' : 'Create New Position'}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Medical Assistant Intern"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="What does this role involve?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              placeholder="Qualifications, certifications, year in school, etc."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="City, State"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Position Type</Label>
              <Select value={positionType} onValueChange={(v) => setPositionType(v as PositionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(POSITION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hours">Hours per Week</Label>
              <Input
                id="hours"
                type="number"
                placeholder="e.g. 10"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                placeholder="e.g. 3 months"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spots">Spots Available</Label>
              <Input
                id="spots"
                type="number"
                placeholder="e.g. 5"
                value={spotsAvailable}
                onChange={(e) => setSpotsAvailable(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Application Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <PositionQuestionsEditor questions={questions} onChange={setQuestions} />

      <div className="flex gap-3 justify-between pt-4">
        {isEdit && !isArchived && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={saving || archiving}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
        {isEdit && isArchived && (
          <Button
            variant="outline"
            onClick={handleUnarchive}
            disabled={archiving}
          >
            {archiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            Restore Position
          </Button>
        )}
        <div className="flex gap-3 ml-auto">
          {!isArchived && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave('draft')}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSave('active')}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isEdit ? 'Update Position' : 'Publish Position'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete Position Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Position</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{title || 'this position'}</strong>? All associated questions and applications will also be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!positionId) return;
                setDeleting(true);
                try {
                  // Delete questions first, then position
                  await supabase.from('application_answers').delete().in(
                    'question_id',
                    existingQuestions.map((q) => q.id)
                  );
                  await supabase.from('student_applications').delete().eq('position_id', positionId);
                  await supabase.from('position_questions').delete().eq('position_id', positionId);
                  const { error } = await supabase.from('hospital_positions').delete().eq('id', positionId);
                  if (error) throw error;
                  toast.success('Position deleted');
                  navigate(basePath);
                } catch (err: unknown) {
                  console.error('Delete position error:', err);
                  toast.error((err as Error)?.message || 'Failed to delete position');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
