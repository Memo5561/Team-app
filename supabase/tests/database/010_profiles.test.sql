-- public.profiles and the sign-up trigger (supabase/migrations/20261019185317_profiles.sql):
-- structure, privileges and policies, how private.handle_new_user() turns untrusted sign-up
-- metadata into a valid profile, RLS isolation between users, and the cascade from auth.users.
begin;

create extension if not exists pgtap with schema extensions;
\ir ../helpers/auth.psql

select plan(79);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'profiles', 'public.profiles exists');
select columns_are(
  'public', 'profiles',
  array['id', 'display_name', 'locale', 'avatar_path', 'created_at', 'updated_at'],
  'profiles has exactly the Phase 1 columns'
);
select col_type_is('public', 'profiles', 'id', 'uuid', 'id is uuid');
select col_type_is('public', 'profiles', 'display_name', 'text', 'display_name is text');
select col_type_is('public', 'profiles', 'locale', 'text', 'locale is text');
select col_type_is('public', 'profiles', 'avatar_path', 'text', 'avatar_path is text');
select col_type_is('public', 'profiles', 'created_at', 'timestamp with time zone', 'created_at is timestamptz');
select col_type_is('public', 'profiles', 'updated_at', 'timestamp with time zone', 'updated_at is timestamptz');
select col_not_null('public', 'profiles', 'id', 'id is not null');
select col_not_null('public', 'profiles', 'display_name', 'display_name is not null');
select col_not_null('public', 'profiles', 'locale', 'locale is not null');
select col_is_null('public', 'profiles', 'avatar_path', 'avatar_path is optional');
select col_not_null('public', 'profiles', 'created_at', 'created_at is not null');
select col_not_null('public', 'profiles', 'updated_at', 'updated_at is not null');
select col_default_is('public', 'profiles', 'locale', 'de'::text, 'locale defaults to de');
select col_default_is('public', 'profiles', 'created_at', 'now()'::text, 'created_at defaults to now()');
select col_default_is('public', 'profiles', 'updated_at', 'now()'::text, 'updated_at defaults to now()');
select col_is_pk('public', 'profiles', 'id', 'id is the primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'id references auth.users (id)');
select is(
  (select c.confdeltype::text
     from pg_catalog.pg_constraint c
    where c.conrelid = 'public.profiles'::regclass and c.contype = 'f'),
  'c',
  'the foreign key to auth.users cascades on delete'
);
select set_eq(
  $$ select c.conname::text
       from pg_catalog.pg_constraint c
      where c.conrelid = 'public.profiles'::regclass and c.contype = 'c' $$,
  array['profiles_display_name_valid', 'profiles_locale_supported'],
  'profiles has the display-name and locale CHECK constraints'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.profiles'::regclass),
  'row level security is enabled on profiles'
);

-- ---------------------------------------------------------------------------
-- Policies and privileges: read own row only; no writes from clients in Phase 1
-- ---------------------------------------------------------------------------

select policies_are('public', 'profiles', array['profiles_select_own'], 'profiles has exactly one policy');
select policy_cmd_is('public', 'profiles', 'profiles_select_own', 'select', 'profiles_select_own is a SELECT policy');
select policy_roles_are(
  'public', 'profiles', 'profiles_select_own', array['authenticated'],
  'profiles_select_own applies to authenticated only'
);
select table_privs_are(
  'public', 'profiles', 'authenticated', array['SELECT'],
  'authenticated may only SELECT profiles'
);
select table_privs_are('public', 'profiles', 'anon', array[]::name[], 'anon has no privileges on profiles');
select is_empty(
  $$ select a.attname::text
       from pg_catalog.pg_attribute a
      where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped
        and (pg_catalog.has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT, UPDATE, REFERENCES')
             or pg_catalog.has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT, INSERT, UPDATE, REFERENCES')) $$,
  'no column of profiles is writable by authenticated or accessible to anon (no column grants)'
);

-- ---------------------------------------------------------------------------
-- Triggers and functions
-- ---------------------------------------------------------------------------

select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users has the sign-up trigger');
select trigger_is(
  'auth', 'users', 'on_auth_user_created', 'private', 'handle_new_user',
  'on_auth_user_created calls private.handle_new_user()'
);
select ok(
  exists (select 1
            from pg_catalog.pg_trigger t
           where t.tgrelid = 'auth.users'::regclass and t.tgname = 'on_auth_user_created'
             and t.tgtype = 5 -- ROW (1) | INSERT (4), neither BEFORE (2) nor INSTEAD (64)
             and t.tgenabled = 'O'),
  'on_auth_user_created fires AFTER INSERT FOR EACH ROW and is enabled'
);
select trigger_is(
  'public', 'profiles', 'profiles_set_updated_at', 'private', 'set_updated_at',
  'profiles_set_updated_at calls private.set_updated_at()'
);
select is_definer(
  'private', 'handle_new_user', array[]::name[],
  'private.handle_new_user() is SECURITY DEFINER (GoTrue''s role has no rights on public.profiles)'
);
select is(
  (select p.proconfig from pg_catalog.pg_proc p where p.oid = 'private.handle_new_user()'::regprocedure),
  array['search_path=""'],
  'private.handle_new_user() pins search_path to empty and sets nothing else'
);
select function_owner_is(
  'private', 'handle_new_user', array[]::name[], 'postgres',
  'private.handle_new_user() is owned by postgres (the owner of public.profiles)'
);
select ok(
  not pg_catalog.has_function_privilege('anon', 'private.handle_new_user()', 'EXECUTE')
    and not pg_catalog.has_function_privilege('authenticated', 'private.handle_new_user()', 'EXECUTE'),
  'private.handle_new_user() is not executable by anon or authenticated'
);
select isnt_definer(
  'private', 'normalize_display_name', array['text'],
  'private.normalize_display_name(text) runs as invoker'
);
select volatility_is(
  'private', 'normalize_display_name', array['text'], 'immutable',
  'private.normalize_display_name(text) is immutable'
);
select ok(
  not pg_catalog.has_function_privilege('anon', 'private.normalize_display_name(text)', 'EXECUTE')
    and not pg_catalog.has_function_privilege(
      'authenticated', 'private.normalize_display_name(text)', 'EXECUTE'
    ),
  'private.normalize_display_name(text) is not executable by anon or authenticated'
);

-- ---------------------------------------------------------------------------
-- Sign-up trigger: raw_user_meta_data is client-controlled. Every case must yield a valid profile;
-- an exception here would abort the sign-up (and this file). Test users live in the reserved
-- .test domain so they never collide with seed users.
-- ---------------------------------------------------------------------------

do $$
begin
  perform tests.create_user('anna@profiles.test', '{"display_name": "Anna Muster", "locale": "de"}');
  perform tests.create_user('bert@profiles.test', '{"display_name": "Bert Beispiel"}');
  perform tests.create_user('spaces@profiles.test', '{"display_name": "   Clara    Weiß  "}');
  perform tests.create_user(
    'control@profiles.test', '{"display_name": "\tDora\t\nDemo\r\u0007\u001b\u007fX\n"}'
  );
  perform tests.create_user('long@profiles.test', jsonb_build_object('display_name', repeat('a', 150)));
  perform tests.create_user(
    'cut@profiles.test', jsonb_build_object('display_name', repeat('a', 99) || ' ' || repeat('b', 50))
  );
  perform tests.create_user('unicode@profiles.test', '{"display_name": "Jürgen Öztürk-Weiß 🎉"}');
  perform tests.create_user('emoji@profiles.test', jsonb_build_object('display_name', repeat('😀', 150)));
  perform tests.create_user('max.mustermann+teampanel@profiles.test', '{"display_name": ""}');
  perform tests.create_user('blank@profiles.test', '{"display_name": " \t\n "}');
  perform tests.create_user('jsonnull@profiles.test', '{"display_name": null}');
  perform tests.create_user('nometa@profiles.test', null);
  perform tests.create_user('emptymeta@profiles.test', '{}');
  perform tests.create_user('array@profiles.test', '["Anna"]');
  perform tests.create_user('string@profiles.test', '"Anna"');
  perform tests.create_user('english@profiles.test', '{"display_name": "Emma", "locale": "en"}');
  perform tests.create_user('numlocale@profiles.test', '{"display_name": "Nina", "locale": 7}');
  perform tests.create_user(
    'extra@profiles.test',
    '{"display_name": "Eva", "id": "00000000-0000-4000-8000-000000000001",
      "avatar_path": "../../other-org/avatar.png", "created_at": "2000-01-01T00:00:00Z"}'
  );
  perform tests.create_user(null, null);
end;
$$;

select is(
  (select display_name from public.profiles where id = tests.user_id('anna@profiles.test')),
  'Anna Muster', 'a regular display name is stored as given'
);
select is(
  (select locale from public.profiles where id = tests.user_id('anna@profiles.test')),
  'de', 'a supported locale is stored'
);
select is(
  (select locale from public.profiles where id = tests.user_id('bert@profiles.test')),
  'de', 'a missing locale defaults to de'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('spaces@profiles.test')),
  'Clara Weiß', 'leading, trailing and repeated spaces are collapsed and trimmed'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('control@profiles.test')),
  'Dora Demo X', 'tabs, newlines and control characters become single spaces'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('long@profiles.test')),
  repeat('a', 100), 'a 150-character name is cut to 100 characters'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('cut@profiles.test')),
  repeat('a', 99), 'a name cut at a space is trimmed again (no trailing space)'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('unicode@profiles.test')),
  'Jürgen Öztürk-Weiß 🎉', 'umlauts, ß and emoji are kept'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('emoji@profiles.test')),
  repeat('😀', 100), 'the 100-character limit counts characters, not bytes'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('max.mustermann+teampanel@profiles.test')),
  'max.mustermann+teampanel', 'an empty name falls back to the local part of the e-mail address'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('blank@profiles.test')),
  'blank', 'a whitespace-only name falls back to the e-mail local part'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('jsonnull@profiles.test')),
  'jsonnull', 'a JSON null name falls back to the e-mail local part'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('nometa@profiles.test')),
  'nometa', 'missing metadata (null) falls back to the e-mail local part'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('emptymeta@profiles.test')),
  'emptymeta', 'metadata without display_name falls back to the e-mail local part'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('array@profiles.test')),
  'array', 'array metadata is ignored'
);
select is(
  (select display_name from public.profiles where id = tests.user_id('string@profiles.test')),
  'string', 'string metadata is ignored'
);
select is(
  (select locale from public.profiles where id = tests.user_id('english@profiles.test')),
  'de', 'an unsupported locale falls back to de'
);
select is(
  (select locale from public.profiles where id = tests.user_id('numlocale@profiles.test')),
  'de', 'a non-string locale falls back to de'
);
select ok(
  exists (select 1
            from public.profiles p
           where p.id = tests.user_id('extra@profiles.test') and p.display_name = 'Eva'
             and p.avatar_path is null and p.created_at = now()),
  'id, avatar_path and created_at in the metadata are ignored'
);
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001' $$,
  'metadata cannot choose the profile id'
);
select is(
  (select p.display_name
     from public.profiles p join auth.users u on u.id = p.id
    where u.email is null and u.created_at = now()), -- now(): created in this transaction
  'user', 'without name and e-mail the display name is "user"'
);
select lives_ok(
  $$ select tests.create_user('nested@profiles.test', '{"display_name": {"x": [1, 2]}, "locale": null}') $$,
  'a non-string display_name does not abort the sign-up'
);
select is_empty(
  $$ select u.id from auth.users u left join public.profiles p on p.id = u.id where p.id is null $$,
  'every auth user got a profile'
);

-- GoTrue inserts as supabase_auth_admin, which has no rights on public or private; only the
-- SECURITY DEFINER trigger makes this work. Skipped where postgres may not assume that role.
do $$
begin
  perform tests.create_user_as('supabase_auth_admin', 'gotrue@profiles.test', '{"display_name": " Über GoTrue "}');
end;
$$;

select case
  when tests.user_id('gotrue@profiles.test') is null
    then skip('postgres may not switch to supabase_auth_admin in this database', 1)
  else is(
    (select display_name from public.profiles where id = tests.user_id('gotrue@profiles.test')),
    'Über GoTrue',
    'a sign-up inserted as supabase_auth_admin (like GoTrue) gets its profile'
  )
end;

-- ---------------------------------------------------------------------------
-- Constraints and updated_at (as postgres, i.e. bypassing the missing client grants)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.profiles set display_name = ' Bert' where id = tests.user_id('bert@profiles.test') $$,
  '23514', null, 'CHECK rejects a display name with leading space'
);
select throws_ok(
  $$ update public.profiles set display_name = '' where id = tests.user_id('bert@profiles.test') $$,
  '23514', null, 'CHECK rejects an empty display name'
);
select throws_ok(
  $$ update public.profiles set display_name = repeat('x', 101) where id = tests.user_id('bert@profiles.test') $$,
  '23514', null, 'CHECK rejects a display name longer than 100 characters'
);
select throws_ok(
  $$ update public.profiles set display_name = E'Bert\tBeispiel' where id = tests.user_id('bert@profiles.test') $$,
  '23514', null, 'CHECK rejects control characters in the display name'
);
select throws_ok(
  $$ update public.profiles set locale = 'en' where id = tests.user_id('bert@profiles.test') $$,
  '23514', null, 'CHECK rejects an unsupported locale'
);

update public.profiles set updated_at = '2000-01-01T00:00:00Z' where id = tests.user_id('bert@profiles.test');
select is(
  (select updated_at from public.profiles where id = tests.user_id('bert@profiles.test')),
  now(), 'updates keep updated_at current'
);

-- ---------------------------------------------------------------------------
-- RLS: every user sees only their own profile; clients cannot write
-- ---------------------------------------------------------------------------

select tests.as_user('anna@profiles.test');

select results_eq(
  'select id from public.profiles',
  $$ select tests.user_id('anna@profiles.test') $$,
  'Anna sees exactly her own profile'
);
select is_empty(
  $$ select 1 from public.profiles where id = tests.user_id('bert@profiles.test') $$,
  'Bert''s profile is invisible to Anna, even when queried by id'
);
select throws_ok(
  $$ update public.profiles set display_name = 'Gehackt' where id = auth.uid() $$,
  '42501', null, 'authenticated cannot update profiles, not even their own'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values (auth.uid(), 'Zweitprofil') $$,
  '42501', null, 'authenticated cannot insert profiles'
);
select throws_ok(
  $$ delete from public.profiles where id = auth.uid() $$,
  '42501', null, 'authenticated cannot delete profiles'
);

select tests.as_user('bert@profiles.test');

select results_eq(
  'select id from public.profiles',
  $$ select tests.user_id('bert@profiles.test') $$,
  'Bert sees exactly his own profile'
);

select tests.reset_auth();
set local role authenticated;

select is_empty('select 1 from public.profiles', 'authenticated without JWT claims sees no profiles');

select tests.as_anon();

select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');

select tests.reset_auth();

select is(
  (select display_name from public.profiles where id = tests.user_id('anna@profiles.test')),
  'Anna Muster', 'the rejected writes changed nothing'
);

-- ---------------------------------------------------------------------------
-- Deleting the auth user deletes the profile
-- ---------------------------------------------------------------------------

select tests.user_id('bert@profiles.test') as bert_id \gset
delete from auth.users where id = :'bert_id';

select is_empty(
  format('select 1 from public.profiles where id = %L', :'bert_id'),
  'deleting the auth user deletes the profile'
);

select * from finish();

rollback;
