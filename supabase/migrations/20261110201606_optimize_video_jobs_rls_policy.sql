drop policy if exists "Users read own video jobs" on public.hub_video_jobs;
create policy "Users read own video jobs"
  on public.hub_video_jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);
