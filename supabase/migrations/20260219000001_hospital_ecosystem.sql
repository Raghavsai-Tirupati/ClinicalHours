-- ─────────────────────────────────────────────────────────────────────────────
-- Hospital Ecosystem Migration
-- Tables: hospitals, hospital_accounts, hospital_members,
--         hospital_application_questions, hospital_applications,
--         hospital_application_answers
-- + RLS policies to prevent cross-tenant data leakage
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. hospitals ─────────────────────────────────────────────────────────────
CREATE TABLE public.hospitals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  address    text,
  city       text,
  state      text,
  website    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read hospitals"
  ON public.hospitals FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert hospitals"
  ON public.hospitals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update hospitals"
  ON public.hospitals FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. hospital_role enum ─────────────────────────────────────────────────────
CREATE TYPE public.hospital_role AS ENUM ('owner', 'admin', 'viewer');

-- ── 3. hospital_accounts (one per hospital – the "tenant") ───────────────────
CREATE TABLE public.hospital_accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid        NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id)  -- each hospital has at most one account
);

ALTER TABLE public.hospital_accounts ENABLE ROW LEVEL SECURITY;

-- Public read: needed so the student apply page can show hospital info
CREATE POLICY "Anyone can read hospital accounts"
  ON public.hospital_accounts FOR SELECT USING (true);

-- Any authenticated user can create an account (during onboarding)
CREATE POLICY "Authenticated users can create hospital accounts"
  ON public.hospital_accounts FOR INSERT TO authenticated WITH CHECK (true);

-- Owners/admins can update
CREATE POLICY "Hospital owners or admins can update their account"
  ON public.hospital_accounts FOR UPDATE
  USING (
    id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── 4. hospital_members ───────────────────────────────────────────────────────
CREATE TABLE public.hospital_members (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid          NOT NULL REFERENCES public.hospital_accounts(id) ON DELETE CASCADE,
  user_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       hospital_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

ALTER TABLE public.hospital_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own membership row + all memberships in their account
CREATE POLICY "Members can read their own account memberships"
  ON public.hospital_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR account_id IN (
      SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid()
    )
  );

-- Any authenticated user can insert their own first membership (onboarding)
CREATE POLICY "Authenticated users can insert their own membership"
  ON public.hospital_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Owners can update other members' roles
CREATE POLICY "Owners can update account members"
  ON public.hospital_members FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Owners can remove members
CREATE POLICY "Owners can delete account members"
  ON public.hospital_members FOR DELETE
  USING (
    account_id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE INDEX idx_hospital_members_user_id    ON public.hospital_members (user_id);
CREATE INDEX idx_hospital_members_account_id ON public.hospital_members (account_id);

-- ── 5. hospital_application_questions ────────────────────────────────────────
CREATE TABLE public.hospital_application_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid        NOT NULL REFERENCES public.hospital_accounts(id) ON DELETE CASCADE,
  question_text text        NOT NULL,
  type          text        NOT NULL DEFAULT 'short_text'
                            CHECK (type IN ('short_text', 'long_text', 'mcq', 'checkbox')),
  required      boolean     NOT NULL DEFAULT true,
  options       jsonb,       -- used for mcq / checkbox choices
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_application_questions ENABLE ROW LEVEL SECURITY;

-- Anyone can read questions (students need them to fill the form)
CREATE POLICY "Anyone can read hospital questions"
  ON public.hospital_application_questions FOR SELECT USING (true);

-- Only owners/admins can insert
CREATE POLICY "Hospital admins can insert questions"
  ON public.hospital_application_questions FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owners/admins can update
CREATE POLICY "Hospital admins can update questions"
  ON public.hospital_application_questions FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owners/admins can delete
CREATE POLICY "Hospital admins can delete questions"
  ON public.hospital_application_questions FOR DELETE
  USING (
    account_id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_haq_account_id ON public.hospital_application_questions (account_id, order_index);

CREATE TRIGGER update_haq_updated_at
  BEFORE UPDATE ON public.hospital_application_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 6. hospital_applications ──────────────────────────────────────────────────
CREATE TABLE public.hospital_applications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid        NOT NULL REFERENCES public.hospital_accounts(id) ON DELETE CASCADE,
  student_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('submitted', 'in_review', 'accepted', 'rejected')),
  notes        text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, student_id)  -- one application per student per hospital
);

ALTER TABLE public.hospital_applications ENABLE ROW LEVEL SECURITY;

-- Students can submit their own applications
CREATE POLICY "Students can create their own applications"
  ON public.hospital_applications FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Students can read only their own applications
CREATE POLICY "Students can read own applications"
  ON public.hospital_applications FOR SELECT
  USING (student_id = auth.uid());

-- Hospital members can read all applications for their hospital
CREATE POLICY "Hospital members can read their hospital applications"
  ON public.hospital_applications FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid()
    )
  );

-- Hospital owners/admins can update status and notes
CREATE POLICY "Hospital admins can update applications"
  ON public.hospital_applications FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.hospital_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_happs_account_id ON public.hospital_applications (account_id);
CREATE INDEX idx_happs_student_id ON public.hospital_applications (student_id);

CREATE TRIGGER update_happs_updated_at
  BEFORE UPDATE ON public.hospital_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. hospital_application_answers ──────────────────────────────────────────
CREATE TABLE public.hospital_application_answers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES public.hospital_applications(id) ON DELETE CASCADE,
  question_id    uuid        NOT NULL REFERENCES public.hospital_application_questions(id) ON DELETE CASCADE,
  answer_text    text,
  answer_options jsonb,       -- selected options for mcq/checkbox
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, question_id)
);

ALTER TABLE public.hospital_application_answers ENABLE ROW LEVEL SECURITY;

-- Students can insert answers for their own applications
CREATE POLICY "Students can create their own answers"
  ON public.hospital_application_answers FOR INSERT TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM public.hospital_applications WHERE student_id = auth.uid()
    )
  );

-- Students can read their own answers only
CREATE POLICY "Students can read own answers"
  ON public.hospital_application_answers FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM public.hospital_applications WHERE student_id = auth.uid()
    )
  );

-- Hospital members can read answers for their hospital's applications
CREATE POLICY "Hospital members can read their hospital answers"
  ON public.hospital_application_answers FOR SELECT
  USING (
    application_id IN (
      SELECT ha.id
      FROM public.hospital_applications ha
      JOIN public.hospital_members hm ON hm.account_id = ha.account_id
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE INDEX idx_haa_application_id ON public.hospital_application_answers (application_id);
CREATE INDEX idx_haa_question_id    ON public.hospital_application_answers (question_id);
