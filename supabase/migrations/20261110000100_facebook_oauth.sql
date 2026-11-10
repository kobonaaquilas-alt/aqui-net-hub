-- Facebook OAuth connections for AQUI NET HUB.
-- Access tokens are written/read only by the Cloudflare Worker using the Supabase service role key.
create table if not exists public.hub_facebook_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists hub_facebook_oauth_states_expires_idx on public.hub_facebook_oauth_states(expires_at);

create table if not exists public.hub_facebook_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null,
  page_name text not null,
  page_access_token text not null,
  user_access_token text,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, page_id)
);
create index if not exists hub_facebook_connections_user_idx on public.hub_facebook_connections(user_id);
alter table public.hub_facebook_oauth_states enable row level security;
alter table public.hub_facebook_connections enable row level security;
revoke all on public.hub_facebook_oauth_states from anon, authenticated;
revoke all on public.hub_facebook_connections from anon, authenticated;
