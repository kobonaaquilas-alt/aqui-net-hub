-- AQUI NET HELP: the first three social audits are free; paid plans unlock further audits.
CREATE OR REPLACE FUNCTION public.create_hub_social_audit(
  p_user_id uuid,
  p_social_url text,
  p_platform text,
  p_account_name text,
  p_followers bigint,
  p_average_views bigint,
  p_average_likes bigint,
  p_average_comments bigint,
  p_posts_per_week numeric,
  p_goal text,
  p_report jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
  v_subscribed boolean;
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT count(*) INTO v_count
  FROM public.hub_social_audits
  WHERE user_id = p_user_id;

  IF v_count >= 3 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.hub_subscriptions
      WHERE user_id = p_user_id
        AND status = 'active'
        AND ends_at > now()
    ) INTO v_subscribed;

    IF NOT v_subscribed THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SUBSCRIPTION_REQUIRED', 'count', v_count);
    END IF;
  END IF;

  INSERT INTO public.hub_social_audits (
    user_id, social_url, platform, account_name, followers,
    average_views, average_likes, average_comments, posts_per_week, goal, report
  ) VALUES (
    p_user_id, p_social_url, p_platform, p_account_name, p_followers,
    p_average_views, p_average_likes, p_average_comments, p_posts_per_week, p_goal, p_report
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'count', v_count + 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_hub_social_audit(uuid, text, text, text, bigint, bigint, bigint, bigint, numeric, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_hub_social_audit(uuid, text, text, text, bigint, bigint, bigint, bigint, numeric, text, jsonb)
  TO service_role;
