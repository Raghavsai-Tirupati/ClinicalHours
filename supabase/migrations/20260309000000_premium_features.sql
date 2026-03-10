-- Premium Features Migration
-- Extends profiles, adds tables for hour tracking, reflections, quiz, AMCAS, LOR, competency mapping

-- ============================================================
-- 1. Extend profiles table with premium + pre-health fields
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS year text,
  ADD COLUMN IF NOT EXISTS pre_health_track text,
  ADD COLUMN IF NOT EXISTS mcat_score integer,
  ADD COLUMN IF NOT EXISTS mcat_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS state_of_residency text,
  ADD COLUMN IF NOT EXISTS target_matriculation_year integer,
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_expires_at timestamptz;

-- ============================================================
-- 2. Activity types enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'shadowing', 'volunteering', 'research', 'clinical_employment',
    'community_service', 'teaching_tutoring', 'leadership', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Activity logs table (hour tracker)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES hospitals(id),
  custom_organization_name text,
  activity_type activity_type NOT NULL DEFAULT 'other',
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric NOT NULL DEFAULT 0,
  supervisor_name text,
  supervisor_title text,
  supervisor_email text,
  department text,
  specialty_area text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity logs" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activity logs" ON activity_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own activity logs" ON activity_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_date ON activity_logs(session_date);

-- ============================================================
-- 4. Reflections table
-- ============================================================
CREATE TABLE IF NOT EXISTS reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_log_id uuid NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
  what_happened text,
  what_stood_out text,
  what_learned text,
  is_meaningful boolean DEFAULT false,
  competency_tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reflections" ON reflections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reflections" ON reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reflections" ON reflections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reflections" ON reflections
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_activity_log_id ON reflections(activity_log_id);

-- ============================================================
-- 5. Quiz responses table
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pre_health_track text,
  specialty_interests text[] DEFAULT '{}',
  opportunity_types text[] DEFAULT '{}',
  location_lat numeric,
  location_lng numeric,
  max_distance_miles integer,
  available_days text[] DEFAULT '{}',
  available_times text[] DEFAULT '{}',
  transportation text,
  patient_interaction_pref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz responses" ON quiz_responses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz responses" ON quiz_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON quiz_responses(user_id);

-- ============================================================
-- 6. Quiz matches table
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_response_id uuid NOT NULL REFERENCES quiz_responses(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES hospitals(id),
  match_score numeric DEFAULT 0,
  match_rationale text,
  is_saved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz matches" ON quiz_matches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz matches" ON quiz_matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quiz matches" ON quiz_matches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_matches_user_id ON quiz_matches(user_id);

-- ============================================================
-- 7. AMCAS drafts table
-- ============================================================
CREATE TABLE IF NOT EXISTS amcas_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text,
  amcas_category text,
  organization_name text,
  position_title text,
  start_date date,
  end_date date,
  total_hours numeric,
  description_draft text,
  is_most_meaningful boolean DEFAULT false,
  meaningful_draft text,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE amcas_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own amcas drafts" ON amcas_drafts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own amcas drafts" ON amcas_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own amcas drafts" ON amcas_drafts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own amcas drafts" ON amcas_drafts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_amcas_drafts_user_id ON amcas_drafts(user_id);

-- ============================================================
-- 8. LOR contacts table
-- ============================================================
CREATE TABLE IF NOT EXISTS lor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommender_name text NOT NULL,
  recommender_title text,
  recommender_email text,
  institution text,
  relationship_type text,
  classes_or_projects text,
  relationship_start_date date,
  relationship_end_date date,
  strength_score integer DEFAULT 3,
  last_interaction_date date,
  letter_status text DEFAULT 'not_asked',
  amcas_letter_id text,
  submission_method text,
  ask_by_date date,
  deadline_date date,
  schools_assigned text[] DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lor contacts" ON lor_contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lor contacts" ON lor_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lor contacts" ON lor_contacts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lor contacts" ON lor_contacts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lor_contacts_user_id ON lor_contacts(user_id);

-- ============================================================
-- 9. Competency summary (cached view)
-- ============================================================
CREATE TABLE IF NOT EXISTS competency_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_name text NOT NULL,
  reflection_count integer DEFAULT 0,
  activity_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id, competency_name)
);

ALTER TABLE competency_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own competency summary" ON competency_summary
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own competency summary" ON competency_summary
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own competency summary" ON competency_summary
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_competency_summary_user_id ON competency_summary(user_id);
