import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkPlus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { HospitalPosition, StudentApplication } from '@/types/positions';
import type { ApplicationFilterRule, FilterPreset } from '@/lib/applicationFilters';
import {
  ADD_FILTER_OPTIONS,
  AVAIL_DAY_OPTIONS,
  createDefaultRule,
  loadFilterPresets,
  newRuleId,
  saveFilterPresets,
} from '@/lib/applicationFilters';

interface Props {
  hospitalPageId: string | undefined;
  rules: ApplicationFilterRule[];
  onRulesChange: (rules: ApplicationFilterRule[]) => void;
  positions: HospitalPosition[];
  applications: StudentApplication[];
}

function updateRule(rules: ApplicationFilterRule[], id: string, patch: Partial<ApplicationFilterRule>): ApplicationFilterRule[] {
  return rules.map((r) => (r.id === id ? ({ ...r, ...patch } as ApplicationFilterRule) : r));
}

function removeRule(rules: ApplicationFilterRule[], id: string): ApplicationFilterRule[] {
  return rules.filter((r) => r.id !== id);
}

export default function ApplicationFilterBar({
  hospitalPageId,
  rules,
  onRulesChange,
  positions,
  applications,
}: Props) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadFilterPresets(hospitalPageId));

  useEffect(() => {
    setPresets(loadFilterPresets(hospitalPageId));
  }, [hospitalPageId]);

  const questionMeta = useMemo(() => {
    const map = new Map<string, { text: string; type: string }>();
    for (const app of applications) {
      for (const a of app.answers || []) {
        if (!a.question_id || !a.question) continue;
        if (!map.has(a.question_id)) {
          map.set(a.question_id, {
            text: a.question.question_text || 'Question',
            type: a.question.question_type || 'short_answer',
          });
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [applications]);

  const persistPresets = (next: FilterPreset[]) => {
    setPresets(next);
    saveFilterPresets(hospitalPageId, next);
  };

  const addField = (fieldId: string) => {
    const rule = createDefaultRule(fieldId);
    if (rule) onRulesChange([...rules, rule]);
  };

  const addQuestionKeyword = (questionId: string) => {
    const rule = createDefaultRule('question_keyword', questionId);
    if (rule) onRulesChange([...rules, rule]);
  };

  const addQuestionAnswer = (questionId: string) => {
    const rule = createDefaultRule('question_answer', questionId);
    if (rule) onRulesChange([...rules, rule]);
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name || rules.length === 0) return;
    const next = [...presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase()), { name, filters: rules }];
    persistPresets(next);
    setPresetName('');
    setPresetOpen(false);
  };

  const loadPreset = (p: FilterPreset) => {
    onRulesChange(p.filters.map((f) => ({ ...f, id: newRuleId() })));
  };

  const deletePreset = (name: string) => {
    persistPresets(presets.filter((p) => p.name !== name));
  };

  const renderRuleEditor = (r: ApplicationFilterRule) => {
    const onPatch = (patch: Partial<ApplicationFilterRule>) => onRulesChange(updateRule(rules, r.id, patch));

    switch (r.type) {
      case 'status':
        return (
          <Select value={r.value} onValueChange={(v) => onPatch({ type: 'status', value: v as typeof r.value })}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'position':
        return (
          <Select value={r.positionId || '__all__'} onValueChange={(v) => onPatch({ type: 'position', positionId: v === '__all__' ? '' : v })}>
            <SelectTrigger className="h-8 min-w-[180px] max-w-[220px] text-xs">
              <SelectValue placeholder="All positions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any position</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'gpa':
      case 'clinical_hours':
      case 'avail_hours':
      case 'grad_year':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={r.op} onValueChange={(v) => onPatch({ ...r, op: v as typeof r.op })}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gt">&gt;</SelectItem>
                <SelectItem value="gte">≥</SelectItem>
                <SelectItem value="eq">=</SelectItem>
                <SelectItem value="lte">≤</SelectItem>
                <SelectItem value="lt">&lt;</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              step={r.type === 'gpa' ? '0.01' : '1'}
              className="h-8 w-24 text-xs"
              value={r.value}
              onChange={(e) => onPatch({ ...r, value: parseFloat(e.target.value) || 0 })}
            />
          </div>
        );
      case 'university':
      case 'major':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={r.mode} onValueChange={(v) => onPatch({ ...r, mode: v as typeof r.mode })}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fuzzy">Contains</SelectItem>
                <SelectItem value="exact">Exact</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 min-w-[140px] max-w-[200px] text-xs"
              placeholder={r.type === 'university' ? 'University…' : 'Major…'}
              value={r.value}
              onChange={(e) => onPatch({ ...r, value: e.target.value })}
            />
          </div>
        );
      case 'prior_clinical':
      case 'research_experience':
        return (
          <Select
            value={r.value ? 'yes' : 'no'}
            onValueChange={(v) => onPatch({ ...r, value: v === 'yes' })}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'applicant_name':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={r.mode} onValueChange={(v) => onPatch({ ...r, mode: v as typeof r.mode })}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fuzzy">Contains</SelectItem>
                <SelectItem value="exact">Exact</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 min-w-[140px] max-w-[200px] text-xs"
              placeholder="Name…"
              value={r.value}
              onChange={(e) => onPatch({ ...r, value: e.target.value })}
            />
          </div>
        );
      case 'keyword_all':
        return (
          <Input
            className="h-8 min-w-[160px] max-w-[240px] text-xs"
            placeholder="Word or phrase…"
            value={r.value}
            onChange={(e) => onPatch({ ...r, value: e.target.value })}
          />
        );
      case 'question_keyword': {
        const label = questionMeta.find((q) => q.id === r.questionId)?.text || 'Question';
        return (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] text-muted-foreground truncate max-w-[240px]" title={label}>
              {label}
            </span>
            <Input
              className="h-8 w-full max-w-[240px] text-xs"
              placeholder="Keyword in answer…"
              value={r.value}
              onChange={(e) => onPatch({ ...r, value: e.target.value })}
            />
          </div>
        );
      }
      case 'question_answer': {
        const label = questionMeta.find((q) => q.id === r.questionId)?.text || 'Question';
        return (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] text-muted-foreground truncate max-w-[240px]" title={label}>
              {label}
            </span>
            <Input
              className="h-8 w-full max-w-[240px] text-xs"
              placeholder="Exact answer (e.g. Yes / option text)"
              value={r.value}
              onChange={(e) => onPatch({ ...r, value: e.target.value })}
            />
          </div>
        );
      }
      case 'avail_day':
        return (
          <Select value={r.dayId} onValueChange={(v) => onPatch({ type: 'avail_day', dayId: v })}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAIL_DAY_OPTIONS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  const ruleLabel = (r: ApplicationFilterRule): string => {
    switch (r.type) {
      case 'status':
        return 'Status';
      case 'position':
        return 'Position';
      case 'gpa':
        return 'GPA';
      case 'clinical_hours':
        return 'Clinical hours';
      case 'avail_hours':
        return 'Committed h/week';
      case 'grad_year':
        return 'Grad year';
      case 'university':
        return 'University';
      case 'major':
        return 'Major';
      case 'prior_clinical':
        return 'Prior clinical';
      case 'research_experience':
        return 'Research exp.';
      case 'applicant_name':
        return 'Applicant name';
      case 'keyword_all':
        return 'Keyword';
      case 'question_keyword':
        return `Q: ${questionMeta.find((q) => q.id === r.questionId)?.text?.slice(0, 24) || '…'} (text)`;
      case 'question_answer':
        return `Q: ${questionMeta.find((q) => q.id === r.questionId)?.text?.slice(0, 24) || '…'} (exact)`;
      case 'avail_day':
        return 'Available day';
      default:
        return 'Filter';
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters (all must match)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[min(70vh,420px)] overflow-y-auto">
              {(['Application', 'Profile', 'Availability', 'Search'] as const).map((group, gi) => (
                <div key={group}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">{group}</DropdownMenuLabel>
                  {ADD_FILTER_OPTIONS.filter((o) => o.group === group).map((o) => (
                    <DropdownMenuItem key={o.id} className="text-sm" onClick={() => addField(o.id)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
              {questionMeta.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Custom questions</DropdownMenuLabel>
                  {questionMeta.map((q) => (
                    <DropdownMenuSub key={q.id}>
                      <DropdownMenuSubTrigger className="text-sm truncate">{q.text}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => addQuestionKeyword(q.id)}>Keyword in answer</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addQuestionAnswer(q.id)}>Exact answer match</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <Bookmark className="h-3.5 w-3.5" />
                Presets
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setPresetOpen(true)} disabled={rules.length === 0}>
                <BookmarkPlus className="h-3.5 w-3.5 mr-2" />
                Save current as preset…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {presets.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">No saved presets</div>
              ) : (
                presets.map((p) => (
                  <DropdownMenuItem
                    key={p.name}
                    className="flex items-center gap-2 justify-between pr-1"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left text-sm py-0.5"
                      onClick={() => loadPreset(p)}
                    >
                      {p.name}
                    </button>
                    <span
                      role="button"
                      tabIndex={0}
                      className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deletePreset(p.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          deletePreset(p.name);
                        }
                      }}
                      title="Remove preset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {rules.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onRulesChange([])}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">No filters — showing all applicants. Add filters to narrow the list.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
            >
              <span className="text-xs font-medium text-muted-foreground shrink-0 pt-1.5 w-[120px] sm:w-[140px]">
                {ruleLabel(r)}
              </span>
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">{renderRuleEditor(r)}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => onRulesChange(removeRule(rules, r.id))}
                aria-label="Remove filter"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name">Name</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Strong candidates, Tuesdays"
            />
            <p className="text-xs text-muted-foreground">{rules.length} filter rule(s) will be saved.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePreset} disabled={!presetName.trim() || rules.length === 0}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
