import { supabase } from "@/integrations/supabase/client";

export interface AdminKpis {
  total_students: number;
  new_students: number;
  active_students_week: number;
  active_students_window: number;
  logins: number;
  total_applications: number;
  pending_applications: number;
  evaluations: number;
  avg_evaluation_score: number | null;
  students_needing_attention: number;
}

export type TimeSeriesMetric =
  | "new_users"
  | "active_users"
  | "logins"
  | "applications"
  | "evaluations"
  | "avg_evaluation_score";

export type Granularity = "hour" | "day" | "week" | "month";

export interface TimeSeriesPoint {
  bucket: string;
  value: number;
}

export interface StudentSummary {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  city: string | null;
  state: string | null;
  graduation_year: number | null;
  is_premium: boolean | null;
  clinical_hours: number | null;
  volunteer_hours: number | null;
  application_count: number | null;
  active_application_count: number | null;
  pending_application_count: number | null;
  clinic_count: number | null;
  clinic_names: string | null;
  avg_evaluation_score: number | null;
  last_active_at: string | null;
  last_login_at: string | null;
  attention_level: string | null;
  needs_attention: boolean | null;
  created_at: string | null;
}

export interface UnifiedActivity {
  id: string;
  occurred_at: string;
  source: string | null;
  event_type: string | null;
  actor_email: string | null;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
}

export async function fetchAdminKpis(
  since: string,
  until: string,
  clinicId?: string | null
): Promise<AdminKpis> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_kpis", {
    p_since: since,
    p_until: until,
    p_clinic_id: clinicId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as AdminKpis;
}

export async function fetchAdminTimeSeries(
  metric: TimeSeriesMetric,
  since: string,
  until: string,
  granularity: Granularity = "day",
  clinicId?: string | null
): Promise<TimeSeriesPoint[]> {
  const { data, error } = await supabase.rpc("get_admin_time_series", {
    p_metric: metric,
    p_since: since,
    p_until: until,
    p_granularity: granularity,
    p_clinic_id: clinicId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimeSeriesPoint[];
}

export async function fetchStudentSummaries(limit = 200): Promise<StudentSummary[]> {
  const { data, error } = await supabase
    .from("admin_student_summary")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentSummary[];
}

export async function fetchUnifiedActivity(limit = 50): Promise<UnifiedActivity[]> {
  const { data, error } = await supabase
    .from("admin_unified_activity")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as UnifiedActivity[];
}