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
