-- Add BCS Free Health Clinic (https://bcshealthclinic.org/)
-- Bryan/College Station, TX - free community health clinic

INSERT INTO public.opportunities (
  name,
  type,
  location,
  address,
  latitude,
  longitude,
  hours_required,
  acceptance_likelihood,
  phone,
  email,
  website,
  requirements,
  description,
  slug,
  country_code
) VALUES (
  'BCS Free Health Clinic',
  'clinic',
  'College Station, TX',
  '417 Stasney St, College Station, TX 77840',
  30.6220,
  -96.3340,
  'Varies',
  'medium',
  NULL,
  NULL,
  'https://bcshealthclinic.org/',
  '{}',
  'Striving to provide holistic healthcare services integrated with social support programs, thereby fulfilling the prophetic tradition of caring for the sick and needy. Free health clinic in Bryan/College Station.',
  'bcs-free-health-clinic',
  'US'
)
ON CONFLICT (slug) DO NOTHING;
