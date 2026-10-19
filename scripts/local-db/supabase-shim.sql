-- Stand-in for the parts of the Supabase Postgres image that TeamPanel's migrations and database
-- tests rely on. Used ONLY by scripts/db-test-local.sh in environments without Docker registry
-- access; CI runs the real Supabase image and stays authoritative.
--
-- Executed as the bootstrap superuser `supabase_admin` (like the real image). Mirrors:
--   - `postgres` as a NON-superuser that owns the database and runs migrations and tests
--   - API roles anon / authenticated / service_role, granted to postgres
--   - Supabase's permissive default privileges for role postgres in schema public
--     (which the baseline migration revokes)
--   - the `extensions` schema with pgTAP pre-installed by supabase_admin (supautils treats pgtap as
--     a privileged extension, so its functions stay executable by the API roles)
--   - the `auth` schema (owned by supabase_auth_admin) with auth.uid()/auth.role()/auth.jwt()

create role postgres login createdb createrole replication bypassrls;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
create role supabase_auth_admin nologin noinherit;
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres with admin option;

alter database postgres owner to postgres;
alter schema public owner to postgres;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

create schema extensions;
grant usage, create on schema extensions to postgres;
grant usage on schema extensions to anon, authenticated, service_role;
alter database postgres set search_path = "$user", public, extensions;
create extension pgtap with schema extensions;

create schema auth authorization supabase_auth_admin;
grant usage on schema auth to postgres, anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table auth.users owner to supabase_auth_admin;
grant select, references on auth.users to postgres;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

alter function auth.jwt() owner to supabase_auth_admin;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
grant execute on function auth.jwt(), auth.uid(), auth.role()
  to postgres, anon, authenticated, service_role;
