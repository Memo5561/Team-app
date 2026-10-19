-- E-46: the trigger on_auth_user_first_confirmation on auth.users and
-- private.clear_password_before_first_confirmation()
-- (supabase/migrations/20261019204325_clear_password_before_first_confirmation.sql). A password set
-- before the first e-mail confirmation does not survive a confirmation that comes from a confirmation
-- e-mail; admin-created users and passwords set after the confirmation keep theirs.
--
-- The helpers replay GoTrue's statements (tests/helpers/auth.psql: sign_up = INSERT + sendConfirmation,
-- confirm_email = User.Confirm). Password hashes are opaque to the trigger; readable stand-ins keep the
-- expectations obvious. That GoTrue then refuses password sign-in for an account without a hash is
-- covered by tests/integration/password-guard.test.ts against the real Auth server.
begin;

create extension if not exists pgtap with schema extensions;
\ir ../helpers/auth.psql

select plan(25);

-- ---------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------

select has_trigger(
  'auth', 'users', 'on_auth_user_first_confirmation', 'auth.users has the first-confirmation trigger'
);
select trigger_is(
  'auth', 'users', 'on_auth_user_first_confirmation', 'private', 'clear_password_before_first_confirmation',
  'on_auth_user_first_confirmation calls private.clear_password_before_first_confirmation()'
);
select ok(
  exists (select 1
            from pg_catalog.pg_trigger t
           where t.tgrelid = 'auth.users'::regclass and t.tgname = 'on_auth_user_first_confirmation'
             and t.tgtype = 19 -- ROW (1) | BEFORE (2) | UPDATE (16)
             -- No column list: it would pin auth.users.email_confirmed_at against ALTER/DROP COLUMN
             -- in Supabase Auth's own migrations (pg_depend).
             and t.tgattr::text = ''
             and t.tgqual is null
             and t.tgenabled = 'O'),
  'the trigger fires BEFORE UPDATE FOR EACH ROW, without column list or WHEN clause, and is enabled'
);
select is_empty(
  $$ select 1
       from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_trigger'::regclass
        and d.objid = (select t.oid
                         from pg_catalog.pg_trigger t
                        where t.tgrelid = 'auth.users'::regclass
                          and t.tgname = 'on_auth_user_first_confirmation')
        and d.refobjid = 'auth.users'::regclass
        and d.refobjsubid <> 0 $$,
  'the trigger depends on no single column of auth.users'
);
select is_definer(
  'private', 'clear_password_before_first_confirmation', array[]::name[],
  'private.clear_password_before_first_confirmation() is SECURITY DEFINER'
);
select is(
  (select p.proconfig
     from pg_catalog.pg_proc p
    where p.oid = 'private.clear_password_before_first_confirmation()'::regprocedure),
  array['search_path=""'],
  'private.clear_password_before_first_confirmation() pins search_path to empty and sets nothing else'
);
select function_owner_is(
  'private', 'clear_password_before_first_confirmation', array[]::name[], 'postgres',
  'private.clear_password_before_first_confirmation() is owned by postgres'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon', 'private.clear_password_before_first_confirmation()', 'EXECUTE'
  )
    and not pg_catalog.has_function_privilege(
      'authenticated', 'private.clear_password_before_first_confirmation()', 'EXECUTE'
    ),
  'private.clear_password_before_first_confirmation() is not executable by anon or authenticated'
);

-- ---------------------------------------------------------------------------
-- Behaviour as postgres. Accounts as GoTrue leaves them before the step under test.
-- ---------------------------------------------------------------------------

do $$
begin
  -- Self-service sign-ups: unconfirmed, confirmation e-mail sent.
  perform tests.sign_up('attacker@guard.test', 'hash-attacker');     -- signUp with a password (API)
  perform tests.sign_up('link@guard.test', 'hash-temporary');        -- signInWithOtp: random password
  perform tests.sign_up('recovery@guard.test', 'hash-attacker');     -- confirmed by a recovery link
  perform tests.sign_up('pending@guard.test', 'hash-attacker');      -- not confirmed (yet)
  perform tests.sign_up('same-statement@guard.test', 'hash-attacker');
  -- admin.createUser({ password, email_confirm: true }) before its Confirm(): no e-mail sent.
  perform tests.create_user('admin@guard.test', '{}', 'hash-admin', false);
  -- Invite of a new address (no password), invite e-mail sent.
  perform tests.create_user('invited@guard.test', '{}', '', false);
  update auth.users
     set confirmation_token = 'invite-token', confirmation_sent_at = now(), invited_at = now()
   where id = tests.user_id('invited@guard.test');
  -- Signed up with a password and confirmed before this migration: confirmed, with a password, and
  -- confirmation_sent_at still set (Confirm() does not reset it).
  perform tests.create_user('confirmed@guard.test', '{}', 'hash-confirmed', true);
  update auth.users
     set confirmation_sent_at = now() - interval '1 day'
   where id = tests.user_id('confirmed@guard.test');
end;
$$;

-- The attack (E-46): the confirmation link the attacker triggered, or the one a later sign-up resends.
select tests.confirm_email('attacker@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('attacker@guard.test')),
  null,
  'a confirmation from a confirmation e-mail removes the password set before it'
);
select ok(
  (select email_confirmed_at = now() and confirmation_token = ''
     from auth.users
    where id = tests.user_id('attacker@guard.test')),
  'the confirmation itself is stored unchanged'
);

select tests.confirm_email('link@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('link@guard.test')),
  null,
  'a sign-up by e-mail link loses its temporary random password, so the first password is a new one'
);

-- recoverVerify on an unconfirmed user: Recover() clears the recovery token, then Confirm().
update auth.users set recovery_token = '' where id = tests.user_id('recovery@guard.test');
select tests.confirm_email('recovery@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('recovery@guard.test')),
  null,
  'a recovery link that confirms an unconfirmed account removes the password, too'
);

-- Updates before the confirmation: a resent confirmation e-mail, metadata, a write of
-- email_confirmed_at that does not confirm.
update auth.users
   set confirmation_token = 'resent-token', confirmation_sent_at = now()
 where id = tests.user_id('pending@guard.test');
update auth.users
   set raw_user_meta_data = '{"display_name": "Noch Offen"}'
 where id = tests.user_id('pending@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('pending@guard.test')),
  'hash-attacker',
  'updates that do not confirm leave the password of an unconfirmed account alone'
);

update auth.users set email_confirmed_at = null where id = tests.user_id('pending@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('pending@guard.test')),
  'hash-attacker',
  'writing email_confirmed_at without confirming changes nothing'
);

-- Only privileged SQL can confirm and set a password in one statement; that password was not set
-- before the confirmation.
update auth.users
   set email_confirmed_at = now(), encrypted_password = 'hash-set-while-confirming'
 where id = tests.user_id('same-statement@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('same-statement@guard.test')),
  'hash-set-while-confirming',
  'a password written by the confirming statement itself is kept'
);

select tests.confirm_email('admin@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('admin@guard.test')),
  'hash-admin',
  'admin.createUser with email_confirm (no confirmation e-mail) keeps its password'
);

-- signupVerify for an invited user without password: UpdatePassword stores a random password and
-- resets the token columns (confirmation_sent_at := null), then Confirm().
update auth.users
   set encrypted_password = 'hash-invite-random', confirmation_token = '', confirmation_sent_at = null,
       recovery_token = '', recovery_sent_at = null
 where id = tests.user_id('invited@guard.test');
select tests.confirm_email('invited@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('invited@guard.test')),
  'hash-invite-random',
  'an invite keeps the random password GoTrue stores right before the confirmation'
);

-- Already confirmed accounts: admin.updateUserById({ email_confirm: true }) runs Confirm() again,
-- every sign-in writes last_sign_in_at, updateUser({ password }) runs UpdatePassword.
select tests.confirm_email('confirmed@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('confirmed@guard.test')),
  'hash-confirmed',
  'confirming an already confirmed account again keeps its password'
);

update auth.users set last_sign_in_at = now() where id = tests.user_id('confirmed@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('confirmed@guard.test')),
  'hash-confirmed',
  'a sign-in (last_sign_in_at) keeps the password'
);

update auth.users
   set encrypted_password = 'hash-changed', confirmation_token = '', confirmation_sent_at = null,
       recovery_token = '', recovery_sent_at = null
 where id = tests.user_id('confirmed@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('confirmed@guard.test')),
  'hash-changed',
  'a password changed after the confirmation is kept'
);

-- The owner of the attacked address sets their own password after the confirmation (the optional
-- "Passwort festlegen" step), then signs in with it.
update auth.users
   set encrypted_password = 'hash-owner', confirmation_token = '', confirmation_sent_at = null,
       recovery_token = '', recovery_sent_at = null
 where id = tests.user_id('attacker@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('attacker@guard.test')),
  'hash-owner',
  'a password set after the first confirmation is kept'
);

update auth.users set last_sign_in_at = now() where id = tests.user_id('attacker@guard.test');

select is(
  (select encrypted_password from auth.users where id = tests.user_id('attacker@guard.test')),
  'hash-owner',
  'and survives later updates'
);

-- ---------------------------------------------------------------------------
-- As GoTrue's role. Skipped where postgres may not assume supabase_auth_admin.
-- ---------------------------------------------------------------------------

do $$
begin
  if tests.run_as(
    'supabase_auth_admin', $sql$ select tests.sign_up('gotrue-signup@guard.test', 'hash-attacker') $sql$
  ) then
    perform tests.run_as('supabase_auth_admin', $sql$ select tests.confirm_email('gotrue-signup@guard.test') $sql$);
    perform tests.run_as(
      'supabase_auth_admin',
      $sql$ select tests.create_user('gotrue-admin@guard.test', '{}', 'hash-admin', false) $sql$
    );
    perform tests.run_as('supabase_auth_admin', $sql$ select tests.confirm_email('gotrue-admin@guard.test') $sql$);
  end if;
end;
$$;

select case
  when tests.user_id('gotrue-signup@guard.test') is null
    then skip('postgres may not switch to supabase_auth_admin in this database', 2)
  else collect_tap(
    is(
      (select encrypted_password from auth.users where id = tests.user_id('gotrue-signup@guard.test')),
      null,
      'as supabase_auth_admin (like GoTrue): a self-service confirmation removes the password'
    ),
    is(
      (select encrypted_password from auth.users where id = tests.user_id('gotrue-admin@guard.test')),
      'hash-admin',
      'as supabase_auth_admin (like GoTrue): an admin-created user keeps its password'
    )
  )
end;

do $$
begin
  if tests.user_id('gotrue-signup@guard.test') is not null then
    perform tests.run_as(
      'supabase_auth_admin',
      $sql$ update auth.users
               set encrypted_password = 'hash-owner', confirmation_token = '', confirmation_sent_at = null
             where id = tests.user_id('gotrue-signup@guard.test') $sql$
    );
  end if;
end;
$$;

select case
  when tests.user_id('gotrue-signup@guard.test') is null
    then skip('postgres may not switch to supabase_auth_admin in this database', 1)
  else is(
    (select encrypted_password from auth.users where id = tests.user_id('gotrue-signup@guard.test')),
    'hash-owner',
    'as supabase_auth_admin (like GoTrue): a password set after the confirmation is kept'
  )
end;

select * from finish();

rollback;
