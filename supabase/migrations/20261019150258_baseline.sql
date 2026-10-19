-- TeamPanel baseline (Phase 0). No business tables yet.
--
-- Establishes the guardrails every later migration builds on
-- (docs/security/rls-und-berechtigungen.md §2):
--   1. extensions live in the `extensions` schema, never in `public`
--   2. a non-exposed `private` schema for helpers, outbox and internal tables
--   3. secure-by-default privileges: new objects in `public` grant nothing to anon/authenticated
--   4. shared trigger helpers

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
-- No citext: inside `search_path = ''` functions its operators silently fall back to case-sensitive
-- text comparison. E-mail columns are plain text normalized to lower case instead
-- (docs/architecture/datenmodell.md §1).
create extension if not exists btree_gist with schema extensions;  -- exclusion constraints (shifts, leave)

-- ---------------------------------------------------------------------------
-- 2. Private schema
--    Not listed in the API's exposed schemas (supabase/config.toml [api].schemas), so nothing in
--    it is reachable through PostgREST. `authenticated` needs USAGE so RLS policies can call the
--    SECURITY DEFINER helpers that will live here; EXECUTE is still granted per function.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Secure-by-default privileges for objects created by migrations (role postgres)
--    Supabase grants anon/authenticated full access to every new object in `public` and relies on
--    RLS alone. TeamPanel revokes that default: every table and function must be granted
--    explicitly, on top of RLS (defense in depth). service_role (server only, bypasses RLS) gets its
--    access explicitly below, so behaviour does not depend on the hosted project's
--    "default privileges for new entities" setting (supabase/config.toml: auto_expose_new_tables).
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC globally; that can only be revoked globally.
-- Note: this applies to every function role postgres creates in ANY schema, including functions of
-- extensions that postgres installs later. Grant EXECUTE explicitly where clients need it.
alter default privileges for role postgres
  revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 4. Shared trigger helpers
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function private.set_updated_at() is
  'BEFORE UPDATE trigger: keeps updated_at current. Attach to every table with an updated_at column.';
