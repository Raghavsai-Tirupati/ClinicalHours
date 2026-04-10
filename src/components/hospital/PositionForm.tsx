import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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
import SchedulingQuestionsConfig from '@/components/clinic-dashboard/applications/SchedulingQuestionsConfig';
import type { PositionType, PositionStatus, QuestionFormData } from '@/types/positions';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import { Badge } from '@/components/ui/badge';

export default function PositionForm() {
  const navigate = useNavigate();
  const { positionId } = useParams<{ positionId: string }>();
  const { hospitalPage, basePath } = useHospitalPageContext();
  const pageId = hospitalPage?.id || '';
  const isEdit = !!positionId;

  const { position: existingPosition, questions: existingQuestions, loading: detailLoading } = usePositionDetail(
    isEdit ? positionId : undefined,
    { adminMode: true },
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
  const [askForAvailability, setAskForAvailability] = useState(true);
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [matchKeywords, setMatchKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [positionStatus, setPositionStatus] = useState<PositionStatus>('draft');

  const transitioningToArchived =
    positionStatus === 'archived' && existingPosition?.status !== 'archived';

  const STATUS_OPTIONS: { value: PositionStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ];
  const STATUS_HELPER_TEXT: Record<'draft' | 'active' | 'archived', string> = {
    draft: 'Not visible to students yet.',
    active: 'Visible to students and accepting applications.',
    archived: 'Hidden from students. Existing applicant data is preserved.',
  };

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
      setAskForAvailability(existingPosition.ask_for_availability !== false);
      setMatchKeywords(existingPosition.match_keywords || []);
      setPositionStatus(existingPosition.status);
    }
  }, [isEdit, existingPosition]);

  useEffect(() => {
    if (isEdit && existingQuestions.length > 0) {
      setQuestions(
        existingQuestions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          // treat legacy long_answer as short_answer
          question_type: q.question_type === 'long_answer' ? 'short_answer' : q.question_type,
          is_required: q.is_required,
          options: (q.options as string[]) || [],
          display_order: q.display_order,
          char_limit: q.char_limit ?? null,
        }))
      );
    }
  }, [isEdit, existingQuestions]);

  const handleSave = useCallback(async () => {
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
        ask_for_availability: askForAvailability,
        match_keywords: matchKeywords.filter(Boolean),
        status: positionStatus,
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
            char_limit: q.question_type === 'short_answer' ? (q.char_limit ?? null) : null,
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
          : positionStatus === 'active'
            ? 'Position published!'
            : positionStatus === 'archived'
              ? 'Position archived. All applicant data has been preserved.'
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
      setArchiveDialogOpen(false);
    }
  }, [
    title,
    description,
    pageId,
    positionStatus,
    requirements,
    location,
    positionType,
    hoursPerWeek,
    duration,
    startDate,
    applicationDeadline,
    spotsAvailable,
    askForAvailability,
    matchKeywords,
    positionId,
    isEdit,
    existingQuestions,
    questions,
    navigate,
    basePath,
  ]);

  const handleSaveClick = () => {
    if (transitioningToArchived) {
      setArchiveDialogOpen(true);
      return;
    }
    void handleSave();
  };

  if (isEdit && detailLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl w-full space-y-6">
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

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="details" className="flex-1 sm:flex-none">Position Details</TabsTrigger>
          <TabsTrigger value="questions" className="flex-1 sm:flex-none">
            Application Questions
            {questions.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                {questions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0">
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
        <Card className="2xl:col-span-8">
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

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="ask-for-availability">Ask for availability?</Label>
                <p className="text-xs text-muted-foreground">
                  If enabled, applicants complete an availability step (days, preferred time, weekly hours).
                </p>
              </div>
              <Switch
                id="ask-for-availability"
                checked={askForAvailability}
                onCheckedChange={setAskForAvailability}
              />
            </div>

            <div className="space-y-2">
              <Label>Resume Match Keywords (ATS)</Label>
              <p className="text-xs text-muted-foreground">
                Add keywords to auto-score applicants' resumes. Each applicant gets a 0–100 match percentage.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. CPR, clinical research, EMR…"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const kw = keywordInput.trim();
                      if (kw && !matchKeywords.includes(kw)) {
                        setMatchKeywords((prev) => [...prev, kw]);
                        setKeywordInput('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    const kw = keywordInput.trim();
                    if (kw && !matchKeywords.includes(kw)) {
                      setMatchKeywords((prev) => [...prev, kw]);
                      setKeywordInput('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              {matchKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {matchKeywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="gap-1.5 text-xs cursor-pointer hover:bg-destructive/10 hover:border-destructive/40 transition-colors"
                      onClick={() => setMatchKeywords((prev) => prev.filter((_, j) => j !== i))}
                    >
                      {kw}
                      <span className="opacity-50">×</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
        </TabsContent>

        <TabsContent value="questions" className="mt-0">
          <div className="max-w-3xl space-y-6">
            <PositionQuestionsEditor questions={questions} onChange={setQuestions} />

            {/* Scheduling questions */}
            {isEdit && positionId ? (
              <SchedulingQuestionsConfig positionId={positionId} clinicId={pageId} />
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Save this position first to configure its scheduling questions.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 justify-between pt-4">
        <div>
          {isEdit && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <div className="min-w-[170px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
            <Select
              value={positionStatus}
              onValueChange={(value) => setPositionStatus(value as PositionStatus)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {STATUS_HELPER_TEXT[positionStatus as 'draft' | 'active' | 'archived']}
            </p>
          </div>
          <Button onClick={handleSaveClick} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {positionStatus === 'archived' ? 'Save and archive' : 'Save changes'}
          </Button>
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

      {/* Archive Position Confirm Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Position</DialogTitle>
            <DialogDescription>
              Archive <strong>{title || 'this position'}</strong>? All applicant data, questions, and responses will be preserved. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
