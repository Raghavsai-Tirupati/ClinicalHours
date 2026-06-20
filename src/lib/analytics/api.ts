import { supabase } from '@/integrations/supabase/client';

export interface AdminDashboardKPIs {
  total_students: number;
  active_students_week: number;
  new_students_month: number;
  pending_applications: number;
  upcoming_interviews: number;
  evaluations_completed: number;
  avg_evaluation_score: number | null;
  students_needing_attention: number;
  logins_in_range: number;
  applications_in_range: number;
  signups_in_range: number;
}

export interface AdminStudentSummary {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  phone: string | null;
  joined_at: string;
  onboarding_complete: boolean;
  last_login_at: string | null;
  last_active_at: string | null;
  login_count: number;
  application_count: number;
  pending_applications: number;
  accepted_applications: number;
  upcoming_interviews: number;
  last_application_at: string | null;
  clinic_names: string | null;
  clinic_count: number;
  volunteer_hours: number;
  avg_evaluation_score: number | null;
  evaluation_count: number;
  attention_level: 'green' | 'yellow' | 'red' | 'gray';
  needs_attention: boolean;
}

export interface UnifiedActivityRow {
  id: string;
  user_id: string | null;
  created_at: string;
  event_type: string;
  actor_type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  clinic_id: string | null;
  source: string;
}

export interface TimeSeriesPoint {
  bucket: string;
  value: number;
}

export type TimeSeriesMetric =
  | 'new_users'
  | 'active_users'
  | 'logins'
  | 'applications'
  | 'evaluations'
  | 'avg_evaluation_score';

export interface ClinicOption {
  id: string;
  name: string;
}

export async function fetchAdminKPIs(
  since: Date,
  until: Date,
  clinicId?: string | null
): Promise<AdminDashboardKPIs> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_kpis', {
    p_since: since.toISOString(),
    p_until: until.toISOString(),
    p_clinic_id: clinicId ?? null,
  });

  if (error) throw new Error(error.message);
  return data as AdminDashboardKPIs;
}

export async function fetchAdminTimeSeries(
  metric: TimeSeriesMetric,
  since: Date,
  until: Date,
  granularity: 'day' | 'week' | 'month',
  clinicId?: string | null
): Promise<TimeSeriesPoint[]> {
  const { data, error } = await supabase.rpc('get_admin_time_series', {
    p_metric: metric,
    p_since: since.toISOString(),
    p_until: until.toISOString(),
    p_granularity: granularity,
    p_clinic_id: clinicId ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { bucket: string; value: number }) => ({
    bucket: row.bucket,
    value: Number(row.value ?? 0),
  }));
}

export async function fetchAdminStudentSummaries(): Promise<AdminStudentSummary[]> {
  const { data, error } = await supabase
    .from('admin_student_summary')
    .select('*')
    .order('last_active_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminStudentSummary[];
}

export async function fetchUnifiedActivity(limit = 40): Promise<UnifiedActivityRow[]> {
  const { data, error } = await supabase
    .from('admin_unified_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as UnifiedActivityRow[];
}

export async function fetchClinicOptions(): Promise<ClinicOption[]> {
  const { data, error } = await supabase
    .from('hospital_pages')
    .select('id, opportunity:opportunities(name)')
    .eq('page_status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const opp = Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity;
    return {
      id: row.id as string,
      name: (opp as { name?: string } | null)?.name ?? 'Unnamed clinic',
    };
  });
}

export async function fetchStudentEmails(
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userIds, pageSize: userIds.length }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'Failed to fetch emails');
  }

  const result = await response.json();
  return (result.emails ?? {}) as Record<string, string>;
}

// --- Student Analytics Hub extensions ---

export interface PromotionFunnel {
  landing_visitors: number;
  guest_sessions: number;
  signups: number;
  onboarding_complete: number;
  saved_at_least_one: number;
  applied: number;
  accepted: number;
  since: string;
  until: string;
}

export interface StudentAnalyticsBundle {
  profile: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  saved_opportunities: unknown[];
  student_applications: unknown[];
  tracking_events: unknown[];
  platform_events: unknown[];
  experience_entries: unknown[];
  activity_logs: unknown[];
  reviews: unknown[];
  clinic_memberships: unknown[];
  person_notes: unknown[];
  guest_session: Record<string, unknown> | null;
}

export async function fetchPromotionFunnel(
  since: Date,
  until: Date
): Promise<PromotionFunnel> {
  const { data, error } = await supabase.rpc('get_promotion_funnel', {
    p_since: since.toISOString(),
    p_until: until.toISOString(),
  });
  if (error) throw new Error(error.message);
  return data as PromotionFunnel;
}

export async function fetchStudentBundle(userId: string): Promise<StudentAnalyticsBundle> {
  const { data, error } = await supabase.rpc('get_student_analytics_bundle', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as StudentAnalyticsBundle;
}

export async function runCohortFilter(
  filter: Record<string, unknown>,
  limit = 100,
  offset = 0
) {
  const { data, error } = await supabase.rpc('run_cohort_filter', {
    p_filter: filter,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as import('./cohortFilters').CohortRow[];
}

export async function fetchCohorts(): Promise<import('./cohortFilters').AnalyticsCohort[]> {
  const { data, error } = await supabase
    .from('analytics_cohorts')
    .select('*')
    .order('is_template', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    filter_json: row.filter_json as import('./cohortFilters').CohortFilter,
  }));
}

export async function saveCohort(
  name: string,
  description: string,
  filter: Record<string, unknown>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('analytics_cohorts').insert({
    name,
    description,
    filter_json: filter,
    is_template: false,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCohort(id: string): Promise<void> {
  const { error } = await supabase.from('analytics_cohorts').delete().eq('id', id).eq('is_template', false);
  if (error) throw new Error(error.message);
}

export async function fetchUniversityBreakdown(): Promise<{ university: string; count: number }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('university')
    .not('university', 'is', null);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => {
    const u = row.university as string;
    if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([university, count]) => ({ university, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
}

export async function fetchStateBreakdown(): Promise<{ state: string; count: number }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('state')
    .not('state', 'is', null);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => {
    const s = row.state as string;
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchPremiumStats(): Promise<{ premium: number; free: number }> {
  const { data, error } = await supabase.from('profiles').select('is_premium');
  if (error) throw new Error(error.message);
  let premium = 0;
  (data ?? []).forEach((row) => {
    if (row.is_premium) premium += 1;
  });
  const total = data?.length ?? 0;
  return { premium, free: total - premium };
}
