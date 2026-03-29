import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Settings2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { ClinicMember, OnboardingStep, OnboardingProgress, OnboardingStatus } from './types';
import { ONBOARDING_STATUS_COLORS, MEMBER_STATUS_COLORS, MEMBER_STATUS_LABELS } from './types';
import { useOnboardingSteps, useOnboardingProgress } from './hooks';

const STATUS_ICONS: Record<OnboardingStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  in_progress: Clock,
  not_started: Circle,
};

interface OnboardingTrackerProps {
  clinicId: string;
  members: ClinicMember[];
  onRefreshMembers: () => void;
}

export default function OnboardingTracker({ clinicId, members, onRefreshMembers }: OnboardingTrackerProps) {
  const { steps, loading: stepsLoading, refetch: refetchSteps, seedDefaults } = useOnboardingSteps(clinicId);
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const { progress, loading: progressLoading, refetch: refetchProgress } = useOnboardingProgress(memberIds);

  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [editingSteps, setEditingSteps] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'new_applicant' | 'existing_staff'>('all');

  const progressMap = useMemo(() => {
    const map = new Map<string, OnboardingProgress>();
    progress.forEach((p) => map.set(`${p.member_id}:${p.step_id}`, p));
    return map;
  }, [progress]);

  const filteredMembers = useMemo(() => {
    if (filterSource === 'all') return members;
    return members.filter((m) => m.onboarding_source === filterSource);
  }, [members, filterSource]);

  const toggleExpand = (id: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getProgressForMember = useCallback(
    (memberId: string) => {
      return steps.map((step) => {
        const key = `${memberId}:${step.id}`;
        return {
          step,
          progress: progressMap.get(key) || null,
        };
      });
    },
    [steps, progressMap],
  );

  const getMemberCompletion = useCallback(
    (memberId: string) => {
      if (steps.length === 0) return { completed: 0, total: 0, pct: 0 };
      let completed = 0;
      steps.forEach((s) => {
        const p = progressMap.get(`${memberId}:${s.id}`);
        if (p?.status === 'completed') completed++;
      });
      return { completed, total: steps.length, pct: Math.round((completed / steps.length) * 100) };
    },
    [steps, progressMap],
  );

  const updateStepStatus = async (memberId: string, stepId: string, status: OnboardingStatus) => {
    const key = `${memberId}:${stepId}`;
    const existing = progressMap.get(key);

    if (existing) {
      await supabase
        .from('onboarding_progress')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('onboarding_progress').insert({
        member_id: memberId,
        step_id: stepId,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      });
    }
    refetchProgress();
  };

  const updateStepNotes = async (memberId: string, stepId: string, notes: string) => {
    const key = `${memberId}:${stepId}`;
    const existing = progressMap.get(key);

    if (existing) {
      await supabase.from('onboarding_progress').update({ notes: notes || null }).eq('id', existing.id);
    } else {
      await supabase.from('onboarding_progress').insert({
        member_id: memberId,
        step_id: stepId,
        status: 'not_started',
        notes: notes || null,
      });
    }
    refetchProgress();
  };

  const addStep = async () => {
    if (!newStepName.trim()) return;
    const { error } = await supabase.from('onboarding_steps').insert({
      clinic_id: clinicId,
      step_name: newStepName.trim(),
      sort_order: steps.length,
    });
    if (error) {
      toast.error('Failed to add step');
    } else {
      setNewStepName('');
      refetchSteps();
    }
  };

  const removeStep = async (stepId: string) => {
    if (!confirm('Delete this onboarding step? Progress data for this step will be lost.')) return;
    await supabase.from('onboarding_steps').delete().eq('id', stepId);
    refetchSteps();
    refetchProgress();
  };

  const loading = stepsLoading || progressLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Select value={filterSource} onValueChange={(v) => setFilterSource(v as typeof filterSource)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="new_applicant">New Applicants</SelectItem>
              <SelectItem value="existing_staff">Existing Staff</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditingSteps(!editingSteps)}
          className="gap-1.5 text-xs"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {editingSteps ? 'Done' : 'Manage Steps'}
        </Button>
      </div>

      {/* Step Editor */}
      {editingSteps && (
        <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Onboarding Steps</p>
          {steps.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">No steps defined.</p>
              <Button variant="outline" size="sm" onClick={seedDefaults}>Load Default Steps</Button>
            </div>
          )}
          {steps.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground/50 text-xs w-5 text-right">{s.sort_order + 1}.</span>
              <span className="flex-1">{s.step_name}</span>
              {s.description && <span className="text-xs text-muted-foreground truncate max-w-40">{s.description}</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(s.id)}>
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newStepName}
              onChange={(e) => setNewStepName(e.target.value)}
              placeholder="Add a new step..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
            />
            <Button size="sm" variant="outline" onClick={addStep} className="h-8 gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Members with checklists */}
      {steps.length === 0 && !editingSteps ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Settings2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">Set up onboarding steps first.</p>
          <Button variant="outline" size="sm" onClick={() => { setEditingSteps(true); seedDefaults(); }}>
            Load Default Steps
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => {
            const isExpanded = expandedMembers.has(member.id);
            const { completed, total, pct } = getMemberCompletion(member.id);
            const memberSteps = getProgressForMember(member.id);

            return (
              <div key={member.id} className="rounded-lg border border-border overflow-hidden">
                {/* Member header */}
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/10 transition-colors text-left"
                  onClick={() => toggleExpand(member.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{member.full_name}</span>
                      <Badge variant="outline" className={`text-[10px] ${MEMBER_STATUS_COLORS[member.status]}`}>
                        {MEMBER_STATUS_LABELS[member.status]}
                      </Badge>
                      {member.onboarding_source === 'existing_staff' && (
                        <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                          Existing Staff
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-yellow-500' : 'bg-muted-foreground/20'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                      {completed}/{total}
                    </span>
                  </div>
                </button>

                {/* Expanded checklist */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/5 divide-y divide-border/30">
                    {memberSteps.map(({ step, progress: p }) => {
                      const status: OnboardingStatus = p?.status || 'not_started';
                      const Icon = STATUS_ICONS[status];
                      return (
                        <OnboardingStepRow
                          key={step.id}
                          step={step}
                          status={status}
                          notes={p?.notes || ''}
                          onStatusChange={(s) => updateStepStatus(member.id, step.id, s)}
                          onNotesChange={(n) => updateStepNotes(member.id, step.id, n)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Individual step row ────────────────────────────────────────

function OnboardingStepRow({
  step,
  status,
  notes: initialNotes,
  onStatusChange,
  onNotesChange,
}: {
  step: OnboardingStep;
  status: OnboardingStatus;
  notes: string;
  onStatusChange: (s: OnboardingStatus) => void;
  onNotesChange: (n: string) => void;
}) {
  const [localNotes, setLocalNotes] = useState(initialNotes);
  const [notesDirty, setNotesDirty] = useState(false);
  const Icon = STATUS_ICONS[status];

  useEffect(() => {
    setLocalNotes(initialNotes);
    setNotesDirty(false);
  }, [initialNotes]);

  const cycleStatus = () => {
    const order: OnboardingStatus[] = ['not_started', 'in_progress', 'completed'];
    const next = order[(order.indexOf(status) + 1) % order.length];
    onStatusChange(next);
  };

  const saveNotes = () => {
    onNotesChange(localNotes);
    setNotesDirty(false);
    toast.success('Notes saved');
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* Status toggle */}
      <button
        onClick={cycleStatus}
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full shrink-0 transition-colors ${ONBOARDING_STATUS_COLORS[status]}`}
        title={`Status: ${status.replace('_', ' ')} — click to cycle`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${status === 'completed' ? 'line-through text-muted-foreground' : 'font-medium'}`}>
            {step.step_name}
          </span>
          {step.description && (
            <span className="text-xs text-muted-foreground/60 truncate hidden sm:inline">{step.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={localNotes}
            onChange={(e) => { setLocalNotes(e.target.value); setNotesDirty(true); }}
            placeholder="Add notes..."
            className="h-7 text-xs flex-1 bg-transparent border-border/30"
            onKeyDown={(e) => e.key === 'Enter' && saveNotes()}
          />
          {notesDirty && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={saveNotes}>
              <Save className="h-3 w-3 text-primary" />
            </Button>
          )}
        </div>
      </div>

      {/* Status selector */}
      <Select value={status} onValueChange={(v) => onStatusChange(v as OnboardingStatus)}>
        <SelectTrigger className="h-7 w-28 text-[11px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
