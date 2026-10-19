-- Phase 1 (Auth): global user profile, 1:1 with auth.users (docs/architecture/datenmodell.md §3).
-- Not a tenant table: company-specific names live in memberships/employee_profiles (Phase 2+, E-17).
-- Rows are created only by the sign-up trigger below; users can read their own row. Editing comes
-- with the profile screen in a later phase (secure by default: no UPDATE grant yet).

-- ---------------------------------------------------------------------------
-- Display-name normalization, shared by the trigger and mirrored by the CHECK constraint:
-- every run of whitespace or control characters becomes one space, then trim and cut to 100.
-- Returns null when nothing is left.
-- ---------------------------------------------------------------------------

create function private.normalize_display_name(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    pg_catalog.btrim(
      pg_catalog.left(
        pg_catalog.btrim(pg_catalog.regexp_replace(raw, '[[:space:][:cntrl:]]+', ' ', 'g')),
        100
      )
    ),
    ''
  );
$$;

comment on function private.normalize_display_name(text) is
  'Collapses whitespace/control characters, trims and cuts to 100 characters; null if empty.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  locale text not null default 'de',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_valid check (
    char_length(display_name) between 1 and 100
    and display_name = btrim(display_name)
    and display_name !~ '[[:cntrl:]]'
  ),
  -- Keep in sync with the supported UI languages (src/i18n) and private.handle_new_user().
  constraint profiles_locale_supported check (locale in ('de'))
);

comment on table public.profiles is
  'Global account data (name, language, avatar), 1:1 with auth.users. Created by private.handle_new_user().';

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

grant select on public.profiles to authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sign-up trigger. raw_user_meta_data is client-controlled, so it is treated as untrusted input
-- and never makes the trigger raise: a failure here would abort the sign-up with a raw 500.
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := case
    when pg_catalog.jsonb_typeof(new.raw_user_meta_data) = 'object' then new.raw_user_meta_data
    else '{}'::jsonb
  end;
  requested_locale text := meta ->> 'locale';
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(
      private.normalize_display_name(meta ->> 'display_name'),
      private.normalize_display_name(pg_catalog.split_part(new.email, '@', 1)),
      'user'
    ),
    case when requested_locale in ('de') then requested_locale else 'de' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function private.handle_new_user() is
  'AFTER INSERT trigger on auth.users: creates the profile from the sign-up metadata (display_name, locale).';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill: accounts created before this migration (e.g. in the dashboard) get their profile the
-- same way the trigger would have created it. Idempotent; a no-op on a fresh database.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    private.normalize_display_name(
      case
        when pg_catalog.jsonb_typeof(u.raw_user_meta_data) = 'object'
          then u.raw_user_meta_data ->> 'display_name'
      end
    ),
    private.normalize_display_name(pg_catalog.split_part(u.email, '@', 1)),
    'user'
  )
from auth.users as u
on conflict (id) do nothing;
