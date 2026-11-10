create table if not exists public.hub_browser_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null unique,
  target_url text not null check (char_length(target_url) <= 2048),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  result jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  github_run_id bigint,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_browser_jobs_user_created_idx
  on public.hub_browser_jobs (user_id, created_at desc);

create unique index if not exists hub_browser_jobs_one_active_per_user
  on public.hub_browser_jobs (user_id)
  where status in ('queued', 'running');

alter table public.hub_browser_jobs enable row level security;

create policy "Users read own browser jobs"
  on public.hub_browser_jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.hub_browser_jobs to authenticated;
grant all on public.hub_browser_jobs to service_role;
