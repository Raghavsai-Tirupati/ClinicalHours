-- Track account deletions (self-serve and automated cleanup)
create table if not exists public.account_deletion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  reason text not null, -- e.g. 'user_requested', 'unverified_cleanup'
  deleted_at timestamptz not null default timezone('utc', now())
);

-- Index for quick lookups by user and time
create index if not exists account_deletion_events_user_id_idx
  on public.account_deletion_events (user_id);

create index if not exists account_deletion_events_deleted_at_idx
  on public.account_deletion_events (deleted_at);

-- Basic RLS: only admins can see this table
alter table public.account_deletion_events enable row level security;

drop policy if exists "Admins can view account deletion events" on public.account_deletion_events;

create policy "Admins can view account deletion events"
on public.account_deletion_events
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Allow any role (including function owners) to insert audit rows
drop policy if exists "Any role can insert account deletion events" on public.account_deletion_events;

create policy "Any role can insert account deletion events"
on public.account_deletion_events
for insert
to public
with check (true);

-- Utility function to clean up old, unverified accounts and record why they were deleted.
create or replace function public.cleanup_unverified_accounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_email text;
begin
  for rec in
    select id
    from auth.users
    where email_confirmed_at is null
      and created_at < timezone('utc', now()) - interval '24 hours'
  loop
    -- Capture email before deleting the auth record
    select email into v_email
    from auth.users
    where id = rec.id;

    -- Remove verification tokens tied to the account before deleting the user
    delete from email_verification_tokens where user_id = rec.id;

    -- Delete dependent data that references the user
    delete from saved_opportunities where user_id = rec.id;
    delete from experience_entries where user_id = rec.id;
    delete from tracking_events where user_id = rec.id;
    delete from guest_sessions where converted_to_user_id = rec.id;
    delete from hospital_members where user_id = rec.id;

    -- Record the deletion event for audit/admin visibility
    insert into account_deletion_events (user_id, email, reason)
    values (rec.id, v_email, 'unverified_cleanup');

    -- Finally delete the profile row
    delete from profiles where id = rec.id;

    -- Remove the auth user record itself
    perform auth.delete_user(rec.id);
  end loop;
end;
$$;

grant execute on function public.cleanup_unverified_accounts() to authenticated;


