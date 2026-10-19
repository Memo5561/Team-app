-- Database guardrails (docs/security/rls-und-berechtigungen.md §9).
-- These checks inspect the catalog, so they automatically cover every table, view, policy and
-- function that later migrations add. A failure here means a migration broke a security rule.
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

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
        and not exists (
          select 1 from pg_catalog.pg_options_to_table(c.reloptions) o
           where o.option_name = 'security_invoker'
             and lower(o.option_value) in ('true', 'on', 'yes', '1')) $$,
  'every view in public runs with security_invoker (RLS of the caller applies)'
);

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and (pg_catalog.has_table_privilege('anon', c.oid,
               'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
             or pg_catalog.has_any_column_privilege('anon', c.oid,
               'SELECT, INSERT, UPDATE, REFERENCES')) $$,
  'anon holds no table- or column-level privileges on any table or view in public'
);

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        -- CASE guards evaluation order: the planner may test the privilege before the relkind filter.
        and case when c.relkind = 'S'
                 then pg_catalog.has_sequence_privilege('anon', c.oid, 'USAGE, SELECT, UPDATE')
                 else false end $$,
  'anon holds no privileges on any sequence in public'
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
        and not ('search_path=""' = any (coalesce(p.proconfig, '{}'))) $$,
  'every SECURITY DEFINER function sets search_path = '''' (empty)'
);

select is_empty(
  $$ select c.relname::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and pg_catalog.has_table_privilege('authenticated', c.oid, 'TRUNCATE, REFERENCES, TRIGGER') $$,
  'authenticated never holds TRUNCATE, REFERENCES or TRIGGER on tables in public'
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
           where i.indrelid = c.oid and i.indisunique and i.indimmediate
             and i.indpred is null and i.indexprs is null and i.indnkeyatts = 2
             and (select array_agg(a.attname::text order by a.attname)
                    from pg_catalog.pg_attribute a
                   where a.attrelid = c.oid
                     and a.attnum = any ((i.indkey::int2[])[0:1]))
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

select has_extension('extensions', 'btree_gist', 'btree_gist is installed in the extensions schema');
select ok(
  not pg_catalog.has_schema_privilege('anon', 'private', 'USAGE'),
  'anon has no access to the private schema'
);
select ok(
  not pg_catalog.has_function_privilege('authenticated', 'private.set_updated_at()', 'EXECUTE'),
  'private helpers are not executable unless granted explicitly'
);

-- RLS tests switch to the authenticated role and must still be able to call pgTAP.
set local role authenticated;
select ok(true, 'pgTAP is callable as authenticated (needed by RLS tests)');
reset role;

-- ---------------------------------------------------------------------------
-- Default privileges: objects that future migrations create (as role postgres) start closed for
-- the API roles and open for service_role. The probes run last because a table without RLS would
-- violate the first check above.
-- ---------------------------------------------------------------------------

set local role postgres;

create table public.__guardrail_probe (id integer);
create sequence public.__guardrail_probe_seq;
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
  pg_catalog.has_table_privilege('service_role', 'public.__guardrail_probe', 'SELECT')
    and pg_catalog.has_table_privilege('service_role', 'public.__guardrail_probe', 'INSERT')
    and pg_catalog.has_table_privilege('service_role', 'public.__guardrail_probe', 'UPDATE')
    and pg_catalog.has_table_privilege('service_role', 'public.__guardrail_probe', 'DELETE'),
  'new tables are fully usable by service_role (server side) by default'
);
select ok(
  not pg_catalog.has_sequence_privilege('anon', 'public.__guardrail_probe_seq', 'USAGE, SELECT, UPDATE')
    and not pg_catalog.has_sequence_privilege('authenticated', 'public.__guardrail_probe_seq', 'USAGE, SELECT, UPDATE'),
  'new sequences grant nothing to anon or authenticated by default'
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
