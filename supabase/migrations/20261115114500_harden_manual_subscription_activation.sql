CREATE OR REPLACE FUNCTION public.grant_hub_manual_subscription(
  p_admin_user_id uuid,
  p_email text,
  p_plan_id uuid,
  p_payment_method text,
  p_manual_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_plan record;
  v_order_id uuid;
  v_subscription_id uuid;
  v_start timestamptz;
  v_reference text := nullif(trim(p_manual_reference), '');
  v_method text := trim(p_payment_method);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hub_admin_users WHERE user_id = p_admin_user_id) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) < 5 OR position('@' in p_email) < 2 THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF v_reference IS NULL OR length(v_reference) < 3 OR length(v_reference) > 120 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_REFERENCE';
  END IF;
  IF v_method NOT IN ('TMoney', 'Flooz', 'Virement bancaire', 'Carte/Autre', 'Espèces') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;

  SELECT id INTO v_user_id FROM auth.users
  WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  SELECT id, name, amount_xof, duration_days INTO v_plan
  FROM public.hub_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND'; END IF;

  IF EXISTS (SELECT 1 FROM public.hub_payment_orders WHERE manual_reference = v_reference) THEN
    RAISE EXCEPTION 'REFERENCE_ALREADY_USED';
  END IF;

  SELECT greatest(now(), coalesce(max(ends_at), now())) INTO v_start
  FROM public.hub_subscriptions
  WHERE user_id = v_user_id AND status = 'active' AND ends_at > now();

  INSERT INTO public.hub_payment_orders (
    user_id, plan_id, amount_xof, currency, merchant_transaction_id, status,
    paid_at, plan_name, duration_days, payment_method, manual_reference, processed_by
  ) VALUES (
    v_user_id, v_plan.id, v_plan.amount_xof, 'XOF',
    'MANUAL-' || gen_random_uuid()::text, 'paid', now(), v_plan.name,
    v_plan.duration_days, v_method, v_reference, p_admin_user_id
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.hub_subscriptions (
    user_id, plan_id, payment_order_id, starts_at, ends_at, status
  ) VALUES (
    v_user_id, v_plan.id, v_order_id, v_start,
    v_start + make_interval(days => v_plan.duration_days), 'active'
  ) RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'ok', true, 'payment_order_id', v_order_id, 'subscription_id', v_subscription_id,
    'user_id', v_user_id, 'plan_name', v_plan.name, 'amount_xof', v_plan.amount_xof,
    'starts_at', v_start, 'ends_at', v_start + make_interval(days => v_plan.duration_days)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.grant_hub_manual_subscription(uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_hub_manual_subscription(uuid, text, uuid, text, text)
  TO service_role;
