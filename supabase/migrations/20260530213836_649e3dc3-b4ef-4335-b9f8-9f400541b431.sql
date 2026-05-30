-- CLINIC LEADS & PIPELINE

create table if not exists public.clinic_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  city text,
  state text,
  specialty text,
  source text,
  pipeline_stage text not null default 'discovered',
  fit_score smallint,
  urgency_score smallint,
  notes text,
  linked_hospital_id uuid references public.hospitals(id),
  linked_opportunity_id uuid references public.opportunities(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.clinic_leads(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  is_primary boolean not null default false,
  enriched_at timestamptz,
  enriched_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_pipeline_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.clinic_leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

-- CAMPAIGNS & MESSAGING

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  campaign_type text not null,
  status text not null default 'draft',
  audience_definition jsonb,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  recipient_id uuid,
  recipient_email text not null,
  recipient_type text not null,
  subject text not null,
  body_html text not null,
  author_source text not null,
  template_ref text,
  reasoning text,
  audience_definition jsonb,
  status text not null default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  send_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_id uuid references public.campaigns(id),
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.message_sequences(id) on delete cascade,
  step_order smallint not null,
  delay_days smallint not null default 0,
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AGENT SYSTEM

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  task_type text not null,
  status text not null default 'queued',
  priority smallint not null default 5,
  input_data jsonb,
  output_data jsonb,
  error_message text,
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid references auth.users(id),
  assigned_to uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  agent_name text not null,
  run_status text not null,
  duration_ms integer,
  tokens_used integer,
  log_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_recommendations (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  recommendation_type text not null,
  title text not null,
  body text,
  priority smallint not null default 5,
  status text not null default 'pending',
  related_entity_type text,
  related_entity_id uuid,
  expires_at timestamptz,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  dismissed_by uuid references auth.users(id),
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

-- APPROVAL TASKS

create table if not exists public.approval_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  approval_type text not null,
  status text not null default 'pending',
  requester_id uuid references auth.users(id),
  requester_source text not null,
  approver_id uuid references auth.users(id),
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  payload jsonb,
  related_entity_type text,
  related_entity_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- METRICS & DATA TRUST

create table if not exists public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  description text,
  source_table text,
  source_query text,
  unit text,
  freshness_target_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.metric_definitions(id) on delete cascade,
  value numeric not null,
  snapshot_at timestamptz not null default now(),
  computed_by text not null default 'system'
);

create table if not exists public.data_quality_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  severity text not null default 'warning',
  status text not null default 'open',
  detected_by text,
  related_table text,
  related_row_id uuid,
  resolution_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  playbook_type text not null,
  steps jsonb not null default '[]',
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INDEXES

create index if not exists clinic_leads_stage_idx on public.clinic_leads(pipeline_stage);
create index if not exists lead_contacts_lead_idx on public.lead_contacts(lead_id);
create index if not exists lead_pipeline_history_lead_idx on public.lead_pipeline_history(lead_id);
create index if not exists campaigns_status_idx on public.campaigns(status);
create index if not exists campaign_messages_status_idx on public.campaign_messages(status);
create index if not exists campaign_messages_campaign_idx on public.campaign_messages(campaign_id);
create index if not exists agent_tasks_status_idx on public.agent_tasks(status);
create index if not exists agent_tasks_agent_name_idx on public.agent_tasks(agent_name);
create index if not exists agent_recommendations_status_idx on public.agent_recommendations(status);
create index if not exists approval_tasks_status_idx on public.approval_tasks(status);
create index if not exists metric_snapshots_metric_idx on public.metric_snapshots(metric_id);
create index if not exists metric_snapshots_at_idx on public.metric_snapshots(snapshot_at desc);
create index if not exists data_quality_incidents_status_idx on public.data_quality_incidents(status);

-- GRANTS, RLS & POLICIES (admin-only, role stored in user_roles via has_role())

do $$
declare
  t text;
  tables text[] := array[
    'clinic_leads','lead_contacts','lead_pipeline_history',
    'campaigns','campaign_messages','message_sequences','sequence_steps',
    'agent_tasks','agent_runs','agent_recommendations',
    'approval_tasks','metric_definitions','metric_snapshots',
    'data_quality_incidents','playbooks'
  ];
begin
  foreach t in array tables loop
    -- Data API access (RLS still restricts to admins; service_role for edge functions)
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);

    -- Enable RLS
    execute format('alter table public.%I enable row level security', t);

    -- Admin-only policy using the project standard has_role() against user_roles
    execute format('drop policy if exists "admin_all_%s" on public.%I', t, t);
    execute format(
      'create policy "admin_all_%s" on public.%I for all to authenticated
         using (public.has_role(auth.uid(), ''admin''))
         with check (public.has_role(auth.uid(), ''admin''))',
      t, t
    );
  end loop;
end $$;

-- Seed metric definitions

insert into public.metric_definitions (name, display_name, description, source_table, unit, freshness_target_minutes) values
  ('total_students', 'Total Students', 'Total authenticated student profiles', 'profiles', 'count', 60),
  ('active_students_7d', 'Active Students (7d)', 'Students with activity in last 7 days', 'tracking_events', 'count', 60),
  ('total_guest_sessions', 'Guest Sessions', 'Total guest sessions ever created', 'guest_sessions', 'count', 120),
  ('pending_hospital_approvals', 'Pending Hospital Approvals', 'Hospital accounts awaiting review', 'hospital_accounts', 'count', 30),
  ('total_opportunities', 'Total Opportunities', 'All active opportunities', 'opportunities', 'count', 120),
  ('clinic_leads_in_pipeline', 'Clinic Leads in Pipeline', 'Leads not yet live or lost', 'clinic_leads', 'count', 60),
  ('open_approvals', 'Open Approvals', 'Approval tasks pending sign-off', 'approval_tasks', 'count', 15),
  ('pending_agent_tasks', 'Pending Agent Tasks', 'Agent tasks queued or running', 'agent_tasks', 'count', 15)
on conflict (name) do nothing;