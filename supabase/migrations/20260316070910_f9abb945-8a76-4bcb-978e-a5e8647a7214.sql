DROP VIEW IF EXISTS public.opportunities_with_ratings;

CREATE VIEW public.opportunities_with_ratings AS
SELECT o.id,
    o.type,
    o.latitude,
    o.longitude,
    o.acceptance_likelihood,
    o.created_by,
    o.created_at,
    o.updated_at,
    o.hospital_id,
    o.name,
    o.slug,
    o.location,
    o.address,
    o.description,
    o.hours_required,
    o.phone,
    o.email,
    o.website,
    o.requirements,
    o.source,
    o.logo_url,
    COALESCE(avg(r.rating), 0::numeric) AS avg_rating,
    count(r.id) AS review_count
   FROM opportunities o
     LEFT JOIN reviews r ON o.id = r.opportunity_id
  GROUP BY o.id;