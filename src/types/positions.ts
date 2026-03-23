// Position system types

export type PositionType = 'volunteer' | 'internship' | 'shadowing' | 'paid' | 'research' | 'other';
export type PositionStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived';
export type QuestionType = 'short_answer' | 'long_answer' | 'multiple_choice' | 'yes_no' | 'file_upload';
export type ApplicationStatus = 'new' | 'under_review' | 'interview' | 'accepted' | 'rejected' | 'waitlisted';

export interface HospitalPosition {
  id: string;
  hospital_page_id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  position_type: PositionType;
  hours_per_week: number | null;
  duration: string | null;
  start_date: string | null;
  application_deadline: string | null;
  spots_available: number | null;
  ask_for_availability: boolean;
  status: PositionStatus;
  created_at: string;
  updated_at: string;
}

export interface PositionQuestion {
  id: string;
  position_id: string;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  options: string[] | null;
  display_order: number;
  created_at: string;
}

/** Saved from the student apply wizard (availability step). */
export interface ApplicationAvailability {
  days?: string[];
  time_pref?: string;
  hours_per_week?: number;
  commitment?: string;
}

export interface StudentApplication {
  id: string;
  position_id: string;
  student_id: string;
  applicant_name?: string | null;
  applicant_email?: string | null;
  availability_json?: ApplicationAvailability | null;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  interview_invited_at?: string | null;
  interview_confirmed_at?: string | null;
  ai_summary?: string | null;
  // Joined data
  position?: HospitalPosition;
  student_profile?: {
    full_name: string | null;
    email: string;
    university: string | null;
    major: string | null;
    graduation_year: number | null;
    phone: string | null;
    resume_url: string | null;
    gpa?: number | null;
    clinical_hours?: number | null;
    research_experience?: string | null;
  };
  answers?: ApplicationAnswer[];
}

export interface ApplicationAnswer {
  id: string;
  application_id: string;
  question_id: string;
  answer_text: string | null;
  answer_options?: string[] | null;
  answer_file_url: string | null;
  created_at: string;
  // Joined
  question?: Pick<PositionQuestion, 'id' | 'question_text' | 'question_type' | 'is_required' | 'display_order'>;
}

export interface HospitalPageWithOpportunity {
  id: string;
  hospital_id: string;
  admin_email: string;
  interview_booking_url: string | null;
  is_claimed: boolean;
  claimed_at: string | null;
  created_at: string;
  created_by: string | null;
  /** Gmail address connected for send-on-behalf (null/undefined = not connected). */
  gmail_email?: string | null;
  /** When Gmail was last connected. */
  gmail_connected_at?: string | null;
  opportunity: {
    id: string;
    name: string;
    location: string;
    type: string;
    website: string | null;
    logo_url: string | null;
    description: string | null;
  };
}

// Form types for creating/editing positions
export interface PositionFormData {
  title: string;
  description: string;
  requirements: string;
  location: string;
  position_type: PositionType;
  hours_per_week: number | null;
  duration: string;
  start_date: string;
  application_deadline: string;
  spots_available: number | null;
  ask_for_availability: boolean;
  status: PositionStatus;
}

export interface QuestionFormData {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  options: string[];
  display_order: number;
}

// Position type display labels
export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  volunteer: 'Volunteer',
  internship: 'Internship',
  shadowing: 'Shadowing',
  paid: 'Paid',
  research: 'Research',
  other: 'Other',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
};

export type ActivityActionType =
  | 'status_change'
  | 'email_sent'
  | 'interview_invited'
  | 'position_created'
  | 'position_updated'
  | 'position_closed'
  | 'note_added'
  | 'application_reviewed';

export interface ActivityLogEntry {
  id: string;
  hospital_page_id: string;
  actor_email: string;
  action_type: ActivityActionType;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
