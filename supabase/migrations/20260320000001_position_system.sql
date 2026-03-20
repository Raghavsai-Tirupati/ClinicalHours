-- Position System Tables
-- Enables hospital admins to create job/volunteer positions with custom application questions.
-- Students can apply to positions directly from the opportunity detail page.
-- New tables alongside existing hospital_application_* tables.

-- hospital_positions: job/volunteer postings created by hospital admins
CREATE TABLE IF NOT EXISTS hospital_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_page_id UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  position_type TEXT NOT NULL DEFAULT 'volunteer'
    CHECK (position_type IN ('volunteer', 'internship', 'shadowing', 'paid', 'research', 'other')),
  hours_per_week INTEGER,
  duration TEXT,
  start_date DATE,
  application_deadline DATE,
  spots_available INTEGER,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- position_questions: custom application form fields per position
CREATE TABLE IF NOT EXISTS position_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES hospital_positions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'short_answer'
    CHECK (question_type IN ('short_answer', 'long_answer', 'multiple_choice', 'yes_no', 'file_upload')),
  is_required BOOLEAN DEFAULT TRUE,
  options JSONB,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- student_applications: submitted applications from students
CREATE TABLE IF NOT EXISTS student_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES hospital_positions(id),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'accepted', 'rejected', 'waitlisted')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(position_id, student_id)
);

-- application_answers: responses to position questions
CREATE TABLE IF NOT EXISTS application_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES student_applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES position_questions(id),
  answer_text TEXT,
  answer_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE hospital_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_answers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Helper: check if user is hospital admin for a position
-- (user email matches hospital_pages.admin_email)

-- hospital_positions policies
CREATE POLICY "Public can read active positions"
  ON hospital_positions FOR SELECT
  USING (status = 'active');

CREATE POLICY "Hospital admins can manage own positions"
  ON hospital_positions FOR ALL
  USING (
    hospital_page_id IN (
      SELECT id FROM hospital_pages
      WHERE admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Platform admins can manage all positions"
  ON hospital_positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- position_questions policies
CREATE POLICY "Public can read questions for active positions"
  ON position_questions FOR SELECT
  USING (
    position_id IN (SELECT id FROM hospital_positions WHERE status = 'active')
  );

CREATE POLICY "Hospital admins can manage own questions"
  ON position_questions FOR ALL
  USING (
    position_id IN (
      SELECT hp.id FROM hospital_positions hp
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE hpg.admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Platform admins can manage all questions"
  ON position_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- student_applications policies
CREATE POLICY "Students can view own applications"
  ON student_applications FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can create applications"
  ON student_applications FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Hospital admins can view applications for own positions"
  ON student_applications FOR SELECT
  USING (
    position_id IN (
      SELECT hp.id FROM hospital_positions hp
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE hpg.admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Hospital admins can update application status"
  ON student_applications FOR UPDATE
  USING (
    position_id IN (
      SELECT hp.id FROM hospital_positions hp
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE hpg.admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Platform admins can manage all applications"
  ON student_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- application_answers policies
CREATE POLICY "Students can view own answers"
  ON application_answers FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM student_applications WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Students can create answers"
  ON application_answers FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM student_applications WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Hospital admins can view answers for own positions"
  ON application_answers FOR SELECT
  USING (
    application_id IN (
      SELECT sa.id FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE hpg.admin_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Platform admins can view all answers"
  ON application_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hospital_positions_page_id ON hospital_positions(hospital_page_id);
CREATE INDEX IF NOT EXISTS idx_hospital_positions_status ON hospital_positions(status);
CREATE INDEX IF NOT EXISTS idx_position_questions_position_id ON position_questions(position_id, display_order);
CREATE INDEX IF NOT EXISTS idx_student_applications_position_id ON student_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_student_applications_student_id ON student_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_application_answers_application_id ON application_answers(application_id);

-- Auto-update updated_at on hospital_positions
CREATE OR REPLACE FUNCTION update_hospital_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hospital_positions_updated_at
  BEFORE UPDATE ON hospital_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_hospital_positions_updated_at();
