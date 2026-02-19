-- ─────────────────────────────────────────────────────────────────────────────
-- deploy_hospital_opportunity: security-definer RPC that lets a hospital
-- owner/admin publish their hospital as a student-facing opportunity.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deploy_hospital_opportunity(
  p_hospital_id uuid
)
RETURNS uuid   -- returns the (new or existing) opportunity id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital   hospitals%ROWTYPE;
  v_existing   uuid;
  v_new_id     uuid;
  v_location   text;
  v_slug_base  text;
  v_slug       text;
  v_tries      int := 0;
BEGIN
  -- ── Auth check ────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1
    FROM   hospital_members hm
    JOIN   hospital_accounts ha ON ha.id = hm.account_id
    WHERE  ha.hospital_id = p_hospital_id
      AND  hm.user_id     = auth.uid()
      AND  hm.role        IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorised to deploy this hospital';
  END IF;

  -- ── Already deployed? ─────────────────────────────────────────────────────
  SELECT id INTO v_existing
  FROM   opportunities
  WHERE  hospital_id = p_hospital_id
  LIMIT  1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- ── Fetch hospital row ────────────────────────────────────────────────────
  SELECT * INTO v_hospital FROM hospitals WHERE id = p_hospital_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hospital % not found', p_hospital_id;
  END IF;

  -- ── Build location string ─────────────────────────────────────────────────
  v_location := TRIM(
    COALESCE(v_hospital.city,  '') ||
    CASE WHEN v_hospital.city IS NOT NULL AND v_hospital.state IS NOT NULL
         THEN ', ' ELSE '' END ||
    COALESCE(v_hospital.state, '')
  );
  IF v_location = '' THEN
    v_location := COALESCE(v_hospital.address, 'Location not specified');
  END IF;

  -- ── Generate unique slug ──────────────────────────────────────────────────
  v_slug_base := LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(v_hospital.name), '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM opportunities WHERE slug = v_slug) LOOP
    v_tries := v_tries + 1;
    v_slug  := v_slug_base || '-' || v_tries::text;
  END LOOP;

  -- ── Insert the opportunity ────────────────────────────────────────────────
  INSERT INTO opportunities (
    name, type, location, address, website,
    hours_required, acceptance_likelihood,
    requirements, hospital_id, slug, created_by
  ) VALUES (
    v_hospital.name,
    'hospital',
    v_location,
    v_hospital.address,
    v_hospital.website,
    'Flexible',
    'medium',
    '{}',
    p_hospital_id,
    v_slug,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
