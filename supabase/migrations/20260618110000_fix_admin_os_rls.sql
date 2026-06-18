-- Fix Admin OS RLS: profiles.role does not exist; use has_role() instead

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clinic_leads', 'lead_contacts', 'lead_pipeline_history',
    'campaigns', 'campaign_messages', 'message_sequences', 'sequence_steps',
    'agent_tasks', 'agent_runs', 'agent_recommendations',
    'approval_tasks', 'metric_definitions', 'metric_snapshots',
    'data_quality_incidents', 'playbooks'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "admin_all_%s" ON public.%I FOR ALL
       USING (public.has_role(auth.uid(), ''admin''::public.app_role))
       WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))',
      t, t
    );
  END LOOP;
END $$;
