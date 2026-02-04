# Complete Migration Guide: Lovable Cloud → Your Own Supabase

## Your Data Summary
- **120 users** (auth accounts)
- **119 profiles**
- **6,050 opportunities** (hospitals/clinics)
- **125 saved opportunities**
- **3 experience entries**
- **2 reminders**
- **2 admin roles**

---

## Step 1: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in/create account
2. Click "New Project"
3. Choose organization, name it (e.g., "clinicalhours-prod")
4. Set a strong database password (save this!)
5. Choose region closest to your users (e.g., US East)
6. Wait for project to provision (~2 minutes)

---

## Step 2: Get Your New Project Credentials

In your new Supabase dashboard:
1. Go to **Settings → API**
2. Copy and save:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (KEEP SECRET - starts with `eyJ...`)

---

## Step 3: Create the Database Schema

Go to **SQL Editor** in your new Supabase dashboard and run each section below IN ORDER:

### 3.1 Create Enums
```sql
-- Create custom types/enums
CREATE TYPE public.acceptance_likelihood AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.opportunity_type AS ENUM ('hospital', 'clinic', 'hospice', 'emt', 'volunteer');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.votable_type AS ENUM ('question', 'answer');
```

### 3.2 Create Tables
```sql
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  university TEXT,
  major TEXT,
  graduation_year INTEGER,
  gpa NUMERIC,
  clinical_hours INTEGER DEFAULT 0,
  pre_med_track TEXT,
  bio TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  resume_url TEXT,
  linkedin_url TEXT,
  career_goals TEXT,
  research_experience TEXT,
  certifications TEXT[],
  email_verified BOOLEAN DEFAULT false,
  email_opt_in BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type opportunity_type NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  hours_required TEXT NOT NULL,
  acceptance_likelihood acceptance_likelihood NOT NULL,
  description TEXT,
  requirements TEXT[] DEFAULT '{}',
  phone TEXT,
  email TEXT,
  website TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved opportunities table
CREATE TABLE public.saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  notes TEXT,
  contacted BOOLEAN DEFAULT false,
  applied BOOLEAN DEFAULT false,
  heard_back BOOLEAN DEFAULT false,
  scheduled_interview BOOLEAN DEFAULT false,
  deadline DATE,
  is_active_experience BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Experience entries table
CREATE TABLE public.experience_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  hours NUMERIC,
  moment TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating NUMERIC NOT NULL,
  comment TEXT,
  overall_experience INTEGER,
  acceptance_difficulty INTEGER,
  staff_friendliness INTEGER,
  learning_opportunities INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reminders table
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opportunity questions table
CREATE TABLE public.opportunity_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Question answers table
CREATE TABLE public.question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Discussion votes table
CREATE TABLE public.discussion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  votable_id UUID NOT NULL,
  votable_type votable_type NOT NULL,
  value INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User projects table
CREATE TABLE public.user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT,
  tags TEXT[],
  year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email verification tokens table
CREATE TABLE public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Password reset tokens table
CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking events table
CREATE TABLE public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page_url TEXT NOT NULL,
  referrer_url TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  timezone TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guest sessions table
CREATE TABLE public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_agent TEXT,
  converted_to_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Create Foreign Keys
```sql
ALTER TABLE public.saved_opportunities 
  ADD CONSTRAINT saved_opportunities_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

ALTER TABLE public.experience_entries 
  ADD CONSTRAINT experience_entries_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

ALTER TABLE public.reviews 
  ADD CONSTRAINT reviews_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

ALTER TABLE public.reviews 
  ADD CONSTRAINT reviews_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.reminders 
  ADD CONSTRAINT reminders_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

ALTER TABLE public.opportunity_questions 
  ADD CONSTRAINT opportunity_questions_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

ALTER TABLE public.question_answers 
  ADD CONSTRAINT question_answers_question_id_fkey 
  FOREIGN KEY (question_id) REFERENCES public.opportunity_questions(id);

ALTER TABLE public.opportunities 
  ADD CONSTRAINT opportunities_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);
```

### 3.4 Create Views
```sql
-- Public profiles view (hides sensitive data)
CREATE VIEW public.public_profiles 
WITH (security_invoker=on) AS
SELECT 
  id,
  full_name,
  university,
  major,
  graduation_year,
  clinical_hours
FROM public.profiles;

-- Opportunities with ratings view
CREATE VIEW public.opportunities_with_ratings AS
SELECT 
  o.*,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as review_count
FROM public.opportunities o
LEFT JOIN public.reviews r ON o.id = r.opportunity_id
GROUP BY o.id;

-- Questions with votes view
CREATE VIEW public.questions_with_votes AS
SELECT 
  q.*,
  p.full_name as author_name,
  p.university as author_university,
  p.major as author_major,
  p.graduation_year as author_graduation_year,
  p.clinical_hours as author_clinical_hours,
  COALESCE(SUM(v.value), 0) as vote_count,
  COUNT(DISTINCT a.id) as answer_count
FROM public.opportunity_questions q
LEFT JOIN public.profiles p ON q.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
LEFT JOIN public.question_answers a ON a.question_id = q.id
GROUP BY q.id, p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Answers with votes view
CREATE VIEW public.answers_with_votes AS
SELECT 
  a.*,
  p.full_name as author_name,
  p.university as author_university,
  p.major as author_major,
  p.graduation_year as author_graduation_year,
  p.clinical_hours as author_clinical_hours,
  COALESCE(SUM(v.value), 0) as vote_count
FROM public.question_answers a
LEFT JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
GROUP BY a.id, p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;
```

### 3.5 Create Database Functions
```sql
-- has_role function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Anonymous User')
  );
  RETURN NEW;
END;
$$;

-- Auto-assign admin role for specific emails
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['shivamkanodia77@gmail.com', 'ragtirup07@gmail.com'];
BEGIN
  IF NEW.email = ANY(admin_emails) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Calculate distance in miles
CREATE OR REPLACE FUNCTION public.calculate_distance_miles(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  R constant numeric := 3959;
  dLat numeric;
  dLon numeric;
  a numeric;
  c numeric;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  a := sin(dLat / 2) * sin(dLat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dLon / 2) * sin(dLon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN R * c;
END;
$$;

-- Get opportunities by distance
CREATE OR REPLACE FUNCTION public.get_opportunities_by_distance(
  user_lat numeric, 
  user_lon numeric, 
  filter_type text DEFAULT NULL, 
  search_term text DEFAULT NULL, 
  page_limit integer DEFAULT 20, 
  page_offset integer DEFAULT 0, 
  max_distance_miles numeric DEFAULT NULL
)
RETURNS TABLE(
  id uuid, name text, type text, location text, address text,
  latitude numeric, longitude numeric, hours_required text,
  acceptance_likelihood text, description text, requirements text[],
  phone text, email text, website text, avg_rating numeric,
  review_count bigint, distance_miles numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  safe_search_term text;
BEGIN
  safe_search_term := CASE 
    WHEN search_term IS NULL OR search_term = '' THEN NULL
    WHEN length(search_term) > 100 THEN left(search_term, 100)
    ELSE search_term
  END;
  
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := replace(replace(replace(safe_search_term, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  RETURN QUERY
  SELECT 
    o.id, o.name, o.type::text, o.location, o.address,
    o.latitude, o.longitude, o.hours_required,
    o.acceptance_likelihood::text, o.description, o.requirements,
    o.phone, o.email, o.website, o.avg_rating, o.review_count,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) as distance_miles
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL
         OR o.name ILIKE '%' || safe_search_term || '%' 
         OR o.location ILIKE '%' || safe_search_term || '%')
    AND (max_distance_miles IS NULL 
         OR calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) <= max_distance_miles)
  ORDER BY 
    CASE WHEN o.latitude IS NULL OR o.longitude IS NULL THEN 1 ELSE 0 END,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) NULLS LAST,
    o.name
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Count opportunities
CREATE OR REPLACE FUNCTION public.count_opportunities(filter_type text DEFAULT NULL, search_term text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result bigint;
  safe_search_term text;
BEGIN
  safe_search_term := CASE 
    WHEN search_term IS NULL OR search_term = '' THEN NULL
    WHEN length(search_term) > 100 THEN left(search_term, 100)
    ELSE search_term
  END;
  
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := replace(replace(replace(safe_search_term, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  SELECT COUNT(*)
  INTO result
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL
         OR o.name ILIKE '%' || safe_search_term || '%' 
         OR o.location ILIKE '%' || safe_search_term || '%');
  
  RETURN result;
END;
$$;

-- Add admin by email
CREATE OR REPLACE FUNCTION public.add_admin_by_email(admin_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = admin_email;
  
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;
```

### 3.6 Create Triggers
```sql
-- Auto-create profile on auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign admin role
CREATE TRIGGER on_auth_user_created_admin_check
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_check();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_opportunities_updated_at
  BEFORE UPDATE ON public.saved_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_experience_entries_updated_at
  BEFORE UPDATE ON public.experience_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunity_questions_updated_at
  BEFORE UPDATE ON public.opportunity_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_question_answers_updated_at
  BEFORE UPDATE ON public.question_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_projects_updated_at
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 3.7 Enable RLS and Create Policies
```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile only" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Opportunities policies
CREATE POLICY "Anyone can view opportunities" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create opportunities" ON public.opportunities FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own opportunities" ON public.opportunities FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own opportunities" ON public.opportunities FOR DELETE USING (auth.uid() = created_by);

-- Saved opportunities policies
CREATE POLICY "Users can view own saved opportunities" ON public.saved_opportunities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save opportunities" ON public.saved_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved opportunities" ON public.saved_opportunities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved opportunities" ON public.saved_opportunities FOR DELETE USING (auth.uid() = user_id);

-- Experience entries policies
CREATE POLICY "Users can view own experience entries" ON public.experience_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own experience entries" ON public.experience_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experience entries" ON public.experience_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own experience entries" ON public.experience_entries FOR DELETE USING (auth.uid() = user_id);

-- Reviews policies
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- Reminders policies
CREATE POLICY "Users can view own reminders" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reminders" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON public.reminders FOR DELETE USING (auth.uid() = user_id);

-- Questions policies
CREATE POLICY "Anyone can view questions" ON public.opportunity_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create questions" ON public.opportunity_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own questions" ON public.opportunity_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own questions" ON public.opportunity_questions FOR DELETE USING (auth.uid() = user_id);

-- Answers policies
CREATE POLICY "Anyone can view answers" ON public.question_answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create answers" ON public.question_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.question_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.question_answers FOR DELETE USING (auth.uid() = user_id);

-- Votes policies
CREATE POLICY "Users can view own votes" ON public.discussion_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can vote" ON public.discussion_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.discussion_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.discussion_votes FOR DELETE USING (auth.uid() = user_id);

-- User projects policies
CREATE POLICY "Users can view own projects" ON public.user_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.user_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.user_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.user_projects FOR DELETE USING (auth.uid() = user_id);

-- Token policies
CREATE POLICY "Deny all client access to email_verification_tokens" ON public.email_verification_tokens FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Service role can insert tokens" ON public.email_verification_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update tokens" ON public.email_verification_tokens FOR UPDATE USING (true);
CREATE POLICY "Users can view own tokens" ON public.email_verification_tokens FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert password tokens" ON public.password_reset_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can select password tokens" ON public.password_reset_tokens FOR SELECT USING (true);
CREATE POLICY "Service role can update password tokens" ON public.password_reset_tokens FOR UPDATE USING (true);

-- Tracking policies
CREATE POLICY "Allow anonymous tracking inserts" ON public.tracking_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can read tracking events" ON public.tracking_events FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- Guest sessions policies
CREATE POLICY "Allow anonymous insert" ON public.guest_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin read" ON public.guest_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
```

---

## Step 4: Export Auth Users (IMPORTANT!)

You need to export users from the OLD database. Since you don't have direct Supabase dashboard access, I'll export this data for you.

**Ask me to run:** "Export my auth users for migration"

I'll generate a file with all user data including:
- User IDs (UUIDs)
- Emails
- Encrypted passwords (bcrypt hashes)
- Email confirmation status
- Metadata

---

## Step 5: Export All Data

**Ask me to run:** "Export all my data tables for migration"

I'll generate SQL INSERT statements for:
- profiles (119 records)
- opportunities (6,050 records)
- saved_opportunities (125 records)
- experience_entries (3 records)
- reminders (2 records)
- user_roles (2 records)

---

## Step 6: Import Auth Users to New Project

In your NEW Supabase dashboard:
1. Go to **SQL Editor**
2. Paste the auth users SQL I provide
3. Run it

This preserves:
- Same user IDs
- Same password hashes (users can login with same password!)
- Email verification status

---

## Step 7: Import All Data

In your NEW Supabase dashboard:
1. Go to **SQL Editor**
2. Paste each data export SQL I provide
3. Run them in order (profiles first, then opportunities, then the rest)

---

## Step 8: Create Storage Buckets

In your new Supabase dashboard, go to **Storage** and create:

1. **resumes** (private bucket)
   - Toggle OFF "Public bucket"
   
2. **email-assets** (public bucket)
   - Toggle ON "Public bucket"

Then add storage policies in SQL Editor:
```sql
-- Resume policies
CREATE POLICY "Users can upload own resume"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own resume"
ON storage.objects FOR SELECT
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own resume"
ON storage.objects FOR UPDATE
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own resume"
ON storage.objects FOR DELETE
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Email assets (public read)
CREATE POLICY "Public can view email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

CREATE POLICY "Admins can manage email assets"
ON storage.objects FOR ALL
USING (bucket_id = 'email-assets' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));
```

---

## Step 9: Configure Google OAuth

In your new Supabase dashboard:
1. Go to **Authentication → Providers**
2. Enable **Google**
3. Enter your existing Google OAuth credentials:
   - Client ID
   - Client Secret
4. Add your callback URL to Google Cloud Console:
   - `https://YOUR-NEW-PROJECT.supabase.co/auth/v1/callback`

---

## Step 10: Set Up Edge Function Secrets

In your new Supabase dashboard, go to **Settings → Edge Functions → Secrets**:

Add these secrets:
- `RESEND_API_KEY` - your Resend API key
- `MAPBOX_PUBLIC_TOKEN` - your Mapbox token

---

## Step 11: Deploy Edge Functions

Copy your edge functions from `/supabase/functions/` to your new project.

You can do this via:
1. Supabase CLI: `supabase functions deploy`
2. Or manually via dashboard

---

## Step 12: Update Your Frontend

Update `.env` with your new project credentials:
```
VITE_SUPABASE_URL="https://YOUR-NEW-PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-new-anon-key"
VITE_SUPABASE_PROJECT_ID="your-new-project-id"
```

Then update `src/integrations/supabase/client.ts` to use the new URL and key.

---

## Step 13: Test Everything

1. Try logging in with an existing account
2. Verify Google sign-in works
3. Check that opportunities load
4. Test saving an opportunity
5. Verify admin dashboard works

---

## Step 14: Update DNS (if using custom domain)

If clinicalhours.org points to Supabase for auth callbacks, update it to your new project.

---

## Rollback Plan

Keep your Lovable Cloud project unchanged until you've verified everything works in the new project. You can always switch back by reverting the `.env` changes.

---

## Need Help?

Ask me to:
- "Export my auth users for migration"
- "Export all my data tables for migration"
- "Help me test the migration"
