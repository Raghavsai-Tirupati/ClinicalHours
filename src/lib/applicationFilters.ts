import type { ApplicationStatus, StudentApplication } from '@/types/positions';

export type NumericOp = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
export type TextMatchMode = 'exact' | 'fuzzy';

/** Single filter rule (combined with AND). */
export type ApplicationFilterRule =
  | { id: string; type: 'status'; value: ApplicationStatus }
  | { id: string; type: 'position'; positionId: string }
  | { id: string; type: 'gpa'; op: NumericOp; value: number }
  | { id: string; type: 'clinical_hours'; op: NumericOp; value: number }
  | { id: string; type: 'avail_hours'; op: NumericOp; value: number }
  | { id: string; type: 'grad_year'; op: NumericOp; value: number }
  | { id: string; type: 'university'; mode: TextMatchMode; value: string }
  | { id: string; type: 'major'; mode: TextMatchMode; value: string }
  | { id: string; type: 'prior_clinical'; value: boolean }
  | { id: string; type: 'applicant_name'; mode: TextMatchMode; value: string }
  | { id: string; type: 'keyword_all'; value: string }
  | { id: string; type: 'question_keyword'; questionId: string; value: string }
  | { id: string; type: 'question_answer'; questionId: string; value: string }
  | { id: string; type: 'avail_day'; dayId: string };

export interface FilterPreset {
  name: string;
  filters: ApplicationFilterRule[];
}

export type SortColumn =
  | 'submitted'
  | 'name'
  | 'position'
  | 'status'
  | 'gpa'
  | 'clinical_hours'
  | 'grad_year'
  | 'university';

export interface SortState {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
}

export function getApplicantSortName(app: StudentApplication): string {
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.applicant_email?.split('@')[0] ||
    app.student_profile?.email?.split('@')[0] ||
    `student_${app.student_id.slice(0, 8)}`
  );
}

function compareNumericOp(actual: number, op: NumericOp, value: number): boolean {
  switch (op) {
    case 'gt':
      return actual > value;
    case 'lt':
      return actual < value;
    case 'eq':
      return Math.abs(actual - value) < 1e-6;
    case 'gte':
      return actual >= value;
    case 'lte':
      return actual <= value;
    default:
      return false;
  }
}

function textMatches(haystack: string | null | undefined, mode: TextMatchMode, needle: string): boolean {
  if (!needle.trim()) return true;
  const h = (haystack || '').trim();
  const n = needle.trim();
  if (!h) return false;
  if (mode === 'exact') return h.toLowerCase() === n.toLowerCase();
  return h.toLowerCase().includes(n.toLowerCase());
}

function collectAnswerTexts(app: StudentApplication): string {
  const parts: string[] = [];
  for (const a of app.answers || []) {
    if (a.answer_text?.trim()) parts.push(a.answer_text);
    if (a.answer_options?.length) parts.push(a.answer_options.join(' '));
  }
  return parts.join('\n').toLowerCase();
}

function answerForQuestion(app: StudentApplication, questionId: string) {
  return app.answers?.find((x) => x.question_id === questionId);
}

export function applicationMatchesRule(app: StudentApplication, rule: ApplicationFilterRule): boolean {
  const p = app.student_profile;
  switch (rule.type) {
    case 'status':
      return app.status === rule.value;
    case 'position':
      if (!rule.positionId.trim()) return true;
      return app.position_id === rule.positionId;
    case 'gpa': {
      const g = p?.gpa;
      if (g == null || typeof g !== 'number') return false;
      return compareNumericOp(g, rule.op, rule.value);
    }
    case 'clinical_hours': {
      const h = p?.clinical_hours;
      if (h == null || typeof h !== 'number') return false;
      return compareNumericOp(h, rule.op, rule.value);
    }
    case 'avail_hours': {
      const h = app.availability_json?.hours_per_week;
      if (h == null || typeof h !== 'number') return false;
      return compareNumericOp(h, rule.op, rule.value);
    }
    case 'grad_year': {
      const y = p?.graduation_year;
      if (y == null || typeof y !== 'number') return false;
      return compareNumericOp(y, rule.op, rule.value);
    }
    case 'university':
      return textMatches(p?.university ?? null, rule.mode, rule.value);
    case 'major':
      return textMatches(p?.major ?? null, rule.mode, rule.value);
    case 'prior_clinical': {
      const h = p?.clinical_hours;
      const has = h != null && typeof h === 'number' && h > 0;
      return rule.value ? has : !has;
    }
    case 'applicant_name':
      return textMatches(getApplicantSortName(app), rule.mode, rule.value);
    case 'keyword_all': {
      const q = rule.value.trim().toLowerCase();
      if (!q) return true;
      const blob = [
        getApplicantSortName(app),
        app.applicant_email,
        p?.email,
        p?.university,
        p?.major,
        p?.research_experience,
        collectAnswerTexts(app),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    }
    case 'question_keyword': {
      const q = rule.value.trim().toLowerCase();
      if (!q) return true;
      const ans = answerForQuestion(app, rule.questionId);
      if (!ans) return false;
      const t = (ans.answer_text || '').toLowerCase();
      const o = (ans.answer_options || []).join(' ').toLowerCase();
      return t.includes(q) || o.includes(q);
    }
    case 'question_answer': {
      const ans = answerForQuestion(app, rule.questionId);
      if (!ans) return false;
      const want = rule.value.trim().toLowerCase();
      if (!want) return true;
      if (ans.answer_options?.length) {
        return ans.answer_options.some((o) => o.trim().toLowerCase() === want);
      }
      return (ans.answer_text || '').trim().toLowerCase() === want;
    }
    case 'avail_day': {
      const days = app.availability_json?.days || [];
      return days.includes(rule.dayId);
    }
    default:
      return true;
  }
}

export function applyApplicationFilters(
  applications: StudentApplication[],
  rules: ApplicationFilterRule[],
): StudentApplication[] {
  if (!rules.length) return applications;
  return applications.filter((app) => rules.every((r) => applicationMatchesRule(app, r)));
}

export function sortApplications(
  applications: StudentApplication[],
  sort: SortState | null,
): StudentApplication[] {
  const list = [...applications];
  const col = sort?.column ?? 'submitted';
  const dir = sort?.direction ?? 'desc';
  const mult = dir === 'asc' ? 1 : -1;

  const val = (app: StudentApplication): string | number => {
    switch (col) {
      case 'name':
        return getApplicantSortName(app).toLowerCase();
      case 'position':
        return (app.position?.title || '').toLowerCase();
      case 'status':
        return app.status;
      case 'gpa':
        return app.student_profile?.gpa ?? (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      case 'clinical_hours':
        return app.student_profile?.clinical_hours ?? (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      case 'grad_year':
        return app.student_profile?.graduation_year ?? (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      case 'university':
        return (app.student_profile?.university || '').toLowerCase();
      case 'submitted':
      default:
        return new Date(app.submitted_at).getTime();
    }
  };

  list.sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (typeof va === 'number' && typeof vb === 'number') {
      return mult * (va - vb);
    }
    const sa = String(va);
    const sb = String(vb);
    return mult * sa.localeCompare(sb, undefined, { sensitivity: 'base' });
  });

  return list;
}

export function presetsStorageKey(hospitalPageId: string): string {
  return `ch_application_filter_presets_${hospitalPageId}`;
}

export function loadFilterPresets(hospitalPageId: string | undefined): FilterPreset[] {
  if (!hospitalPageId || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(presetsStorageKey(hospitalPageId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FilterPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFilterPresets(hospitalPageId: string | undefined, presets: FilterPreset[]): void {
  if (!hospitalPageId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(presetsStorageKey(hospitalPageId), JSON.stringify(presets));
  } catch {
    /* ignore quota */
  }
}

/** Add-filter field definitions (ids used when creating a new rule). */
export const ADD_FILTER_OPTIONS: { id: string; label: string; group: string }[] = [
  { id: 'status', label: 'Application status', group: 'Application' },
  { id: 'position', label: 'Position', group: 'Application' },
  { id: 'gpa', label: 'GPA', group: 'Profile' },
  { id: 'clinical_hours', label: 'Clinical hours (profile)', group: 'Profile' },
  { id: 'prior_clinical', label: 'Prior clinical hours (yes/no)', group: 'Profile' },
  { id: 'grad_year', label: 'Graduation year', group: 'Profile' },
  { id: 'university', label: 'University', group: 'Profile' },
  { id: 'major', label: 'Major', group: 'Profile' },
  { id: 'avail_hours', label: 'Committed hours / week', group: 'Availability' },
  { id: 'avail_day', label: 'Available on weekday', group: 'Availability' },
  { id: 'applicant_name', label: 'Applicant name', group: 'Search' },
  { id: 'keyword_all', label: 'Keyword (any text answer or profile)', group: 'Search' },
];

export const AVAIL_DAY_OPTIONS = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
];

export function newRuleId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultRule(fieldId: string, questionId?: string): ApplicationFilterRule | null {
  const id = newRuleId();
  switch (fieldId) {
    case 'status':
      return { id, type: 'status', value: 'new' };
    case 'position':
      return { id, type: 'position', positionId: '' };
    case 'gpa':
      return { id, type: 'gpa', op: 'gte', value: 3.5 };
    case 'clinical_hours':
      return { id, type: 'clinical_hours', op: 'gte', value: 50 };
    case 'prior_clinical':
      return { id, type: 'prior_clinical', value: true };
    case 'grad_year':
      return { id, type: 'grad_year', op: 'eq', value: new Date().getFullYear() + 1 };
    case 'university':
      return { id, type: 'university', mode: 'fuzzy', value: '' };
    case 'major':
      return { id, type: 'major', mode: 'fuzzy', value: '' };
    case 'avail_hours':
      return { id, type: 'avail_hours', op: 'gte', value: 8 };
    case 'avail_day':
      return { id, type: 'avail_day', dayId: 'tue' };
    case 'applicant_name':
      return { id, type: 'applicant_name', mode: 'fuzzy', value: '' };
    case 'keyword_all':
      return { id, type: 'keyword_all', value: '' };
    case 'question_keyword':
      if (!questionId) return null;
      return { id, type: 'question_keyword', questionId, value: '' };
    case 'question_answer':
      if (!questionId) return null;
      return { id, type: 'question_answer', questionId, value: '' };
    default:
      if (fieldId.startsWith('qkw:')) {
        const qid = fieldId.slice(4);
        return { id, type: 'question_keyword', questionId: qid, value: '' };
      }
      if (fieldId.startsWith('qans:')) {
        const qid = fieldId.slice(5);
        return { id, type: 'question_answer', questionId: qid, value: '' };
      }
      return null;
  }
}
