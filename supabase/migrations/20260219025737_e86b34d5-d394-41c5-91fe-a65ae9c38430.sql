
-- ── 1. hospitals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hospitals (
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospitals' AND policyname='Anyone can read hospitals') THEN
    CREATE POLICY "Anyone can read hospitals" ON public.hospitals FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospitals' AND policyname='Authenticated users can insert hospitals') THEN
    CREATE POLICY "Authenticated users can insert hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospitals' AND policyname='Authenticated users can update hospitals') THEN
    CREATE POLICY "Authenticated users can update hospitals" ON public.hospitals FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. hospital_role enum
DO $$ BEGIN
  CREATE TYPE public.hospital_role AS ENUM ('owner', 'admin', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. hospital_accounts (WITHOUT update policy yet)
CREATE TABLE IF NOT EXISTS public.hospital_accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid        NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id)
);

ALTER TABLE public.hospital_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_accounts' AND policyname='Anyone can read hospital accounts') THEN
    CREATE POLICY "Anyone can read hospital accounts" ON public.hospital_accounts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_accounts' AND policyname='Authenticated users can create hospital accounts') THEN
    CREATE POLICY "Authenticated users can create hospital accounts" ON public.hospital_accounts FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ── 4. hospital_members
CREATE TABLE IF NOT EXISTS public.hospital_members (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid          NOT NULL REFERENCES public.hospital_accounts(id) ON DELETE CASCADE,
  user_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       hospital_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

ALTER TABLE public.hospital_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_members' AND policyname='Members can read their own account memberships') THEN
    CREATE POLICY "Members can read their own account memberships" ON public.hospital_members FOR SELECT
      USING (user_id = auth.uid() OR account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_members' AND policyname='Authenticated users can insert their own membership') THEN
    CREATE POLICY "Authenticated users can insert their own membership" ON public.hospital_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_members' AND policyname='Owners can update account members') THEN
    CREATE POLICY "Owners can update account members" ON public.hospital_members FOR UPDATE
      USING (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role = 'owner'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_members' AND policyname='Owners can delete account members') THEN
    CREATE POLICY "Owners can delete account members" ON public.hospital_members FOR DELETE
      USING (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role = 'owner'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hospital_members_user_id    ON public.hospital_members (user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_members_account_id ON public.hospital_members (account_id);

-- Now add the update policy on hospital_accounts that references hospital_members
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_accounts' AND policyname='Hospital owners or admins can update their account') THEN
    CREATE POLICY "Hospital owners or admins can update their account" ON public.hospital_accounts FOR UPDATE
      USING (id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

-- ── 5. hospital_application_questions
CREATE TABLE IF NOT EXISTS public.hospital_application_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid        NOT NULL REFERENCES public.hospital_accounts(id) ON DELETE CASCADE,
  question_text text        NOT NULL,
  type          text        NOT NULL DEFAULT 'short_text' CHECK (type IN ('short_text', 'long_text', 'mcq', 'checkbox')),
  required      boolean     NOT NULL DEFAULT true,
  options       jsonb,
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_application_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_questions' AND policyname='Anyone can read hospital questions') THEN
    CREATE POLICY "Anyone can read hospital questions" ON public.hospital_application_questions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_questions' AND policyname='Hospital admins can insert questions') THEN
    CREATE POLICY "Hospital admins can insert questions" ON public.hospital_application_questions FOR INSERT TO authenticated
      WITH CHECK (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_questions' AND policyname='Hospital admins can update questions') THEN
    CREATE POLICY "Hospital admins can update questions" ON public.hospital_application_questions FOR UPDATE
      USING (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_questions' AND policyname='Hospital admins can delete questions') THEN
    CREATE POLICY "Hospital admins can delete questions" ON public.hospital_application_questions FOR DELETE
      USING (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_haq_account_id ON public.hospital_application_questions (account_id, order_index);

DROP TRIGGER IF EXISTS update_haq_updated_at ON public.hospital_application_questions;
CREATE TRIGGER update_haq_updated_at
  BEFORE UPDATE ON public.hospital_application_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 6. hospital_applications
CREATE TABLE IF NOT EXISTS public.hospital_applications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid        NOT NULL REFERENCES public.hospital_accounts(id) ON DELETE CASCADE,
  student_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'accepted', 'rejected')),
  notes        text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, student_id)
);

ALTER TABLE public.hospital_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_applications' AND policyname='Students can create their own applications') THEN
    CREATE POLICY "Students can create their own applications" ON public.hospital_applications FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_applications' AND policyname='Students can read own applications') THEN
    CREATE POLICY "Students can read own applications" ON public.hospital_applications FOR SELECT USING (student_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_applications' AND policyname='Hospital members can read their hospital applications') THEN
    CREATE POLICY "Hospital members can read their hospital applications" ON public.hospital_applications FOR SELECT
      USING (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_applications' AND policyname='Hospital admins can update applications') THEN
    CREATE POLICY "Hospital admins can update applications" ON public.hospital_applications FOR UPDATE
      USING (account_id IN (SELECT account_id FROM public.hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_happs_account_id ON public.hospital_applications (account_id);
CREATE INDEX IF NOT EXISTS idx_happs_student_id ON public.hospital_applications (student_id);

DROP TRIGGER IF EXISTS update_happs_updated_at ON public.hospital_applications;
CREATE TRIGGER update_happs_updated_at
  BEFORE UPDATE ON public.hospital_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. hospital_application_answers
CREATE TABLE IF NOT EXISTS public.hospital_application_answers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES public.hospital_applications(id) ON DELETE CASCADE,
  question_id    uuid        NOT NULL REFERENCES public.hospital_application_questions(id) ON DELETE CASCADE,
  answer_text    text,
  answer_options jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, question_id)
);

ALTER TABLE public.hospital_application_answers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_answers' AND policyname='Students can create their own answers') THEN
    CREATE POLICY "Students can create their own answers" ON public.hospital_application_answers FOR INSERT TO authenticated
      WITH CHECK (application_id IN (SELECT id FROM public.hospital_applications WHERE student_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_answers' AND policyname='Students can read own answers') THEN
    CREATE POLICY "Students can read own answers" ON public.hospital_application_answers FOR SELECT
      USING (application_id IN (SELECT id FROM public.hospital_applications WHERE student_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hospital_application_answers' AND policyname='Hospital members can read their hospital answers') THEN
    CREATE POLICY "Hospital members can read their hospital answers" ON public.hospital_application_answers FOR SELECT
      USING (application_id IN (SELECT ha.id FROM public.hospital_applications ha JOIN public.hospital_members hm ON hm.account_id = ha.account_id WHERE hm.user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_haa_application_id ON public.hospital_application_answers (application_id);
CREATE INDEX IF NOT EXISTS idx_haa_question_id    ON public.hospital_application_answers (question_id);
