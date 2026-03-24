import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkPlus, Pin, PinOff, Plus, Search, Trash2, X } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { HospitalPosition, PositionQuestion, StudentApplication } from '@/types/positions';
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
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [addFilterQuery, setAddFilterQuery] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadFilterPresets(hospitalPageId));
  const [pinnedFilterIds, setPinnedFilterIds] = useState<string[]>([]);
  const [recentFilterIds, setRecentFilterIds] = useState<string[]>([]);
  const [customQuestions, setCustomQuestions] = useState<
    Array<Pick<PositionQuestion, 'id' | 'position_id' | 'question_text' | 'question_type' | 'display_order'>>
  >([]);

  useEffect(() => {
    setPresets(loadFilterPresets(hospitalPageId));
  }, [hospitalPageId]);

  useEffect(() => {
    if (!hospitalPageId || typeof localStorage === 'undefined') {
      setPinnedFilterIds([]);
      return;
    }
    try {
      const raw = localStorage.getItem(`ch_pinned_filter_options_${hospitalPageId}`);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setPinnedFilterIds(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
    } catch {
      setPinnedFilterIds([]);
    }
  }, [hospitalPageId]);

  useEffect(() => {
    if (!hospitalPageId || typeof localStorage === 'undefined') {
      setRecentFilterIds([]);
      return;
    }
    try {
      const raw = localStorage.getItem(`ch_recent_filter_options_${hospitalPageId}`);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setRecentFilterIds(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
    } catch {
      setRecentFilterIds([]);
    }
  }, [hospitalPageId]);

  const persistPinnedFilterIds = (next: string[]) => {
    setPinnedFilterIds(next);
    if (!hospitalPageId || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`ch_pinned_filter_options_${hospitalPageId}`, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const togglePinnedFilter = (id: string) => {
    if (pinnedFilterIds.includes(id)) {
      persistPinnedFilterIds(pinnedFilterIds.filter((x) => x !== id));
      return;
    }
    const next = [id, ...pinnedFilterIds].slice(0, 12);
    persistPinnedFilterIds(next);
  };

  const isPinnedFilter = (id: string) => pinnedFilterIds.includes(id);

  const persistRecentFilterIds = (next: string[]) => {
    setRecentFilterIds(next);
    if (!hospitalPageId || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`ch_recent_filter_options_${hospitalPageId}`, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const pushRecentFilter = (id: string) => {
    const next = [id, ...recentFilterIds.filter((x) => x !== id)].slice(0, 10);
    persistRecentFilterIds(next);
  };

  useEffect(() => {
    const positionIds = positions.map((p) => p.id).filter(Boolean);
    if (positionIds.length === 0) {
      setCustomQuestions([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('position_questions')
        .select('id, position_id, question_text, question_type, display_order')
        .in('position_id', positionIds)
        .order('position_id', { ascending: true })
        .order('display_order', { ascending: true });

      if (cancelled || error) return;
      setCustomQuestions((data || []) as Array<Pick<PositionQuestion, 'id' | 'position_id' | 'question_text' | 'question_type' | 'display_order'>>);
    })();

    return () => {
      cancelled = true;
    };
  }, [positions]);

  const questionMeta = useMemo(() => {
    const map = new Map<string, { text: string; type: string; positionId?: string }>();
    for (const q of customQuestions) {
      if (!q.id || !q.question_text) continue;
      map.set(q.id, {
        text: q.question_text || 'Question',
        type: q.question_type || 'short_answer',
        positionId: q.position_id,
      });
    }
    for (const app of applications) {
      for (const a of app.answers || []) {
        if (!a.question_id || !a.question) continue;
        if (!map.has(a.question_id)) {
          map.set(a.question_id, {
            text: a.question.question_text || 'Question',
            type: a.question.question_type || 'short_answer',
            positionId: app.position_id,
          });
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [applications, customQuestions]);

  const positionNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of positions) m.set(p.id, p.title);
    return m;
  }, [positions]);

  const normalizedFilterQuery = addFilterQuery.trim().toLowerCase();

  const visibleBaseOptions = useMemo(() => {
    if (!normalizedFilterQuery) return ADD_FILTER_OPTIONS;
    return ADD_FILTER_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(normalizedFilterQuery) ||
        opt.group.toLowerCase().includes(normalizedFilterQuery),
    );
  }, [normalizedFilterQuery]);

  const visibleQuestions = useMemo(() => {
    if (!normalizedFilterQuery) return questionMeta;
    return questionMeta.filter((q) => {
      const positionName = q.positionId ? positionNameById.get(q.positionId) || '' : '';
      return (
        q.text.toLowerCase().includes(normalizedFilterQuery) ||
        positionName.toLowerCase().includes(normalizedFilterQuery) ||
        'custom question'.includes(normalizedFilterQuery)
      );
    });
  }, [normalizedFilterQuery, questionMeta, positionNameById]);

  const persistPresets = (next: FilterPreset[]) => {
    setPresets(next);
    saveFilterPresets(hospitalPageId, next);
  };

  const addField = (fieldId: string) => {
    const rule = createDefaultRule(fieldId);
    if (rule) {
      onRulesChange([...rules, rule]);
      pushRecentFilter(fieldId);
    }
    setAddFilterOpen(false);
    setAddFilterQuery('');
  };

  const addQuestionKeyword = (questionId: string) => {
    const rule = createDefaultRule('question_keyword', questionId);
    if (rule) {
      onRulesChange([...rules, rule]);
      pushRecentFilter(`qkw:${questionId}`);
    }
    setAddFilterOpen(false);
    setAddFilterQuery('');
  };

  const addQuestionAnswer = (questionId: string) => {
    const rule = createDefaultRule('question_answer', questionId);
    if (rule) {
      onRulesChange([...rules, rule]);
      pushRecentFilter(`qans:${questionId}`);
    }
    setAddFilterOpen(false);
    setAddFilterQuery('');
  };

  const recentFilterOptions = useMemo(() => {
    const options: Array<
      | { id: string; label: string; kind: 'base' }
      | { id: string; label: string; questionId: string; mode: 'keyword' | 'exact'; kind: 'question' }
    > = [];
    for (const id of recentFilterIds) {
      if (id.startsWith('qkw:')) {
        const questionId = id.slice(4);
        const q = questionMeta.find((x) => x.id === questionId);
        if (!q) continue;
        options.push({
          id,
          questionId,
          mode: 'keyword',
          kind: 'question',
          label: `${q.text} · keyword in answer`,
        });
        continue;
      }
      if (id.startsWith('qans:')) {
        const questionId = id.slice(5);
        const q = questionMeta.find((x) => x.id === questionId);
        if (!q) continue;
        options.push({
          id,
          questionId,
          mode: 'exact',
          kind: 'question',
          label: `${q.text} · exact answer match`,
        });
        continue;
      }
      const base = ADD_FILTER_OPTIONS.find((x) => x.id === id);
      if (!base) continue;
      options.push({ id, label: base.label, kind: 'base' });
    }
    return options;
  }, [recentFilterIds, questionMeta]);

  const pinnedFilterOptions = useMemo(() => {
    const options: Array<
      | { id: string; label: string; kind: 'base' }
      | { id: string; label: string; questionId: string; mode: 'keyword' | 'exact'; kind: 'question' }
    > = [];
    for (const id of pinnedFilterIds) {
      if (id.startsWith('qkw:')) {
        const questionId = id.slice(4);
        const q = questionMeta.find((x) => x.id === questionId);
        if (!q) continue;
        options.push({
          id,
          questionId,
          mode: 'keyword',
          kind: 'question',
          label: `${q.text} · keyword in answer`,
        });
        continue;
      }
      if (id.startsWith('qans:')) {
        const questionId = id.slice(5);
        const q = questionMeta.find((x) => x.id === questionId);
        if (!q) continue;
        options.push({
          id,
          questionId,
          mode: 'exact',
          kind: 'question',
          label: `${q.text} · exact answer match`,
        });
        continue;
      }
      const base = ADD_FILTER_OPTIONS.find((x) => x.id === id);
      if (!base) continue;
      options.push({ id, label: base.label, kind: 'base' });
    }
    return options;
  }, [pinnedFilterIds, questionMeta]);

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
            <span className="line-clamp-2 min-w-0 max-w-[240px] break-words text-[10px] text-muted-foreground" title={label}>
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
            <span className="line-clamp-2 min-w-0 max-w-[240px] break-words text-[10px] text-muted-foreground" title={label}>
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
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setAddFilterOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </Button>

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
              className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 sm:flex-row sm:items-start sm:gap-2"
            >
              <span className="w-full shrink-0 pt-0.5 text-xs font-medium text-muted-foreground sm:w-[140px] sm:pt-1.5 break-words">
                {ruleLabel(r)}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{renderRuleEditor(r)}</div>
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

      <Dialog
        open={addFilterOpen}
        onOpenChange={(open) => {
          setAddFilterOpen(open);
          if (!open) setAddFilterQuery('');
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add filter</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={addFilterQuery}
              onChange={(e) => setAddFilterQuery(e.target.value)}
              className="pl-9"
              placeholder="Search filter fields or custom questions..."
            />
          </div>

          <ScrollArea className="max-h-[min(62vh,560px)] pr-3">
            <div className="space-y-4">
              {pinnedFilterOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pinned
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {pinnedFilterOptions.map((opt) => (
                      <div key={opt.id} className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="justify-start h-9 text-sm flex-1 min-w-0"
                          onClick={() =>
                            opt.kind === 'base'
                              ? addField(opt.id)
                              : opt.mode === 'keyword'
                                ? addQuestionKeyword(opt.questionId)
                                : addQuestionAnswer(opt.questionId)
                          }
                        >
                          <span className="line-clamp-2 min-w-0 break-words text-left">{opt.label}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => togglePinnedFilter(opt.id)}
                          title="Unpin filter"
                          aria-label="Unpin filter"
                        >
                          <PinOff className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recentFilterOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recently used
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {recentFilterOptions.map((opt) => (
                      <div key={opt.id} className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="justify-start h-9 text-sm flex-1 min-w-0"
                          onClick={() =>
                            opt.kind === 'base'
                              ? addField(opt.id)
                              : opt.mode === 'keyword'
                                ? addQuestionKeyword(opt.questionId)
                                : addQuestionAnswer(opt.questionId)
                          }
                        >
                          <span className="line-clamp-2 min-w-0 break-words text-left">{opt.label}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => togglePinnedFilter(opt.id)}
                          title={isPinnedFilter(opt.id) ? 'Unpin filter' : 'Pin filter'}
                          aria-label={isPinnedFilter(opt.id) ? 'Unpin filter' : 'Pin filter'}
                        >
                          {isPinnedFilter(opt.id) ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(['Application', 'Profile', 'Availability', 'Search'] as const).map((group) => {
                const options = visibleBaseOptions.filter((o) => o.group === group);
                if (options.length === 0) return null;
                return (
                  <div key={group} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options.map((o) => (
                        <div key={o.id} className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="justify-start h-9 text-sm flex-1 min-w-0"
                            onClick={() => addField(o.id)}
                          >
                            <span className="line-clamp-2 min-w-0 break-words text-left">{o.label}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => togglePinnedFilter(o.id)}
                            title={isPinnedFilter(o.id) ? 'Unpin filter' : 'Pin filter'}
                            aria-label={isPinnedFilter(o.id) ? 'Unpin filter' : 'Pin filter'}
                          >
                            {isPinnedFilter(o.id) ? (
                              <PinOff className="h-4 w-4" />
                            ) : (
                              <Pin className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom questions
                </p>
                {visibleQuestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No custom questions found for this search.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleQuestions.map((q) => {
                      const positionName = q.positionId ? positionNameById.get(q.positionId) : undefined;
                      return (
                        <div key={q.id} className="rounded-md border border-border/50 p-2">
                          <p className="text-sm font-medium leading-snug">{q.text}</p>
                          {positionName ? (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{positionName}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => addQuestionKeyword(q.id)}
                              >
                                Keyword in answer
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => togglePinnedFilter(`qkw:${q.id}`)}
                                title={isPinnedFilter(`qkw:${q.id}`) ? 'Unpin filter' : 'Pin filter'}
                                aria-label={isPinnedFilter(`qkw:${q.id}`) ? 'Unpin filter' : 'Pin filter'}
                              >
                                {isPinnedFilter(`qkw:${q.id}`) ? (
                                  <PinOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => addQuestionAnswer(q.id)}
                              >
                                Exact answer match
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => togglePinnedFilter(`qans:${q.id}`)}
                                title={isPinnedFilter(`qans:${q.id}`) ? 'Unpin filter' : 'Pin filter'}
                                aria-label={isPinnedFilter(`qans:${q.id}`) ? 'Unpin filter' : 'Pin filter'}
                              >
                                {isPinnedFilter(`qans:${q.id}`) ? (
                                  <PinOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
