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
--   - the `auth` schema (owned by supabase_auth_admin): users, identities, auth.uid()/role()/jwt()
--   - the CLI overlay for `auto_expose_new_tables = false` (end of file)

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
create extension pgcrypto with schema extensions; -- pre-installed on the image; seeds use crypt()

create schema auth authorization supabase_auth_admin;
grant usage on schema auth to postgres, anon, authenticated, service_role;

-- Shape after GoTrue's migrations (base: supabase/postgres init-scripts/00000000000001-auth-schema.sql).
create table auth.users (
  instance_id uuid,
  id uuid not null primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text unique,
  phone_confirmed_at timestamptz,
  phone_change text default '',
  phone_change_token varchar(255) default '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  email_change_token_current varchar(255) default '',
  email_change_confirm_status smallint default 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) default '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean not null default false,
  deleted_at timestamptz,
  is_anonymous boolean not null default false
);

create table auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  email text generated always as (lower(identity_data ->> 'email')) stored,
  id uuid not null default gen_random_uuid() primary key,
  unique (provider_id, provider)
);

alter table auth.users owner to supabase_auth_admin;
alter table auth.identities owner to supabase_auth_admin;
-- Like supabase/postgres migrations/db/migrations/10000000000000_demote-postgres.sql.
grant all on all tables in schema auth to postgres;

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

-- With `auto_expose_new_tables = false` (supabase/config.toml) the CLI applies this overlay before
-- the migrations (revoke-api-privileges.sql). Mirrored here so local and CI behave the same.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
