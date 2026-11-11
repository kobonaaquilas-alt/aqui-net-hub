-- Allow paid video jobs up to the original 10-second backend ceiling.
alter table public.hub_video_jobs
  drop constraint if exists hub_video_jobs_duration_seconds_check;

alter table public.hub_video_jobs
  add constraint hub_video_jobs_duration_seconds_check
  check (duration_seconds between 2 and 10);
