
-- ============================================================
-- analytics_cohorts table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analytics_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filter_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_template boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_cohorts TO authenticated;
GRANT ALL ON public.analytics_cohorts TO service_role;

ALTER TABLE public.analytics_cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage analytics cohorts" ON public.analytics_cohorts;
CREATE POLICY "Admins manage analytics cohorts"
ON public.analytics_cohorts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_analytics_cohorts_updated_at ON public.analytics_cohorts;
CREATE TRIGGER update_analytics_cohorts_updated_at
BEFORE UPDATE ON public.analytics_cohorts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed template cohorts (idempotent on name where is_template)
INSERT INTO public.analytics_cohorts (name, description, filter_json, is_template)
SELECT v.name, v.description, v.filter_json::jsonb, true
FROM (VALUES
  ('Inactive signups (30+ days)', 'Students with no activity in the last 30 days', '{"inactive_days_min": 30}'),
  ('Saved but never applied', 'Students who saved at least one opportunity but never submitted an application', '{"saved_not_applied": true}'),
  ('Premium members', 'Students with an active premium subscription', '{"has_premium": true}'),
  ('Needs attention', 'Students flagged as needing attention', '{"needs_attention": true}'),
  ('High-hour achievers (50+)', 'Students with 50 or more logged clinical hours', '{"min_clinical_hours": 50}'),
  ('New signups (last 7 days)', 'Students who created their account in the last 7 days', '{"signed_up_days_max": 7}')
) AS v(name, description, filter_json)
WHERE NOT EXISTS (
  SELECT 1 FROM public.analytics_cohorts c WHERE c.name = v.name AND c.is_template = true
);

-- ============================================================
-- run_cohort_filter
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_cohort_filter(
  p_filter jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  full_name text,
  university text,
  major text,
  graduation_year integer,
  city text,
  state text,
  clinical_hours integer,
  is_premium boolean,
  created_at timestamptz,
  last_login_at timestamptz,
  last_active_at timestamptz,
  application_count bigint,
  pending_application_count bigint,
  clinic_count bigint,
  avg_evaluation_score numeric,
  attention_level text,
  needs_attention boolean,
  saved_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inactive_days_min integer := NULLIF(p_filter->>'inactive_days_min','')::integer;
  v_signed_up_days_max integer := NULLIF(p_filter->>'signed_up_days_max','')::integer;
  v_min_clinical_hours integer := NULLIF(p_filter->>'min_clinical_hours','')::integer;
  v_min_applications integer := NULLIF(p_filter->>'min_applications','')::integer;
  v_graduation_year integer := NULLIF(p_filter->>'graduation_year','')::integer;
  v_has_premium boolean := CASE WHEN p_filter ? 'has_premium' THEN (p_filter->>'has_premium')::boolean END;
  v_needs_attention boolean := CASE WHEN p_filter ? 'needs_attention' THEN (p_filter->>'needs_attention')::boolean END;
  v_saved_not_applied boolean := CASE WHEN p_filter ? 'saved_not_applied' THEN (p_filter->>'saved_not_applied')::boolean END;
BEGIN
  PERFORM public.assert_admin();

  RETURN QUERY
  SELECT
    s.id, s.full_name, s.university, s.major, s.graduation_year, s.city, s.state,
    s.clinical_hours, s.is_premium, s.created_at, s.last_login_at, s.last_active_at,
    s.application_count, s.pending_application_count, s.clinic_count,
    s.avg_evaluation_score, s.attention_level, s.needs_attention,
    COALESCE(sc.saved_count, 0) AS saved_count
  FROM public.admin_student_summary s
  LEFT JOIN (
    SELECT user_id, count(*) AS saved_count
    FROM public.saved_opportunities GROUP BY user_id
  ) sc ON sc.user_id = s.id
  WHERE
    (v_inactive_days_min IS NULL OR s.last_active_at IS NULL OR s.last_active_at < now() - (v_inactive_days_min || ' days')::interval)
    AND (v_signed_up_days_max IS NULL OR s.created_at >= now() - (v_signed_up_days_max || ' days')::interval)
    AND (v_min_clinical_hours IS NULL OR COALESCE(s.clinical_hours,0) >= v_min_clinical_hours)
    AND (v_min_applications IS NULL OR COALESCE(s.application_count,0) >= v_min_applications)
    AND (v_graduation_year IS NULL OR s.graduation_year = v_graduation_year)
    AND (v_has_premium IS NULL OR COALESCE(s.is_premium,false) = v_has_premium)
    AND (v_needs_attention IS NULL OR COALESCE(s.needs_attention,false) = v_needs_attention)
    AND (v_saved_not_applied IS NULL OR v_saved_not_applied = false
         OR (COALESCE(sc.saved_count,0) > 0 AND COALESCE(s.application_count,0) = 0))
  ORDER BY s.created_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit,100), 1)
  OFFSET GREATEST(COALESCE(p_offset,0), 0);
END;
$$;

-- ============================================================
-- get_student_analytics_bundle
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_analytics_bundle(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = p_user_id),
    'summary', (SELECT to_jsonb(s) FROM public.admin_student_summary s WHERE s.id = p_user_id),
    'saved_opportunities', COALESCE((SELECT jsonb_agg(to_jsonb(so) ORDER BY so.created_at DESC) FROM public.saved_opportunities so WHERE so.user_id = p_user_id), '[]'::jsonb),
    'student_applications', COALESCE((SELECT jsonb_agg(to_jsonb(sa) ORDER BY sa.submitted_at DESC) FROM public.student_applications sa WHERE sa.student_id = p_user_id), '[]'::jsonb),
    'tracking_events', COALESCE((SELECT jsonb_agg(to_jsonb(te) ORDER BY te.created_at DESC) FROM (SELECT * FROM public.tracking_events WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 200) te), '[]'::jsonb),
    'platform_events', COALESCE((SELECT jsonb_agg(to_jsonb(pe) ORDER BY pe.created_at DESC) FROM (SELECT * FROM public.platform_events WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 200) pe), '[]'::jsonb),
    'experience_entries', COALESCE((SELECT jsonb_agg(to_jsonb(ee) ORDER BY ee.entry_date DESC) FROM public.experience_entries ee WHERE ee.user_id = p_user_id), '[]'::jsonb),
    'reviews', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM public.reviews r WHERE r.user_id = p_user_id), '[]'::jsonb),
    'clinic_memberships', COALESCE((SELECT jsonb_agg(to_jsonb(cm) ORDER BY cm.created_at DESC) FROM public.clinic_members cm WHERE cm.user_id = p_user_id), '[]'::jsonb),
    'person_notes', COALESCE((SELECT jsonb_agg(to_jsonb(pn) ORDER BY pn.created_at DESC) FROM public.person_notes pn WHERE pn.student_id = p_user_id), '[]'::jsonb),
    'guest_session', (SELECT to_jsonb(gs) FROM public.guest_sessions gs WHERE gs.converted_to_user_id = p_user_id ORDER BY gs.created_at ASC LIMIT 1)
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- ============================================================
-- get_promotion_funnel
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_promotion_funnel(
  p_since timestamptz DEFAULT (now() - interval '30 days'),
  p_until timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT jsonb_build_object(
    'landing_visitors', (
      SELECT count(DISTINCT COALESCE(session_id, id::text)) FROM public.tracking_events
      WHERE created_at BETWEEN p_since AND p_until
    ),
    'guest_sessions', (
      SELECT count(*) FROM public.guest_sessions
      WHERE created_at BETWEEN p_since AND p_until
    ),
    'signups', (
      SELECT count(*) FROM public.profiles
      WHERE created_at BETWEEN p_since AND p_until
    ),
    'onboarding_complete', (
      SELECT count(*) FROM public.profiles
      WHERE created_at BETWEEN p_since AND p_until AND onboarding_complete = true
    ),
    'saved_at_least_one', (
      SELECT count(DISTINCT so.user_id) FROM public.saved_opportunities so
      JOIN public.profiles p ON p.id = so.user_id
      WHERE p.created_at BETWEEN p_since AND p_until
    ),
    'applied', (
      SELECT count(DISTINCT sa.student_id) FROM public.student_applications sa
      JOIN public.profiles p ON p.id = sa.student_id
      WHERE p.created_at BETWEEN p_since AND p_until
    ),
    'accepted', (
      SELECT count(DISTINCT sa.student_id) FROM public.student_applications sa
      JOIN public.profiles p ON p.id = sa.student_id
      WHERE p.created_at BETWEEN p_since AND p_until
        AND sa.status IN ('accepted','staff','completed')
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- Realtime publication
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
