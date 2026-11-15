-- Keep browser-visible catalog tables read-only.
REVOKE ALL ON TABLE public.hub_campaigns, public.hub_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.hub_campaigns, public.hub_plans TO anon, authenticated;
GRANT ALL ON TABLE public.hub_campaigns, public.hub_plans TO service_role;

-- User data is accessed directly only by authenticated users for their own RLS-protected row.
REVOKE ALL ON TABLE public.hub_user_data FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.hub_user_data TO authenticated;
GRANT ALL ON TABLE public.hub_user_data TO service_role;

-- Subscriptions and video jobs are accessed through authenticated Worker endpoints only.
REVOKE ALL ON TABLE public.hub_subscriptions, public.hub_video_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_subscriptions, public.hub_video_jobs TO service_role;
