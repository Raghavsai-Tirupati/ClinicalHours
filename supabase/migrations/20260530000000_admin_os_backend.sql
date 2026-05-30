-- Admin OS Backend: clinic_leads, campaigns, agent system, approvals, data trust
-- All tables include audit fields; all risky actions require approval state.

---------------------------------------------------------------------------
-- CLINIC LEADS & PIPELINE
---------------------------------------------------------------------------

create table if not exists clinic_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  city text,
  state text,
  specialty text,
  source text,                        -- 'manual' | 'csv_import' | 'agent_research'
  pipeline_stage text not null default 'discovered',
  -- discovered | researched | contacted | replied | meeting | pilot | live | lost
  fit_score smallint,                 -- 0-100
  urgency_score smallint,             -- 0-100
  notes text,
  linked_hospital_id uuid references hospitals(id),
  linked_opportunity_id uuid references opportunities(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references clinic_leads(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  is_primary boolean not null default false,
  enriched_at timestamptz,
  enriched_by text,                   -- 'agent' | 'manual'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_pipeline_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references clinic_leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- CAMPAIGNS & MESSAGING
---------------------------------------------------------------------------

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  campaign_type text not null,        -- 'outreach' | 'nurture' | 'reactivation' | 'conversion'
  status text not null default 'draft', -- draft | active | paused | completed | cancelled
  audience_definition jsonb,          -- cohort query definition
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  recipient_id uuid,                  -- profiles.id or lead_contacts.id
  recipient_email text not null,
  recipient_type text not null,       -- 'student' | 'guest' | 'clinic_contact'
  subject text not null,
  body_html text not null,
  author_source text not null,        -- 'human' | 'agent'
  template_ref text,
  reasoning text,                     -- why this message was drafted
  audience_definition jsonb,
  status text not null default 'draft',
  -- draft | needs_review | approved | queued | sent | failed | cancelled
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  send_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists message_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_id uuid references campaigns(id),
  status text not null default 'active', -- active | paused | archived
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references message_sequences(id) on delete cascade,
  step_order smallint not null,
  delay_days smallint not null default 0,
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- AGENT SYSTEM
---------------------------------------------------------------------------

create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,           -- 'funnel_analyst' | 'lead_researcher' | 'outreach_drafter' | 'supply_quality' | etc.
  task_type text not null,
  status text not null default 'queued',
  -- queued | running | awaiting_approval | approved | rejected | completed | failed
  priority smallint not null default 5, -- 1 (highest) to 10
  input_data jsonb,
  output_data jsonb,
  error_message text,
  related_entity_type text,           -- 'clinic_lead' | 'campaign' | 'opportunity' | 'profile'
  related_entity_id uuid,
  created_by uuid references auth.users(id),
  assigned_to uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references agent_tasks(id) on delete cascade,
  agent_name text not null,
  run_status text not null,           -- 'started' | 'completed' | 'failed'
  duration_ms integer,
  tokens_used integer,
  log_summary text,
  created_at timestamptz not null default now()
);

create table if not exists agent_recommendations (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  recommendation_type text not null,  -- 'next_action' | 'draft' | 'alert' | 'cleanup'
  title text not null,
  body text,
  priority smallint not null default 5,
  status text not null default 'pending', -- pending | accepted | dismissed | expired
  related_entity_type text,
  related_entity_id uuid,
  expires_at timestamptz,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  dismissed_by uuid references auth.users(id),
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- APPROVAL TASKS
---------------------------------------------------------------------------

create table if not exists approval_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  approval_type text not null,        -- 'campaign_send' | 'agent_action' | 'archive_opportunity' | 'outreach_draft'
  status text not null default 'pending', -- pending | approved | rejected | expired
  requester_id uuid references auth.users(id),
  requester_source text not null,     -- 'human' | 'agent'
  approver_id uuid references auth.users(id),
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  payload jsonb,                      -- the action to execute upon approval
  related_entity_type text,
  related_entity_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- METRICS & DATA TRUST
---------------------------------------------------------------------------

create table if not exists metric_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  description text,
  source_table text,
  source_query text,
  unit text,                          -- 'count' | 'percent' | 'dollars' | 'days'
  freshness_target_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references metric_definitions(id) on delete cascade,
  value numeric not null,
  snapshot_at timestamptz not null default now(),
  computed_by text not null default 'system' -- 'system' | 'agent' | 'manual'
);

create table if not exists data_quality_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  severity text not null default 'warning', -- 'info' | 'warning' | 'critical'
  status text not null default 'open',      -- 'open' | 'investigating' | 'resolved' | 'dismissed'
  detected_by text,                   -- 'agent' | 'job' | 'manual'
  related_table text,
  related_row_id uuid,
  resolution_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- PLAYBOOKS
---------------------------------------------------------------------------

create table if not exists playbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  playbook_type text not null,        -- 'clinic_acquisition' | 'student_conversion' | 'onboarding' | 'supply_quality'
  steps jsonb not null default '[]',
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

---------------------------------------------------------------------------
-- INDEXES
---------------------------------------------------------------------------

create index if not exists clinic_leads_stage_idx on clinic_leads(pipeline_stage);
create index if not exists clinic_leads_state_idx on clinic_leads(state);
create index if not exists lead_contacts_lead_idx on lead_contacts(lead_id);
create index if not exists lead_pipeline_history_lead_idx on lead_pipeline_history(lead_id);

create index if not exists campaigns_status_idx on campaigns(status);
create index if not exists campaign_messages_status_idx on campaign_messages(status);
create index if not exists campaign_messages_campaign_idx on campaign_messages(campaign_id);

create index if not exists agent_tasks_status_idx on agent_tasks(status);
create index if not exists agent_tasks_agent_name_idx on agent_tasks(agent_name);
create index if not exists agent_tasks_entity_idx on agent_tasks(related_entity_type, related_entity_id);
create index if not exists agent_recommendations_status_idx on agent_recommendations(status);

create index if not exists approval_tasks_status_idx on approval_tasks(status);
create index if not exists approval_tasks_type_idx on approval_tasks(approval_type);

create index if not exists metric_snapshots_metric_idx on metric_snapshots(metric_id);
create index if not exists metric_snapshots_at_idx on metric_snapshots(snapshot_at desc);
create index if not exists data_quality_incidents_status_idx on data_quality_incidents(status);

---------------------------------------------------------------------------
-- RLS
---------------------------------------------------------------------------

alter table clinic_leads enable row level security;
alter table lead_contacts enable row level security;
alter table lead_pipeline_history enable row level security;
alter table campaigns enable row level security;
alter table campaign_messages enable row level security;
alter table message_sequences enable row level security;
alter table sequence_steps enable row level security;
alter table agent_tasks enable row level security;
alter table agent_runs enable row level security;
alter table agent_recommendations enable row level security;
alter table approval_tasks enable row level security;
alter table metric_definitions enable row level security;
alter table metric_snapshots enable row level security;
alter table data_quality_incidents enable row level security;
alter table playbooks enable row level security;

-- Admin-only access for all new tables
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
    execute format(
      'create policy "admin_all_%s" on %I for all using (
        exists (
          select 1 from profiles
          where profiles.id = auth.uid()
          and profiles.role = ''admin''
        )
      )', t, t
    );
  end loop;
end $$;

---------------------------------------------------------------------------
-- SEED: default metric definitions
---------------------------------------------------------------------------

insert into metric_definitions (name, display_name, description, source_table, unit, freshness_target_minutes) values
  ('total_students', 'Total Students', 'Total authenticated student profiles', 'profiles', 'count', 60),
  ('active_students_7d', 'Active Students (7d)', 'Students with tracking events in last 7 days', 'tracking_events', 'count', 60),
  ('total_guest_sessions', 'Guest Sessions', 'Total guest sessions ever created', 'guest_sessions', 'count', 120),
  ('pending_hospital_approvals', 'Pending Hospital Approvals', 'Hospital accounts awaiting admin review', 'hospital_accounts', 'count', 30),
  ('total_opportunities', 'Total Opportunities', 'All active opportunities', 'opportunities', 'count', 120),
  ('clinic_leads_in_pipeline', 'Clinic Leads in Pipeline', 'Leads not yet live', 'clinic_leads', 'count', 60),
  ('open_approvals', 'Open Approvals', 'Approval tasks pending human sign-off', 'approval_tasks', 'count', 15),
  ('pending_agent_tasks', 'Pending Agent Tasks', 'Agent tasks queued or running', 'agent_tasks', 'count', 15)
on conflict (name) do nothing;
