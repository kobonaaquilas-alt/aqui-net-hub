-- Harden legacy admin RPC and optimize owner-scoped RLS checks.
GRANT SELECT ON public.admin_users TO authenticated;
DROP POLICY IF EXISTS "Users can read own admin role" ON public.admin_users;
CREATE POLICY "Users can read own admin role"
  ON public.admin_users FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users
WHERE (SELECT count(*) FROM auth.users) = 1
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP POLICY IF EXISTS hub_user_data_owner ON public.hub_user_data;
CREATE POLICY hub_user_data_owner ON public.hub_user_data
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS hub_ads_owner_insert ON public.hub_ad_requests;
CREATE POLICY hub_ads_owner_insert ON public.hub_ad_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS hub_ads_owner_read ON public.hub_ad_requests;
CREATE POLICY hub_ads_owner_read ON public.hub_ad_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS hub_partners_owner_insert ON public.hub_partner_applications;
CREATE POLICY hub_partners_owner_insert ON public.hub_partner_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS hub_partners_owner_read ON public.hub_partner_applications;
CREATE POLICY hub_partners_owner_read ON public.hub_partner_applications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS hub_subscriptions_owner_read ON public.hub_subscriptions;
CREATE POLICY hub_subscriptions_owner_read ON public.hub_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS hub_ad_requests_created_at_idx
  ON public.hub_ad_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS hub_partner_applications_created_at_idx
  ON public.hub_partner_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS hub_ad_requests_user_id_idx
  ON public.hub_ad_requests(user_id);
CREATE INDEX IF NOT EXISTS hub_partner_applications_user_id_idx
  ON public.hub_partner_applications(user_id);
CREATE INDEX IF NOT EXISTS hub_payment_orders_plan_id_idx
  ON public.hub_payment_orders(plan_id);
CREATE INDEX IF NOT EXISTS hub_payment_orders_user_id_idx
  ON public.hub_payment_orders(user_id);
CREATE INDEX IF NOT EXISTS hub_subscriptions_plan_id_idx
  ON public.hub_subscriptions(plan_id);