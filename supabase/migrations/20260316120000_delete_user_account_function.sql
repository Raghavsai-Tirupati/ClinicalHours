-- Create or replace RPC for users to delete their own account
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Capture the email before deleting the auth record
  select email into v_email
  from auth.users
  where id = v_user_id;

  -- Remove verification tokens tied to the account before deleting the user
  delete from email_verification_tokens where user_id = v_user_id;

  -- Delete dependent data that references the user
  delete from saved_opportunities where user_id = v_user_id;
  delete from experience_entries where user_id = v_user_id;
  delete from tracking_events where user_id = v_user_id;
  delete from guest_sessions where converted_to_user_id = v_user_id;
  delete from hospital_members where user_id = v_user_id;

  -- Record the deletion event for audit/admin visibility
  insert into account_deletion_events (user_id, email, reason)
  values (v_user_id, v_email, 'user_requested');

  -- Finally delete the profile row
  delete from profiles where id = v_user_id;

  -- Remove the auth user record itself
  perform auth.delete_user(v_user_id);
end;
$$;

-- Allow authenticated users to call this function
grant execute on function public.delete_user_account() to authenticated;

