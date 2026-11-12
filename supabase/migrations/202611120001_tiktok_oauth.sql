-- AQUI NET HUB: TikTok OAuth storage
create table if not exists public.hub_tiktok_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists hub_tiktok_oauth_states_expiry_idx on public.hub_tiktok_oauth_states(expires_at);
create table if not exists public.hub_tiktok_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  open_id text not null,
  display_name text not null default '',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  granted_scopes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.hub_tiktok_oauth_states enable row level security;
alter table public.hub_tiktok_connections enable row level security;
revoke all on public.hub_tiktok_oauth_states from anon, authenticated;
revoke all on public.hub_tiktok_connections from anon, authenticated;
