export type CohortFilter = {
  needs_attention?: boolean;
  onboarding_complete?: boolean;
  is_premium?: boolean;
  university_contains?: string;
  graduation_year?: number;
  application_count_min?: number;
  application_count_max?: number;
  pending_applications_min?: number;
  saved_count_min?: number;
  applied?: boolean;
  last_active_within_days?: number;
  inactive_days_min?: number;
  last_application_stale_days?: number;
  state_in?: string[];
};

export interface CohortRow {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  joined_at: string;
  last_active_at: string | null;
  application_count: number;
  pending_applications: number;
  attention_level: string;
  needs_attention: boolean;
  saved_count: number;
  state: string | null;
  is_premium: boolean;
}

export interface AnalyticsCohort {
  id: string;
  name: string;
  description: string | null;
  filter_json: CohortFilter;
  is_template: boolean;
  created_at: string;
}

export const COHORT_FILTER_LABELS: Record<keyof CohortFilter, string> = {
  needs_attention: 'Needs attention',
  onboarding_complete: 'Onboarding complete',
  is_premium: 'Premium user',
  university_contains: 'University contains',
  graduation_year: 'Graduation year',
  application_count_min: 'Min applications',
  application_count_max: 'Max applications',
  pending_applications_min: 'Min pending applications',
  saved_count_min: 'Min saved opportunities',
  applied: 'Has applied',
  last_active_within_days: 'Active within days',
  inactive_days_min: 'Inactive for days',
  last_application_stale_days: 'Stale pending app days',
  state_in: 'States',
};

export function emptyCohortFilter(): CohortFilter {
  return {};
}

export function cohortFilterToDisplay(filter: CohortFilter): string {
  return Object.entries(filter)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${COHORT_FILTER_LABELS[k as keyof CohortFilter] ?? k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ');
}
