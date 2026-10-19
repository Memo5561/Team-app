-- Database guardrails (docs/security/rls-und-berechtigungen.md §9).
-- These checks inspect the catalog, so they automatically cover every table, view, policy and
-- function that later migrations add. A failure here means a migration broke a security rule.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Structural rules for everything in the exposed `public` schema
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

select is_empty(
  $$ select tablename || '.' || policyname
       from pg_catalog.pg_policies
      where schemaname = 'public' and roles && array['anon', 'public']::name[] $$,
  'no policy in public applies to anon or public'
);

select is_empty(
  $$ select tablename || '.' || policyname
       from pg_catalog.pg_policies
      where schemaname = 'public' and cmd = 'ALL' $$,
  'no policy in public uses FOR ALL (one policy per operation)'
);

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')
        and not coalesce(c.reloptions @> array['security_invoker=true'], false) $$,
  'every view in public runs with security_invoker (RLS of the caller applies)'
);

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and pg_catalog.has_table_privilege('anon', c.oid,
              'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') $$,
  'anon holds no privileges on any table or view in public'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'anon cannot execute any function in public'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
                         where cfg like 'search_path=%') $$,
  'every SECURITY DEFINER function pins its search_path'
);

-- ---------------------------------------------------------------------------
-- Multi-tenancy rules (docs/architecture/datenmodell.md §1)
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and exists (select 1 from pg_catalog.pg_attribute a
                     where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped)
        and exists (select 1 from pg_catalog.pg_attribute a
                     where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped)
        and not exists (
          select 1 from pg_catalog.pg_index i
           where i.indrelid = c.oid and i.indisunique and i.indpred is null and i.indnatts = 2
             and (select array_agg(a.attname::text order by a.attname)
                    from pg_catalog.pg_attribute a
                   where a.attrelid = c.oid and a.attnum = any (i.indkey::int2[]))
                 = array['id', 'organization_id']) $$,
  'every tenant table has unique (organization_id, id) as target for composite foreign keys'
);

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and exists (select 1 from pg_catalog.pg_attribute a
                     where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped)
        and not exists (select 1 from pg_catalog.pg_policies p
                         where p.schemaname = 'public' and p.tablename = c.relname and p.cmd = 'SELECT') $$,
  'every tenant table has a SELECT policy'
);

-- ---------------------------------------------------------------------------
-- Baseline objects
-- ---------------------------------------------------------------------------

select has_extension('extensions', 'citext', 'citext is installed in the extensions schema');
select has_extension('extensions', 'btree_gist', 'btree_gist is installed in the extensions schema');
select ok(
  not pg_catalog.has_schema_privilege('anon', 'private', 'USAGE'),
  'anon has no access to the private schema'
);
select ok(
  not pg_catalog.has_function_privilege('authenticated', 'private.set_updated_at()', 'EXECUTE'),
  'private helpers are not executable unless granted explicitly'
);

-- ---------------------------------------------------------------------------
-- Default privileges: objects that future migrations create (as role postgres) start closed.
-- The probes run last because a table without RLS would violate the first check above.
-- ---------------------------------------------------------------------------

set local role postgres;

create table public.__guardrail_probe (id integer);
create function public.__guardrail_probe_fn() returns integer language sql as 'select 1';

select ok(
  not pg_catalog.has_table_privilege('anon', 'public.__guardrail_probe', 'SELECT, INSERT, UPDATE, DELETE'),
  'new tables grant nothing to anon by default'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.__guardrail_probe', 'SELECT, INSERT, UPDATE, DELETE'),
  'new tables grant nothing to authenticated by default'
);
select ok(
  not pg_catalog.has_function_privilege('anon', 'public.__guardrail_probe_fn()', 'EXECUTE'),
  'new functions are not executable by anon by default'
);
select ok(
  not pg_catalog.has_function_privilege('authenticated', 'public.__guardrail_probe_fn()', 'EXECUTE'),
  'new functions are not executable by authenticated by default'
);

select * from finish();

rollback;
