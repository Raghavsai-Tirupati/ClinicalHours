// Shared types across the application
// This eliminates duplication and ensures type consistency

export interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  hours_required: string;
  acceptance_likelihood: string;
  description?: string | null;
  requirements?: string[];
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  slug?: string | null;
  hospital_id?: string | null;
  logo_url?: string | null;
  avg_rating?: number;
  review_count?: number;
  distance?: number;
  last_verified_at?: string | null;
  verification_source?: string | null;
  application_method?: 'internal' | 'external' | 'email' | 'phone' | 'in_person' | 'unknown' | null;
  seasonality?: string | null;
  link_status?: 'unknown' | 'active' | 'broken' | 'redirected';
}

export interface SavedOpportunity {
  id: string;
  opportunity_id: string;
  user_id: string;
  created_at: string;
  contacted?: boolean;
  applied?: boolean;
  heard_back?: boolean;
  scheduled_interview?: boolean;
  deadline?: string;
  notes?: string;
  opportunity?: Opportunity;
}

export interface Question {
  id: string;
  title: string;
  body: string | null;
  author_name: string | null;
  author_university: string | null;
  author_major: string | null;
  author_graduation_year: number | null;
  author_clinical_hours: number | null;
  vote_count: number;
  answer_count: number;
  created_at: string;
  user_id: string;
  opportunity_id: string;
}

export interface Answer {
  id: string;
  body: string;
  author_name: string | null;
  author_university: string | null;
  author_major: string | null;
  author_graduation_year: number | null;
  author_clinical_hours: number | null;
  vote_count: number;
  is_accepted: boolean;
  created_at: string;
  user_id: string;
  question_id: string;
}

export interface Review {
  id: string;
  opportunity_id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  overall_experience?: number | null;
  learning_opportunities?: number | null;
  mentorship_quality?: number | null;
  work_life_balance?: number | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    university: string | null;
    major: string | null;
    graduation_year: number | null;
    clinical_hours: number | null;
  };
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface SearchOptions {
  searchTerm?: string;
  filterType?: string;
  userLocation?: UserLocation | null;
}

// Error types
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export type ErrorDetails = Record<string, unknown>;

// Review data types
export interface ReviewData {
  opportunity_id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  overall_experience?: number;
  acceptance_difficulty?: number;
  staff_friendliness?: number;
  learning_opportunities?: number;
  [key: string]: string | number | null | undefined;
}

// Supabase client type (for lazy loading)
export type SupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  from: (table: string) => {
    insert: (data: unknown) => Promise<{ error: SupabaseError | null }>;
    select: (columns: string) => unknown;
  };
};

// Opportunity database row type (before mapping to Opportunity)
export interface OpportunityRow {
  id: string;
  name: string;
  type: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  hours_required: string;
  acceptance_likelihood: string;
  description?: string | null;
  requirements?: string[] | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  slug?: string | null;
  hospital_id?: string | null;
  logo_url?: string | null;
  avg_rating?: number | null;
  review_count?: number | null;
  last_verified_at?: string | null;
  verification_source?: string | null;
  application_method?: 'internal' | 'external' | 'email' | 'phone' | 'in_person' | 'unknown' | null;
  seasonality?: string | null;
  link_status?: 'unknown' | 'active' | 'broken' | 'redirected';
}

// Saved opportunity with nested opportunity data (from database join)
export interface SavedOpportunityWithDetails {
  id: string;
  opportunity_id: string;
  user_id: string;
  created_at: string;
  contacted?: boolean;
  applied?: boolean;
  heard_back?: boolean;
  scheduled_interview?: boolean;
  deadline?: string;
  notes?: string;
  is_active_experience?: boolean;
  opportunities?: Opportunity & { distance?: number };
}

// Experience entry for tracking hours and moments at a location
export interface ExperienceEntry {
  id: string;
  user_id: string;
  opportunity_id: string;
  hours: number | null;
  moment: string | null;
  entry_date: string;
  created_at: string;
}

// Experience with aggregated data for display
export interface ExperienceWithDetails {
  opportunity: Opportunity;
  savedOpportunityId: string;
  totalHours: number;
  entries: ExperienceEntry[];
}

