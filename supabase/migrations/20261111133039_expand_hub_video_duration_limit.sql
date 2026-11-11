-- Keep the database duration constraint aligned with the video API and UI.
alter table public.hub_video_jobs
  drop constraint if exists hub_video_jobs_duration_seconds_check;

alter table public.hub_video_jobs
  add constraint hub_video_jobs_duration_seconds_check
  check (duration_seconds in (2, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60));
