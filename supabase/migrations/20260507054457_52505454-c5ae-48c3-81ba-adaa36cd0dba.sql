create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists bcs_autoresponder_log (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  sender_email     text not null,
  subject          text,
  category         text not null check (category in ('job_inquiry', 'general')),
  responded_at     timestamptz not null default now()
);

create index if not exists bcs_autoresponder_log_message_id_idx
  on bcs_autoresponder_log (gmail_message_id);

alter table bcs_autoresponder_log enable row level security;

create policy "service role only"
  on bcs_autoresponder_log
  for all
  to service_role
  using (true)
  with check (true);

select cron.schedule(
  'bcs-email-autoresponder',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://sysbtcikrbrrgafffody.supabase.co/functions/v1/bcs-email-autoresponder',
      headers := '{"Content-Type":"application/json","x-autoresponder-secret":"emailautomation"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);