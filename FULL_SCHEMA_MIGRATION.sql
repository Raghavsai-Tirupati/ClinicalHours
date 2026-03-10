-- ============================================================
-- ClinicalHours - Complete Schema Migration
-- Run this in your NEW Supabase project's SQL Editor
-- Split into sections - run each section one at a time if needed
-- ============================================================

-- ============================================================
-- SECTION 1: ENUMS
-- ============================================================
CREATE TYPE public.acceptance_likelihood AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.hospital_role AS ENUM ('owner', 'admin', 'viewer');
CREATE TYPE public.opportunity_type AS ENUM ('hospital', 'clinic', 'hospice', 'emt', 'volunteer');
CREATE TYPE public.votable_type AS ENUM ('question', 'answer');

-- ============================================================
-- SECTION 2: TABLES
-- ============================================================

-- profiles (references auth.users via id)
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  full_name text NOT NULL,
  university text,
  major text,
  graduation_year integer,
  gpa numeric,
  clinical_hours integer DEFAULT 0,
  bio text,
  city text,
  state text,
  phone text,
  pre_med_track text,
  linkedin_url text,
  career_goals text,
  research_experience text,
  certifications text[],
  resume_url text,
  email_verified boolean DEFAULT false,
  email_opt_in boolean DEFAULT false,
  onboarding_complete boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- hospitals
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  website text,
  status text DEFAULT 'seeded',
  slug text,
  contact_name text,
  contact_email text,
  contact_phone text,
  submitted_by_user_id uuid,
  submitted_at timestamptz,
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- opportunities
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type opportunity_type NOT NULL,
  location text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  hours_required text NOT NULL,
  acceptance_likelihood acceptance_likelihood NOT NULL,
  description text,
  requirements text[] DEFAULT '{}',
  phone text,
  email text,
  website text,
  source text,
  external_id text,
  country_code text,
  slug text,
  hospital_id uuid REFERENCES public.hospitals(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- hospital_accounts
CREATE TABLE public.hospital_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- hospital_members
CREATE TABLE public.hospital_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.hospital_accounts(id),
  user_id uuid NOT NULL,
  role hospital_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- hospital_applications
CREATE TABLE public.hospital_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.hospital_accounts(id),
  student_id uuid,
  applicant_name text,
  applicant_email text,
  status text NOT NULL DEFAULT 'submitted',
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- hospital_application_questions
CREATE TABLE public.hospital_application_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.hospital_accounts(id),
  question_text text NOT NULL,
  type text NOT NULL DEFAULT 'short_text',
  required boolean NOT NULL DEFAULT true,
  options jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- hospital_application_answers
CREATE TABLE public.hospital_application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.hospital_applications(id),
  question_id uuid NOT NULL REFERENCES public.hospital_application_questions(id),
  answer_text text,
  answer_options jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- hospital_deletion_log
CREATE TABLE public.hospital_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_hospital_id uuid NOT NULL,
  kept_hospital_id uuid NOT NULL,
  deleted_hospital_name text,
  duplicate_reason text NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  rating numeric NOT NULL,
  comment text,
  overall_experience integer,
  acceptance_difficulty integer,
  staff_friendliness integer,
  learning_opportunities integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- saved_opportunities
CREATE TABLE public.saved_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  status text NOT NULL DEFAULT 'Saved',
  notes text,
  contacted boolean DEFAULT false,
  applied boolean DEFAULT false,
  heard_back boolean DEFAULT false,
  scheduled_interview boolean DEFAULT false,
  deadline date,
  is_active_experience boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- experience_entries
CREATE TABLE public.experience_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  hours numeric,
  moment text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- applications
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  student_name text NOT NULL,
  student_email text NOT NULL,
  student_phone text,
  resume_url text,
  essay_responses jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- reminders
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  remind_at timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- opportunity_questions
CREATE TABLE public.opportunity_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- question_answers
CREATE TABLE public.question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.opportunity_questions(id),
  user_id uuid NOT NULL,
  body text NOT NULL,
  is_accepted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- discussion_votes
CREATE TABLE public.discussion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  votable_id uuid NOT NULL,
  votable_type votable_type NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- email_verification_tokens
CREATE TABLE public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- password_reset_tokens
CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- tracking_events
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  event_type text NOT NULL,
  page_url text NOT NULL,
  referrer_url text,
  user_agent text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  screen_width integer,
  screen_height integer,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- guest_sessions
CREATE TABLE public.guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_agent text,
  converted_to_user_id uuid,
  created_at timestamptz DEFAULT now()
);

-- import_jobs
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  params jsonb NOT NULL DEFAULT '{}',
  checkpoint jsonb NOT NULL DEFAULT '{}',
  summary jsonb NOT NULL DEFAULT '{}',
  error text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_projects
CREATE TABLE public.user_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  impact text,
  tags text[],
  year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 3: VIEWS
-- ============================================================

-- public_profiles view
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT id, full_name, university, major, graduation_year, clinical_hours
FROM public.profiles;

-- opportunities_with_ratings view
CREATE VIEW public.opportunities_with_ratings WITH (security_invoker = true) AS
SELECT
  o.id, o.name, o.slug, o.type, o.location, o.address, o.latitude, o.longitude,
  o.hours_required, o.acceptance_likelihood, o.description, o.requirements,
  o.phone, o.email, o.website, o.source, o.hospital_id, o.created_by,
  o.created_at, o.updated_at,
  COALESCE(AVG(r.rating), 0) AS avg_rating,
  COUNT(r.id) AS review_count
FROM public.opportunities o
LEFT JOIN public.reviews r ON r.opportunity_id = o.id
GROUP BY o.id;

-- questions_with_votes view
CREATE VIEW public.questions_with_votes WITH (security_invoker = true) AS
SELECT
  q.id, q.opportunity_id, q.user_id, q.title, q.body, q.created_at, q.updated_at,
  p.full_name AS author_name, p.university AS author_university,
  p.major AS author_major, p.graduation_year AS author_graduation_year,
  p.clinical_hours AS author_clinical_hours,
  COALESCE(SUM(CASE WHEN dv.votable_type = 'question' THEN dv.value ELSE 0 END), 0) AS vote_count,
  (SELECT COUNT(*) FROM public.question_answers qa WHERE qa.question_id = q.id) AS answer_count
FROM public.opportunity_questions q
LEFT JOIN public.profiles p ON p.id = q.user_id
LEFT JOIN public.discussion_votes dv ON dv.votable_id = q.id AND dv.votable_type = 'question'
GROUP BY q.id, p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- answers_with_votes view
CREATE VIEW public.answers_with_votes WITH (security_invoker = true) AS
SELECT
  a.id, a.question_id, a.user_id, a.body, a.is_accepted, a.created_at, a.updated_at,
  p.full_name AS author_name, p.university AS author_university,
  p.major AS author_major, p.graduation_year AS author_graduation_year,
  p.clinical_hours AS author_clinical_hours,
  COALESCE(SUM(CASE WHEN dv.votable_type = 'answer' THEN dv.value ELSE 0 END), 0) AS vote_count
FROM public.question_answers a
LEFT JOIN public.profiles p ON p.id = a.user_id
LEFT JOIN public.discussion_votes dv ON dv.votable_id = a.id AND dv.votable_type = 'answer'
GROUP BY a.id, p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- ============================================================
-- SECTION 4: FUNCTIONS
-- ============================================================

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- get_user_hospital_account_ids
CREATE OR REPLACE FUNCTION public.get_user_hospital_account_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT account_id FROM public.hospital_members WHERE user_id = _user_id
$$;

-- calculate_distance_miles
CREATE OR REPLACE FUNCTION public.calculate_distance_miles(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $$
DECLARE
  R constant numeric := 3959;
  dLat numeric; dLon numeric; a numeric; c numeric;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN RETURN NULL; END IF;
  dLat := radians(lat2 - lat1); dLon := radians(lon2 - lon1);
  a := sin(dLat/2)*sin(dLat/2) + cos(radians(lat1))*cos(radians(lat2))*sin(dLon/2)*sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$;

-- count_opportunities
CREATE OR REPLACE FUNCTION public.count_opportunities(filter_type text DEFAULT NULL, search_term text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE result bigint; safe_search_term text;
BEGIN
  safe_search_term := CASE WHEN search_term IS NULL OR search_term = '' THEN NULL WHEN length(search_term) > 100 THEN left(search_term, 100) ELSE search_term END;
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := replace(replace(replace(safe_search_term, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;
  SELECT COUNT(*) INTO result FROM opportunities_with_ratings o
  WHERE (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL OR o.name ILIKE '%' || safe_search_term || '%' OR o.location ILIKE '%' || safe_search_term || '%');
  RETURN result;
END;
$$;

-- get_opportunities_by_distance
CREATE OR REPLACE FUNCTION public.get_opportunities_by_distance(
  user_lat numeric, user_lon numeric, filter_type text DEFAULT NULL, search_term text DEFAULT NULL,
  page_limit integer DEFAULT 20, page_offset integer DEFAULT 0, max_distance_miles numeric DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, type text, location text, address text, latitude numeric, longitude numeric,
  hours_required text, acceptance_likelihood text, description text, requirements text[], phone text, email text,
  website text, avg_rating numeric, review_count bigint, distance_miles numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE safe_search_term text;
BEGIN
  safe_search_term := CASE WHEN search_term IS NULL OR search_term = '' THEN NULL WHEN length(search_term) > 100 THEN left(search_term, 100) ELSE search_term END;
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := replace(replace(replace(safe_search_term, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.type::text, o.location, o.address, o.latitude, o.longitude, o.hours_required,
    o.acceptance_likelihood::text, o.description, o.requirements, o.phone, o.email, o.website,
    o.avg_rating, o.review_count,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) as distance_miles
  FROM opportunities_with_ratings o
  WHERE (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL OR o.name ILIKE '%' || safe_search_term || '%' OR o.location ILIKE '%' || safe_search_term || '%')
    AND (max_distance_miles IS NULL OR calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) <= max_distance_miles)
  ORDER BY CASE WHEN o.latitude IS NULL OR o.longitude IS NULL THEN 1 ELSE 0 END,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) NULLS LAST, o.name
  LIMIT page_limit OFFSET page_offset;
END;
$$;

-- add_admin_by_email
CREATE OR REPLACE FUNCTION public.add_admin_by_email(admin_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = admin_email;
  IF target_user_id IS NULL THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN TRUE;
END;
$$;

-- handle_new_user (trigger function - creates profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Anonymous User'));
  RETURN NEW;
END;
$$;

-- handle_new_user_admin_check (trigger function - auto-assign admin)
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['shivamkanodia77@gmail.com', 'ragtirup07@gmail.com'];
BEGIN
  IF NEW.email = ANY(admin_emails) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- update_updated_at_column (trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- link_opportunity_to_hospital
CREATE OR REPLACE FUNCTION public.link_opportunity_to_hospital(p_opportunity_id uuid, p_hospital_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hospital_members hm JOIN hospital_accounts ha ON ha.id = hm.account_id
    WHERE ha.hospital_id = p_hospital_id AND hm.user_id = auth.uid() AND hm.role IN ('owner', 'admin')
  ) THEN RAISE EXCEPTION 'Not authorised to link this hospital'; END IF;
  UPDATE opportunities SET hospital_id = p_hospital_id WHERE id = p_opportunity_id AND hospital_id IS NULL;
END;
$$;

-- deploy_hospital_opportunity
CREATE OR REPLACE FUNCTION public.deploy_hospital_opportunity(p_hospital_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_hospital hospitals%ROWTYPE; v_existing uuid; v_new_id uuid; v_location text; v_slug_base text; v_slug text; v_tries int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hospital_members hm JOIN hospital_accounts ha ON ha.id = hm.account_id
    WHERE ha.hospital_id = p_hospital_id AND hm.user_id = auth.uid() AND hm.role IN ('owner', 'admin')
  ) THEN RAISE EXCEPTION 'Not authorised to deploy this hospital'; END IF;
  SELECT id INTO v_existing FROM opportunities WHERE hospital_id = p_hospital_id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_hospital FROM hospitals WHERE id = p_hospital_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hospital % not found', p_hospital_id; END IF;
  v_location := TRIM(COALESCE(v_hospital.city,'') || CASE WHEN v_hospital.city IS NOT NULL AND v_hospital.state IS NOT NULL THEN ', ' ELSE '' END || COALESCE(v_hospital.state,''));
  IF v_location = '' THEN v_location := COALESCE(v_hospital.address, 'Location not specified'); END IF;
  v_slug_base := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(v_hospital.name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM opportunities WHERE slug = v_slug) LOOP v_tries := v_tries + 1; v_slug := v_slug_base || '-' || v_tries::text; END LOOP;
  INSERT INTO opportunities (name, type, location, address, website, hours_required, acceptance_likelihood, requirements, hospital_id, slug, created_by)
  VALUES (v_hospital.name, 'hospital', v_location, v_hospital.address, v_hospital.website, 'Flexible', 'medium', '{}', p_hospital_id, v_slug, auth.uid())
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

-- submit_guest_hospital_application
CREATE OR REPLACE FUNCTION public.submit_guest_hospital_application(p_account_id uuid, p_name text, p_email text, p_answers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_email text; v_app_id uuid;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF NOT (v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Invalid email address'; END IF;
  IF EXISTS (SELECT 1 FROM hospital_applications WHERE account_id = p_account_id AND student_id IS NULL AND lower(applicant_email) = v_email) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;
  INSERT INTO hospital_applications (account_id, student_id, applicant_name, applicant_email, status)
  VALUES (p_account_id, NULL, trim(p_name), v_email, 'submitted') RETURNING id INTO v_app_id;
  IF jsonb_typeof(p_answers) = 'array' AND jsonb_array_length(p_answers) > 0 THEN
    INSERT INTO hospital_application_answers (application_id, question_id, answer_text, answer_options)
    SELECT v_app_id, (elem->>'question_id')::uuid, NULLIF(trim(elem->>'answer_text'), ''),
      CASE WHEN jsonb_typeof(elem->'answer_options') = 'array' THEN elem->'answer_options' ELSE NULL END
    FROM jsonb_array_elements(p_answers) AS elem;
  END IF;
  RETURN v_app_id;
END;
$$;

-- ============================================================
-- SECTION 5: TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign admin role on signup
CREATE TRIGGER on_auth_user_created_admin_check
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_check();

-- Auto-update updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_experience_entries_updated_at BEFORE UPDATE ON public.experience_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunity_questions_updated_at BEFORE UPDATE ON public.opportunity_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_question_answers_updated_at BEFORE UPDATE ON public.question_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_projects_updated_at BEFORE UPDATE ON public.user_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospital_application_questions_updated_at BEFORE UPDATE ON public.hospital_application_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospital_applications_updated_at BEFORE UPDATE ON public.hospital_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON public.import_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SECTION 6: ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_application_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_deletion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 7: RLS POLICIES
-- ============================================================

-- === profiles ===
CREATE POLICY "Users can view own profile only" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- === user_roles ===
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- === hospitals ===
CREATE POLICY "Anyone can read hospitals" ON public.hospitals FOR SELECT USING ((status = ANY (ARRAY['seeded', 'verified'])) OR (auth.uid() = submitted_by_user_id));
CREATE POLICY "Authenticated users can insert hospitals" ON public.hospitals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update hospitals" ON public.hospitals FOR UPDATE USING (has_role(auth.uid(), 'admin') OR (auth.uid() = submitted_by_user_id));

-- === opportunities ===
CREATE POLICY "Anyone can view opportunities" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create opportunities" ON public.opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own opportunities" ON public.opportunities FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own opportunities" ON public.opportunities FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- === hospital_accounts ===
CREATE POLICY "Anyone can read hospital accounts" ON public.hospital_accounts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create hospital accounts" ON public.hospital_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Hospital owners or admins can update their account" ON public.hospital_accounts FOR UPDATE USING (id IN (SELECT account_id FROM hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- === hospital_members ===
CREATE POLICY "Members can read their own account memberships" ON public.hospital_members FOR SELECT USING ((user_id = auth.uid()) OR (account_id IN (SELECT get_user_hospital_account_ids(auth.uid()))));
CREATE POLICY "Authenticated users can insert their own membership" ON public.hospital_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can update account members" ON public.hospital_members FOR UPDATE USING ((account_id IN (SELECT get_user_hospital_account_ids(auth.uid()))) AND (EXISTS (SELECT 1 FROM hospital_members hm WHERE hm.user_id = auth.uid() AND hm.account_id = hospital_members.account_id AND hm.role = 'owner')));
CREATE POLICY "Owners can delete account members" ON public.hospital_members FOR DELETE USING ((account_id IN (SELECT get_user_hospital_account_ids(auth.uid()))) AND (EXISTS (SELECT 1 FROM hospital_members hm WHERE hm.user_id = auth.uid() AND hm.account_id = hospital_members.account_id AND hm.role = 'owner')));

-- === hospital_applications ===
CREATE POLICY "Students can create their own applications" ON public.hospital_applications FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students can read own applications" ON public.hospital_applications FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Hospital members can read their hospital applications" ON public.hospital_applications FOR SELECT USING (account_id IN (SELECT account_id FROM hospital_members WHERE user_id = auth.uid()));
CREATE POLICY "Hospital admins can update applications" ON public.hospital_applications FOR UPDATE USING (account_id IN (SELECT account_id FROM hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- === hospital_application_questions ===
CREATE POLICY "Anyone can read hospital questions" ON public.hospital_application_questions FOR SELECT USING (true);
CREATE POLICY "Hospital admins can insert questions" ON public.hospital_application_questions FOR INSERT TO authenticated WITH CHECK (account_id IN (SELECT account_id FROM hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Hospital admins can update questions" ON public.hospital_application_questions FOR UPDATE USING (account_id IN (SELECT account_id FROM hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Hospital admins can delete questions" ON public.hospital_application_questions FOR DELETE USING (account_id IN (SELECT account_id FROM hospital_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- === hospital_application_answers ===
CREATE POLICY "Students can create their own answers" ON public.hospital_application_answers FOR INSERT TO authenticated WITH CHECK (application_id IN (SELECT id FROM hospital_applications WHERE student_id = auth.uid()));
CREATE POLICY "Students can read own answers" ON public.hospital_application_answers FOR SELECT USING (application_id IN (SELECT id FROM hospital_applications WHERE student_id = auth.uid()));
CREATE POLICY "Hospital members can read their hospital answers" ON public.hospital_application_answers FOR SELECT USING (application_id IN (SELECT ha.id FROM hospital_applications ha JOIN hospital_members hm ON hm.account_id = ha.account_id WHERE hm.user_id = auth.uid()));

-- === hospital_deletion_log ===
CREATE POLICY "Only admins can read deletion logs" ON public.hospital_deletion_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can insert deletion logs" ON public.hospital_deletion_log FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- === reviews ===
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === saved_opportunities ===
CREATE POLICY "Users can view own saved opportunities" ON public.saved_opportunities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can save opportunities" ON public.saved_opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved opportunities" ON public.saved_opportunities FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved opportunities" ON public.saved_opportunities FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === experience_entries ===
CREATE POLICY "Users can view own experience entries" ON public.experience_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own experience entries" ON public.experience_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experience entries" ON public.experience_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own experience entries" ON public.experience_entries FOR DELETE USING (auth.uid() = user_id);

-- === applications ===
CREATE POLICY "Anyone can create applications" ON public.applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Opportunity owners can view applications" ON public.applications FOR SELECT USING (EXISTS (SELECT 1 FROM opportunities WHERE opportunities.id = applications.opportunity_id AND opportunities.created_by = auth.uid()));
CREATE POLICY "Opportunity owners can update applications" ON public.applications FOR UPDATE USING (EXISTS (SELECT 1 FROM opportunities WHERE opportunities.id = applications.opportunity_id AND opportunities.created_by = auth.uid()));
CREATE POLICY "Admins can manage all applications" ON public.applications FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- === reminders ===
CREATE POLICY "Users can view own reminders" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reminders" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON public.reminders FOR DELETE USING (auth.uid() = user_id);

-- === opportunity_questions ===
CREATE POLICY "Anyone can view questions" ON public.opportunity_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create questions" ON public.opportunity_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own questions" ON public.opportunity_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own questions" ON public.opportunity_questions FOR DELETE USING (auth.uid() = user_id);

-- === question_answers ===
CREATE POLICY "Anyone can view answers" ON public.question_answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create answers" ON public.question_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.question_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.question_answers FOR DELETE USING (auth.uid() = user_id);

-- === discussion_votes ===
CREATE POLICY "Users can view own votes" ON public.discussion_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can vote" ON public.discussion_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.discussion_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.discussion_votes FOR DELETE USING (auth.uid() = user_id);

-- === email_verification_tokens ===
CREATE POLICY "Deny all client access to email_verification_tokens" ON public.email_verification_tokens FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Users can view own tokens" ON public.email_verification_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert tokens" ON public.email_verification_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update tokens" ON public.email_verification_tokens FOR UPDATE USING (true);

-- === password_reset_tokens ===
CREATE POLICY "Service role can insert tokens" ON public.password_reset_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can select tokens" ON public.password_reset_tokens FOR SELECT USING (true);
CREATE POLICY "Service role can update tokens" ON public.password_reset_tokens FOR UPDATE USING (true);

-- === tracking_events ===
CREATE POLICY "Allow anonymous tracking inserts" ON public.tracking_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Only admins can read tracking events" ON public.tracking_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- === guest_sessions ===
CREATE POLICY "Allow anonymous insert" ON public.guest_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin read" ON public.guest_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- === import_jobs ===
CREATE POLICY "Admins can manage import jobs" ON public.import_jobs FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- === user_projects ===
CREATE POLICY "Users can view own projects" ON public.user_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.user_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.user_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.user_projects FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- SECTION 8: STORAGE BUCKETS
-- ============================================================
-- Run these in SQL Editor or create via Supabase Dashboard > Storage:
INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', true) ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! Next steps:
-- 1. Import your DATA (opportunities, hospitals, profiles, etc.) via CSV or pg_dump
-- 2. Migrate auth.users via pg_dump (requires direct DB access)
-- 3. Set up Edge Function secrets (RESEND_API_KEY, etc.)
-- 4. Deploy Edge Functions via: supabase functions deploy
-- 5. Update Auth redirect URLs in Supabase Dashboard
-- ============================================================
