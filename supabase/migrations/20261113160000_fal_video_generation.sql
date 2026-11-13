-- AQUI NET HUB: direct image/text-to-video using fal queue API.
alter table public.hub_video_jobs
  add column if not exists mode text not null default 'image'
    check (mode in ('image','text')),
  add column if not exists input_storage_path text,
  add column if not exists fal_request_id text,
  add column if not exists fal_status_url text,
  add column if not exists fal_response_url text;

-- Image inputs are private; the Worker creates short-lived signed URLs for fal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aqui-video-inputs', 'aqui-video-inputs', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- fal H3 Max supports up to 15 seconds for the selected image/text endpoints.
alter table public.hub_video_jobs
  drop constraint if exists hub_video_jobs_duration_seconds_check;
alter table public.hub_video_jobs
  add constraint hub_video_jobs_duration_seconds_check
  check (duration_seconds between 2 and 15);
