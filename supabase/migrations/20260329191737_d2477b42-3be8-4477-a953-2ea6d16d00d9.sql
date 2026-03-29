
-- Application Updates: Documents, Scheduling Questions, Resume Scoring

-- 1. Application Documents
CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES student_applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'other',
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_documents_application ON application_documents(application_id);
CREATE INDEX idx_application_documents_student ON application_documents(student_id);

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own documents"
  ON application_documents FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students insert own documents"
  ON application_documents FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students delete own documents"
  ON application_documents FOR DELETE
  USING (student_id = auth.uid());

CREATE POLICY "Clinic admins read application documents"
  ON application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE sa.id = application_documents.application_id
        AND lower(hpg.admin_email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "Platform admins read all documents"
  ON application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 2. Clinic Scheduling Questions
CREATE TABLE IF NOT EXISTS clinic_scheduling_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES hospital_pages(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'short_answer'
    CHECK (question_type IN ('short_answer', 'long_answer', 'multiple_choice', 'yes_no')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_scheduling_questions_clinic ON clinic_scheduling_questions(clinic_id, display_order);

CREATE TRIGGER update_clinic_scheduling_questions_updated_at
  BEFORE UPDATE ON clinic_scheduling_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE clinic_scheduling_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins manage scheduling questions"
  ON clinic_scheduling_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = clinic_scheduling_questions.clinic_id
        AND lower(hospital_pages.admin_email) = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hospital_pages
      WHERE hospital_pages.id = clinic_scheduling_questions.clinic_id
        AND lower(hospital_pages.admin_email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "Platform admins manage all scheduling questions"
  ON clinic_scheduling_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students read scheduling questions"
  ON clinic_scheduling_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Scheduling Answers
CREATE TABLE IF NOT EXISTS scheduling_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES student_applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES clinic_scheduling_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduling_answers_application ON scheduling_answers(application_id);
CREATE INDEX idx_scheduling_answers_question ON scheduling_answers(question_id);

ALTER TABLE scheduling_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own scheduling answers"
  ON scheduling_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM student_applications sa
      WHERE sa.id = scheduling_answers.application_id
        AND sa.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM student_applications sa
      WHERE sa.id = scheduling_answers.application_id
        AND sa.student_id = auth.uid()
    )
  );

CREATE POLICY "Clinic admins read scheduling answers"
  ON scheduling_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_applications sa
      JOIN hospital_positions hp ON hp.id = sa.position_id
      JOIN hospital_pages hpg ON hpg.id = hp.hospital_page_id
      WHERE sa.id = scheduling_answers.application_id
        AND lower(hpg.admin_email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "Platform admins read all scheduling answers"
  ON scheduling_answers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 4. Column additions
ALTER TABLE hospital_positions
  ADD COLUMN IF NOT EXISTS match_keywords TEXT[] DEFAULT '{}';

ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS resume_match_score SMALLINT,
  ADD COLUMN IF NOT EXISTS resume_text TEXT;

CREATE INDEX IF NOT EXISTS idx_student_applications_resume_score
  ON student_applications(resume_match_score)
  WHERE resume_match_score IS NOT NULL;
