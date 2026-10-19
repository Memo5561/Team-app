-- E-46 (docs/architecture/entscheidungen-und-risiken.md): a password that was set before an account's
-- first e-mail confirmation does not survive that confirmation.
--
-- Attack (pre-account takeover): someone signs up with another person's address and their own password
-- (POST /auth/v1/signup works without the app). The account stays unconfirmed. When the owner of the
-- address later clicks a confirmation link — the one the attacker triggered, or the one their own
-- sign-up resends — the account is confirmed with the attacker's password. The app no longer asks for a
-- password at sign-up (accounts are always created by e-mail link, the password follows after the
-- confirmation), and this trigger closes the direct API path as well.
--
-- Facts from the Supabase Auth (GoTrue) source, v2.197.0 = the image of Supabase CLI 2.121 (unchanged on
-- master for everything below), github.com/supabase/auth/blob/v2.197.0/…:
--   - Sign-up with a password (internal/api/signup.go): INSERT with encrypted_password = bcrypt hash,
--     email_confirmed_at and confirmation_sent_at null, confirmation_token ''; in the same transaction
--     sendConfirmation (internal/api/mail.go) sets confirmation_token and confirmation_sent_at. A repeated
--     sign-up for an existing unconfirmed user changes nothing on the row ("do not update the user
--     because we can't be sure of their claimed identity") and only resends the confirmation.
--   - signInWithOtp for a new or unconfirmed user (internal/api/magic_link.go) runs the same sign-up with
--     a random temporary password, so "password-less" users have an unknown hash, not an empty one.
--   - Confirmation via /verify (signup, invite, email and magiclink token hashes; internal/api/verify.go)
--     and the recovery link of a still unconfirmed user (recoverVerify confirms the address, too) end in
--     User.Confirm (internal/models/user.go): one
--       UPDATE auth.users SET confirmation_token, email_confirmed_at, updated_at WHERE id = …
--     followed by updates of raw_user_meta_data / raw_app_meta_data only. GoTrue writes columns with
--     UpdateOnly, never the whole row, and reloads the user after /verify, so the in-memory old hash is
--     never written back.
--   - admin.createUser with email_confirm: true (internal/api/admin.go): INSERT, then Confirm() in the
--     same transaction. No mail is sent, confirmation_sent_at stays null.
--   - Invites (sendInvite) set confirmation_sent_at. For an invited user without a password, signupVerify
--     first stores a random password via UpdatePassword, which resets confirmation_sent_at to null, and
--     then confirms.
--   - updateUser({ password }) / recovery store the password with UpdatePassword: encrypted_password plus
--     token columns (confirmation_sent_at := null), never email_confirmed_at.
--   - "No password": NewUser writes '' when no password is given; SetPassword('') and GoTrue's own
--     pre-account-takeover defence for OAuth sign-ins on unconfirmed accounts
--     (User.RemoveUnconfirmedIdentities) write NULL. The column is nullable, and HasPassword /
--     Authenticate treat both alike: password sign-in answers invalid_credentials (internal/api/token.go).
--
-- Hence the condition: the UPDATE sets email_confirmed_at for the first time (old null, new not null)
-- AND a confirmation e-mail had been sent (old.confirmation_sent_at not null). That covers every
-- self-service confirmation (sign-up, sign-in link, recovery link, invite on a pre-registered address),
-- and leaves alone:
--   - admin.createUser with email_confirm: true (confirmation_sent_at null): the admin's password stays;
--   - passwords set after the confirmation (updateUser, recovery): email_confirmed_at is not touched;
--   - every other update (last_sign_in_at, metadata, resent confirmations): email_confirmed_at unchanged;
--   - a password written by the confirming statement itself (only possible from privileged SQL): it was
--     not set before the confirmation.
-- The password becomes NULL, like GoTrue's own reset in RemoveUnconfirmedIdentities.
-- Known effects: admin.generateLink({ type: 'signup', password }) sends a confirmation, so such accounts
-- lose that password when the link is used (create confirmed users with admin.createUser instead). Phone
-- sign-up is disabled; a phone account would lose its password on its first e-mail confirmation.

-- SECURITY DEFINER with an empty search_path like private.handle_new_user(), so it does not depend on
-- the privileges of GoTrue's role; it reads and writes nothing but the row being updated.
create function private.clear_password_before_first_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null
     and new.email_confirmed_at is not null
     and old.confirmation_sent_at is not null
     and new.encrypted_password is not distinct from old.encrypted_password
  then
    new.encrypted_password := null;
  end if;
  return new;
end;
$$;

comment on function private.clear_password_before_first_confirmation() is
  'BEFORE UPDATE trigger on auth.users (E-46): removes a password set before the first e-mail '
  'confirmation when that confirmation comes from a confirmation e-mail (confirmation_sent_at set).';

-- Deliberately without a column list (`update of email_confirmed_at`): PostgreSQL records a dependency
-- on every listed column, and then refuses ALTER COLUMN … TYPE / DROP COLUMN on it. auth.users belongs
-- to Supabase Auth, whose own migrations must stay free to change that column. The function checks
-- old/new itself and returns at once for every update that does not confirm.
create trigger on_auth_user_first_confirmation
  before update on auth.users
  for each row execute function private.clear_password_before_first_confirmation();
