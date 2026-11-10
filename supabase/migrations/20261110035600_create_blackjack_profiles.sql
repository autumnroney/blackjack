-- Player profiles for the Blackjack site (blackjack57.netlify.app).
-- Separate from public.profiles, which belongs to Basketwise (same Supabase project).
-- Already applied to project ymomfylsgfkipdnohzgp; kept here for reference.
create table public.blackjack_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  bio text not null default ''
    check (char_length(bio) <= 160),
  avatar_url text
    check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 1000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index blackjack_profiles_username_key on public.blackjack_profiles (username);

comment on table public.blackjack_profiles is
  'Blackjack player profiles: username, display name, bio, avatar. One row per signed-in user.';

create or replace function public.blackjack_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger blackjack_profiles_updated_at
  before update on public.blackjack_profiles
  for each row execute function public.blackjack_set_updated_at();

alter table public.blackjack_profiles enable row level security;

create policy "Players read their own profile"
  on public.blackjack_profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Players create their own profile"
  on public.blackjack_profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Players update their own profile"
  on public.blackjack_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Players delete their own profile"
  on public.blackjack_profiles for delete to authenticated
  using ((select auth.uid()) = id);

revoke all on public.blackjack_profiles from anon;
grant select, insert, update, delete on public.blackjack_profiles to authenticated;
