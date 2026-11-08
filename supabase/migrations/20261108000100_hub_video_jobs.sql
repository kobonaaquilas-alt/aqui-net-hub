-- AQUI NET HUB video generation jobs
create table if not exists public.hub_video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null unique,
  prompt text not null check (char_length(prompt) between 3 and 1200),
  image_url text not null check (char_length(image_url) <= 2048),
  duration_seconds integer not null check (duration_seconds between 2 and 5),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  github_run_id bigint,
  storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_video_jobs_user_created_idx
  on public.hub_video_jobs (user_id, created_at desc);

alter table public.hub_video_jobs enable row level security;

drop policy if exists "Users read own video jobs" on public.hub_video_jobs;
create policy "Users read own video jobs"
  on public.hub_video_jobs for select
  to authenticated
  using (auth.uid() = user_id);

-- Job creation and updates are server-side only via the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aqui-video-results', 'aqui-video-results', false, 104857600, array['video/mp4'])
on conflict (id) do update
set public = false, file_size_limit = 104857600, allowed_mime_types = array['video/mp4'];
