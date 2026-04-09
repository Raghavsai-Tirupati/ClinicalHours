-- ============================================================
-- Seed default email templates for new clinics
-- Triggers on hospital_pages INSERT to pre-populate two
-- default templates: accepted and rejected.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_email_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS so the trigger can always insert
SET search_path = public
AS $$
BEGIN
  INSERT INTO email_templates (clinic_id, name, category, subject, body) VALUES

  -- Accepted template
  (
    NEW.id,
    'Acceptance Letter',
    'accepted',
    'You''ve been accepted, {{name}}!',
    'Hi {{name}},

We are thrilled to let you know that your application for the {{role}} position has been accepted!

Please plan to arrive on {{date}} for the {{shift}} shift. We''ll walk you through everything you need to know on your first day.

If you have any questions before then, feel free to reply to this email.

We look forward to having you on the team!

Warm regards,
The ClinicalHours Team'
  ),

  -- Rejected template
  (
    NEW.id,
    'Application Update',
    'rejected',
    'Update on your application, {{name}}',
    'Hi {{name}},

Thank you for taking the time to apply for the {{role}} position and for your interest in volunteering with us.

After careful consideration, we are unable to move forward with your application at this time. This was a difficult decision, as we received many strong applications.

We encourage you to check back for future openings — we would love to have you involved when the right opportunity arises.

Thank you again for your interest, and we wish you all the best.

Warm regards,
The ClinicalHours Team'
  );

  RETURN NEW;
END;
$$;

-- Fire once after each new hospital_pages row is created
CREATE TRIGGER trg_seed_default_email_templates
  AFTER INSERT ON hospital_pages
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_email_templates();
