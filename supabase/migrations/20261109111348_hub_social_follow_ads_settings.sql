-- Social audits, follow verification and public site settings.
create table if not exists public.hub_social_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  social_url text not null,
  platform text not null,
  account_name text not null,
  followers bigint not null default 0 check (followers >= 0),
  average_views bigint not null default 0 check (average_views >= 0),
  average_likes bigint not null default 0 check (average_likes >= 0),
  average_comments bigint not null default 0 check (average_comments >= 0),
  posts_per_week numeric not null default 0 check (posts_per_week >= 0),
  goal text not null default '',
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hub_social_audits_user_created_idx
  on public.hub_social_audits (user_id, created_at desc);

create table if not exists public.hub_follow_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  account_name text not null,
  tiktok_proof_url text not null,
  facebook_proof_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.hub_site_settings (
  setting_key text primary key,
  setting_value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.hub_social_audits enable row level security;
alter table public.hub_follow_verifications enable row level security;
alter table public.hub_site_settings enable row level security;

revoke all on public.hub_social_audits, public.hub_follow_verifications
  from anon, authenticated;
grant all on public.hub_social_audits, public.hub_follow_verifications
  to service_role;

revoke all on public.hub_site_settings from anon, authenticated;
grant select on public.hub_site_settings to anon, authenticated;
grant all on public.hub_site_settings to service_role;
