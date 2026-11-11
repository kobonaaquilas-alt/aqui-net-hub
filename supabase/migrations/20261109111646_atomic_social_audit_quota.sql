-- Enforce the free social-audit quota atomically per user.
create or replace function public.create_hub_social_audit(
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_follow_status text;
  v_subscribed boolean;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select count(*) into v_count
    from public.hub_social_audits where user_id = p_user_id;

  if v_count >= 3 then
    select status into v_follow_status
      from public.hub_follow_verifications where user_id = p_user_id;
    if coalesce(v_follow_status, 'none') <> 'approved' then
      return jsonb_build_object(
        'ok', false,
        'code', case when v_follow_status = 'pending' then 'FOLLOW_PENDING' else 'FOLLOW_REQUIRED' end,
        'count', v_count
      );
    end if;
    select exists (
      select 1 from public.hub_subscriptions
       where user_id = p_user_id and status = 'active' and ends_at > now()
    ) into v_subscribed;
    if not v_subscribed then
      return jsonb_build_object('ok', false, 'code', 'SUBSCRIPTION_REQUIRED', 'count', v_count);
    end if;
  end if;

  insert into public.hub_social_audits (
    user_id, social_url, platform, account_name, followers,
    average_views, average_likes, average_comments, posts_per_week, goal, report
  ) values (
    p_user_id, p_social_url, p_platform, p_account_name, p_followers,
    p_average_views, p_average_likes, p_average_comments, p_posts_per_week, p_goal, p_report
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'count', v_count + 1);
end;
$function$;

revoke all on function public.create_hub_social_audit(uuid, text, text, text, bigint, bigint, bigint, bigint, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_hub_social_audit(uuid, text, text, text, bigint, bigint, bigint, bigint, numeric, text, jsonb)
  to service_role;
