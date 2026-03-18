-- Persist dashboard tutorial state on profiles so onboarding can be deterministic.
alter table public.profiles
add column if not exists dashboard_tutorial_complete boolean not null default false;

-- Existing users should not re-see the tutorial after this migration.
update public.profiles
set dashboard_tutorial_complete = true
where dashboard_tutorial_complete is distinct from true;

