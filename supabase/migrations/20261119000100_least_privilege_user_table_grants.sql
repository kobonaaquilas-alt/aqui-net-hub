-- Remove inherited/default table privileges from public roles.
-- Keep only the operations required by the current application.
REVOKE ALL ON TABLE public.ad_campaigns, public.ad_requests,
  public.partner_applications, public.user_data
  FROM PUBLIC, anon, authenticated;

-- Browser automation jobs are accessed only by the trusted Worker.
REVOKE ALL ON TABLE public.hub_browser_jobs
  FROM PUBLIC, anon, authenticated;

-- Profiles are private: users may read/create/update only their own row via RLS.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- These two forms are submitted by signed-in users and reviewed server-side.
REVOKE ALL ON TABLE public.hub_ad_requests, public.hub_partner_applications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.hub_ad_requests, public.hub_partner_applications
  TO authenticated;
