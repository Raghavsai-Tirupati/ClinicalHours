export interface ClinicRole {
  id: string;
  clinic_id: string;
  role_name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

// 'alumni' = a former member who is no longer active but whose role label is
// preserved (e.g. "Volunteer (Alumni)") so historical context survives.
export type MemberStatus = 'active' | 'inactive' | 'on_leave' | 'alumni';
export type OnboardingSource = 'new_applicant' | 'existing_staff';

export interface ClinicMember {
  id: string;
  clinic_id: string;
  user_id: string | null;
  // Optional link to the application that produced this member. NULL means
  // the member was added manually before the People refactor.
  application_id: string | null;
  // The tracker category that defines this person's role. NULL = unassigned
  // ("Accepted" label in the UI). Set when dragged into a Tracker role.
  tracker_category_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  // Legacy FK to clinic_roles. Kept for backward-compat but no longer used
  // in the UI — tracker categories are the sole source of truth for roles.
  role_id: string | null;
  status: MemberStatus;
  onboarding_source: OnboardingSource;
  hours_logged: number;
  join_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  role?: ClinicRole | null;
}

export interface OnboardingStep {
  id: string;
  clinic_id: string;
  step_name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

export interface OnboardingProgress {
  id: string;
  member_id: string;
  step_id: string;
  status: OnboardingStatus;
  notes: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface ClinicFile {
  id: string;
  clinic_id: string;
  member_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On Leave',
  alumni: 'Alumni',
};

export const MEMBER_STATUS_COLORS: Record<MemberStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  on_leave: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  alumni: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
};

export const ONBOARDING_STATUS_COLORS: Record<OnboardingStatus, string> = {
  not_started: 'bg-red-500/15 text-red-400',
  in_progress: 'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-green-500/15 text-green-400',
};
