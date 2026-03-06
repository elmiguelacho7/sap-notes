-- Helper: get_my_profile_id (profiles.id = auth.uid())
create or replace function public.get_my_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

-- Helper: superadmin check
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.get_my_profile_id()
      and p.app_role = 'superadmin'
  )
$$;

-- Helper: project membership check for OTHER table policies
-- row_security off prevents RLS recursion when used from other table policies
create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_uuid
      and pm.profile_id = public.get_my_profile_id()
  )
$$;

grant execute on function public.get_my_profile_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;

-- Rebuild project_members policies with NO recursion
alter table public.project_members enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='project_members'
  loop
    execute format('drop policy if exists %I on public.project_members;', pol.policyname);
  end loop;
end $$;

-- SELECT: only own row OR superadmin (no membership check -> no recursion)
create policy "project_members_select_own_or_superadmin"
on public.project_members
for select
to authenticated
using (
  public.is_superadmin()
  OR profile_id = public.get_my_profile_id()
);

-- Write operations: superadmin only (safe default)
create policy "project_members_insert_superadmin"
on public.project_members
for insert
to authenticated
with check (public.is_superadmin());

create policy "project_members_update_superadmin"
on public.project_members
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "project_members_delete_superadmin"
on public.project_members
for delete
to authenticated
using (public.is_superadmin());
