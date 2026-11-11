-- AQUI NET ADS self-service campaigns and a one-time three-day trial per account.
alter table public.hub_campaigns
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists trial_started_at timestamptz,
  add column if not exists is_self_service boolean not null default false;

create index if not exists hub_campaigns_owner_created_idx
  on public.hub_campaigns (owner_user_id, created_at desc)
  where owner_user_id is not null;

create table if not exists public.hub_advertiser_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > started_at)
);

alter table public.hub_advertiser_trials enable row level security;
revoke all on table public.hub_advertiser_trials from anon, authenticated;
grant all on table public.hub_advertiser_trials to service_role;

create or replace function public.confirm_hub_payment(
  p_order_id uuid,
  p_transaction_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order public.hub_payment_orders%rowtype;
  v_plan public.hub_plans%rowtype;
  v_start timestamptz;
  v_end timestamptz;
begin
  select *
    into v_order
    from public.hub_payment_orders
   where id = p_order_id
   for update;

  if not found then
    return false;
  end if;

  if v_order.status = 'paid' then
    return true;
  end if;

  if v_order.status <> 'pending'
     or v_order.cinetpay_transaction_id is distinct from p_transaction_id then
    return false;
  end if;

  select *
    into v_plan
    from public.hub_plans
   where id = v_order.plan_id
     and is_active = true;

  if not found then
    return false;
  end if;

  select max(ends_at)
    into v_start
    from public.hub_subscriptions
   where user_id = v_order.user_id
     and status = 'active'
     and ends_at > now();

  v_start := greatest(coalesce(v_start, now()), now());
  v_end := v_start + (v_plan.duration_days * interval '1 day');

  update public.hub_payment_orders
     set status = 'paid',
         paid_at = now()
   where id = v_order.id;

  insert into public.hub_subscriptions (
    user_id, plan_id, payment_order_id, starts_at, ends_at, status
  )
  values (
    v_order.user_id,
    v_order.plan_id,
    v_order.id,
    v_start,
    v_end,
    'active'
  )
  on conflict (payment_order_id) do nothing;

  update public.hub_campaigns
     set ends_at = greatest(coalesce(ends_at, v_start), v_end)
   where owner_user_id = v_order.user_id
     and is_self_service = true;

  return true;
end;
$function$;

revoke all on function public.confirm_hub_payment(uuid, text)
  from public, anon, authenticated;

grant execute on function public.confirm_hub_payment(uuid, text)
  to service_role;
