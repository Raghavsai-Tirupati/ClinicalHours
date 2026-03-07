
CREATE TABLE public.hospital_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_hospital_id uuid NOT NULL,
  kept_hospital_id uuid NOT NULL,
  duplicate_reason text NOT NULL,
  deleted_hospital_name text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.hospital_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read deletion logs"
  ON public.hospital_deletion_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert deletion logs"
  ON public.hospital_deletion_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));
