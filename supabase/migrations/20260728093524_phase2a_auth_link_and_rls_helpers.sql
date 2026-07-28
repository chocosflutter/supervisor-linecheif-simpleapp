-- Phase 2 (a): link app users to auth.users + RLS helper functions.
-- Helpers are SECURITY DEFINER so they bypass RLS on public.users (avoids policy
-- recursion) and read the caller's identity from auth.uid(). search_path is locked.

alter table public.users
  add constraint users_auth_user_fk
  foreign key (auth_user_id) references auth.users(id) on delete set null;

create or replace function public.current_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_factory_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select factory_id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users where auth_user_id = auth.uid() and role = 'super_admin');
$$;

-- Same factory as caller (super admin passes for any factory).
create or replace function public.same_factory(p_factory_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or public.current_factory_id() = p_factory_id;
$$;

-- IE (or super admin) managing config/master/structure of a given factory.
create or replace function public.can_manage_factory(p_factory_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or (public.current_user_role() = 'ie' and public.current_factory_id() = p_factory_id);
$$;

-- READ visibility for a line: super=all; ie=whole factory; chief=owned; supervisor=assigned.
create or replace function public.can_access_line(p_line_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1
      from public.users u
      join public.lines l on l.id = p_line_id and l.factory_id = u.factory_id
      where u.auth_user_id = auth.uid()
        and (
          u.role = 'ie'
          or (u.role = 'chief' and exists (select 1 from public.line_chiefs lc where lc.line_id = p_line_id and lc.user_id = u.id))
          or (u.role = 'supervisor' and exists (select 1 from public.line_supervisors ls where ls.line_id = p_line_id and ls.user_id = u.id))
        )
    )
  end;
$$;

-- WRITE entry (attendance/production/downtime): supervisor assigned to the line, or super admin.
create or replace function public.can_enter_line(p_line_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.users u
        join public.line_supervisors ls on ls.line_id = p_line_id and ls.user_id = u.id
        where u.auth_user_id = auth.uid() and u.role = 'supervisor'
      );
$$;

-- LOAD style to a line: chief who owns the line, or super admin.
create or replace function public.can_load_line(p_line_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.users u
        join public.line_chiefs lc on lc.line_id = p_line_id and lc.user_id = u.id
        where u.auth_user_id = auth.uid() and u.role = 'chief'
      );
$$;
;
