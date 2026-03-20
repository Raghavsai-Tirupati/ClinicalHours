
-- 1. hospital_positions
CREATE TABLE public.hospital_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_page_id UUID NOT NULL REFERENCES public.hospital_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  position_type TEXT DEFAULT 'volunteer' CHECK (position_type IN ('volunteer', 'internship', 'shadowing', 'paid', 'research', 'other')),
  hours_per_week INTEGER,
  duration TEXT,
  start_date DATE,
  application_deadline DATE,
  spots_available INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hospital_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all positions"
  ON public.hospital_positions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Hospital admins can manage own positions"
  ON public.hospital_positions FOR ALL TO authenticated
  USING (
    hospital_page_id IN (
      SELECT id FROM public.hospital_pages
      WHERE lower(admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

CREATE POLICY "Anyone can view active positions"
  ON public.hospital_positions FOR SELECT
  USING (status = 'active');

CREATE INDEX idx_hospital_positions_page_id ON public.hospital_positions(hospital_page_id);
CREATE INDEX idx_hospital_positions_status ON public.hospital_positions(status);

-- 2. position_questions
CREATE TABLE public.position_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES public.hospital_positions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('short_answer', 'long_answer', 'multiple_choice', 'yes_no', 'file_upload')),
  is_required BOOLEAN DEFAULT TRUE,
  options JSONB DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.position_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all questions"
  ON public.position_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Hospital admins can manage own questions"
  ON public.position_questions FOR ALL TO authenticated
  USING (
    position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

CREATE POLICY "Anyone can view questions for active positions"
  ON public.position_questions FOR SELECT
  USING (
    position_id IN (SELECT id FROM public.hospital_positions WHERE status = 'active')
  );

CREATE INDEX idx_position_questions_position_id ON public.position_questions(position_id);

-- 3. student_applications
CREATE TABLE public.student_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES public.hospital_positions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'accepted', 'rejected', 'waitlisted')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  notes TEXT,
  UNIQUE(position_id, student_id)
);

ALTER TABLE public.student_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all applications"
  ON public.student_applications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Hospital admins can view applications to their positions"
  ON public.student_applications FOR ALL TO authenticated
  USING (
    position_id IN (
      SELECT hp.id FROM public.hospital_positions hp
      JOIN public.hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

CREATE POLICY "Students can view own applications"
  ON public.student_applications FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create applications"
  ON public.student_applications FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE INDEX idx_student_applications_position_id ON public.student_applications(position_id);
CREATE INDEX idx_student_applications_student_id ON public.student_applications(student_id);
CREATE INDEX idx_student_applications_status ON public.student_applications(status);

-- 4. application_answers
CREATE TABLE public.application_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.student_applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.position_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.application_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all answers"
  ON public.application_answers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Hospital admins can view answers to their positions"
  ON public.application_answers FOR ALL TO authenticated
  USING (
    application_id IN (
      SELECT sa.id FROM public.student_applications sa
      JOIN public.hospital_positions hp ON sa.position_id = hp.id
      JOIN public.hospital_pages hpg ON hp.hospital_page_id = hpg.id
      WHERE lower(hpg.admin_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
    )
  );

CREATE POLICY "Students can view own answers"
  ON public.application_answers FOR SELECT TO authenticated
  USING (
    application_id IN (SELECT id FROM public.student_applications WHERE student_id = auth.uid())
  );

CREATE POLICY "Students can create answers"
  ON public.application_answers FOR INSERT TO authenticated
  WITH CHECK (
    application_id IN (SELECT id FROM public.student_applications WHERE student_id = auth.uid())
  );

CREATE INDEX idx_application_answers_application_id ON public.application_answers(application_id);
