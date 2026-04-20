import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Copy } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import PositionQuestionsEditor from './PositionQuestionsEditor';
import type { PositionType, PositionStatus, QuestionFormData, HospitalPosition, PositionQuestion } from '@/types/positions';
import { POSITION_TYPE_LABELS } from '@/types/positions';

export default function CopyPositionForm() {
  const navigate = useNavigate();
  const { hospitalPage, basePath } = useHospitalPageContext();
  const pageId = hospitalPage?.id || '';

  const [positions, setPositions] = useState<HospitalPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [sourceLoading, setSourceLoading] = useState(false);

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
  const [positionStatus, setPositionStatus] = useState<PositionStatus>('draft');

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

  // Fetch all existing positions for the dropdown
  useEffect(() => {
    if (!pageId || pageId.startsWith('virtual-')) return;
    const fetchPositions = async () => {
      setPositionsLoading(true);
      const { data, error } = await supabase
        .from('hospital_positions')
        .select('*')
        .eq('hospital_page_id', pageId)
        .order('created_at', { ascending: false });
      if (!error && data) setPositions(data as HospitalPosition[]);
      setPositionsLoading(false);
    };
    void fetchPositions();
  }, [pageId]);

  // Pre-fill location from hospital page for blank form
  useEffect(() => {
    if (!selectedSourceId && hospitalPage) {
      setLocation(hospitalPage.opportunity.location || '');
    }
  }, [hospitalPage, selectedSourceId]);

  // When a source position is selected, load and pre-fill its data
  const handleSourceSelect = useCallback(async (sourceId: string) => {
    setSelectedSourceId(sourceId);
    if (!sourceId) return;

    setSourceLoading(true);
    try {
      const [posResult, questionsResult] = await Promise.all([
        supabase.from('hospital_positions').select('*').eq('id', sourceId).single(),
        supabase.from('position_questions').select('*').eq('position_id', sourceId).order('display_order', { ascending: true }),
      ]);

      if (posResult.error) throw posResult.error;

      const pos = posResult.data as HospitalPosition;
      setTitle(`${pos.title} (Copy)`);
      setDescription(pos.description || '');
      setRequirements(pos.requirements || '');
      setLocation(pos.location || '');
      setPositionType(pos.position_type);
      setHoursPerWeek(pos.hours_per_week?.toString() || '');
      setDuration(pos.duration || '');
      setStartDate(pos.start_date || '');
      setApplicationDeadline(pos.application_deadline || '');
      setSpotsAvailable(pos.spots_available?.toString() || '');
      setAskForAvailability(pos.ask_for_availability !== false);
      setMatchKeywords(pos.match_keywords || []);
      setPositionStatus('draft');

      const loadedQuestions: PositionQuestion[] = (questionsResult.data || []) as PositionQuestion[];
      setQuestions(
        loadedQuestions.map((q) => ({
          id: undefined, // strip id so these are inserted as new
          question_text: q.question_text,
          question_type: (q.question_type as string) === 'long_answer' ? 'short_answer' : q.question_type,
          is_required: q.is_required,
          options: (q.options as string[]) || [],
          display_order: q.display_order,
          char_limit: q.char_limit ?? null,
        }))
      );
    } catch (err) {
      toast.error('Failed to load position data');
      console.error(err);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) { toast.error('Position title is required'); return; }
    if (!description.trim()) { toast.error('Description is required'); return; }
    if (!pageId || pageId.startsWith('virtual-')) {
      toast.error('Hospital page not set up yet. Please refresh and try again.');
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

      const { data, error } = await supabase
        .from('hospital_positions')
        .insert(positionData)
        .select('id')
        .single();
      if (error) throw error;

      const newPositionId = data.id;

      for (const q of questions) {
        if (!q.question_text.trim()) continue;
        await supabase.from('position_questions').insert({
          position_id: newPositionId,
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          is_required: q.is_required,
          options: q.question_type === 'multiple_choice' ? q.options.filter(Boolean) : null,
          display_order: q.display_order,
          char_limit: q.question_type === 'short_answer' ? (q.char_limit ?? null) : null,
        });
      }

      toast.success(
        positionStatus === 'active'
          ? 'Position published!'
          : 'Position saved as draft'
      );
      navigate(`${basePath}/positions/${newPositionId}`);
    } catch (err: unknown) {
      console.error('Position save error:', err);
      toast.error((err as Error)?.message || 'Failed to save position');
    } finally {
      setSaving(false);
    }
  }, [
    title, description, pageId, positionStatus, requirements, location,
    positionType, hoursPerWeek, duration, startDate, applicationDeadline,
    spotsAvailable, askForAvailability, matchKeywords, questions, navigate, basePath,
  ]);

  return (
    <div className="max-w-6xl w-full space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${basePath}/positions`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">Copy an Existing Position</h2>
      </div>

      {/* Source position selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4" />
            Select a position to copy from
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positionsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No existing positions found. Create your first position instead.</p>
          ) : (
            <Select value={selectedSourceId} onValueChange={handleSourceSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a position to copy..." />
              </SelectTrigger>
              <SelectContent>
                {positions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.title}
                    <span className="ml-2 text-xs text-muted-foreground capitalize">({pos.status})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedSourceId && !sourceLoading && (
            <p className="text-xs text-muted-foreground mt-2">
              Form pre-filled from the selected position. Edit any fields below before saving.
            </p>
          )}
        </CardContent>
      </Card>

      {sourceLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!sourceLoading && (
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
          </TabsContent>

          <TabsContent value="questions" className="mt-0">
            <div className="space-y-6">
              <PositionQuestionsEditor questions={questions} onChange={setQuestions} />
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Save this position first to configure its scheduling questions.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!sourceLoading && (
        <div className="flex gap-3 justify-end pt-4">
          <div className="flex items-center gap-3">
            <div className="min-w-[170px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
              <Select value={positionStatus} onValueChange={(v) => setPositionStatus(v as PositionStatus)}>
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
            <Button onClick={() => void handleSave()} disabled={saving || !selectedSourceId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {positionStatus === 'active' ? 'Publish Position' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
