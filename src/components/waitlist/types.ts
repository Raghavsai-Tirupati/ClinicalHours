import type { PositionType } from '@/types/positions';

export interface WaitlistSettings {
  id: string;
  clinic_id: string;
  slug: string;
  is_open: boolean;
  welcome_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistSubmission {
  id: string;
  clinic_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  university: string | null;
  major: string | null;
  gpa: number | null;
  graduation_year: number | null;
  role_interest: PositionType | null;
  availability_json: WaitlistAvailability | null;
  message: string | null;
  converted_to_application_id: string | null;
  converted_at: string | null;
  submitted_at: string;
}

export interface WaitlistAvailability {
  days?: string[];
  time_pref?: string;
  hours_per_week?: number;
  commitment?: string;
}

export interface WaitlistFormData {
  full_name: string;
  email: string;
  phone: string;
  university: string;
  major: string;
  gpa: string;
  graduation_year: string;
  role_interest: PositionType | '';
  message: string;
  days: Set<string>;
  time_pref: string;
  hours_per_week: number;
  commitment: string;
}

export interface FeatureFlag {
  id: string;
  flag_key: string;
  description: string | null;
  enabled: boolean;
  clinic_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const ROLE_INTEREST_OPTIONS: { value: PositionType; label: string }[] = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'internship', label: 'Internship' },
  { value: 'shadowing', label: 'Shadowing' },
  { value: 'paid', label: 'Paid Position' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' },
];

export const WEEKDAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
] as const;

export const TIME_PREF_OPTIONS = [
  { value: 'morning', label: 'Mornings (8am – 12pm)' },
  { value: 'afternoon', label: 'Afternoons (12pm – 5pm)' },
  { value: 'evening', label: 'Evenings (5pm – 9pm)' },
  { value: 'flexible', label: 'Flexible' },
] as const;

export const COMMITMENT_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: '1sem', label: '1 semester' },
  { value: '2sem', label: '2 semesters (full year)' },
  { value: 'ongoing', label: 'Ongoing — no set end date' },
  { value: 'summer', label: 'Summer only' },
] as const;
