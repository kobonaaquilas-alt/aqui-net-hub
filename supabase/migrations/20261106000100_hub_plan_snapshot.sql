-- Snapshot the commercial terms when the order is created.
-- This ensures a plan being unpublished later cannot invalidate a legitimate payment.
alter table public.hub_payment_orders
  add column if not exists plan_name text,
  add column if not exists duration_days integer;

update public.hub_payment_orders o
   set plan_name = coalesce(o.plan_name, p.name),
       duration_days = coalesce(o.duration_days, p.duration_days)
  from public.hub_plans p
 where p.id = o.plan_id
   and (o.plan_name is null or o.duration_days is null);

alter table public.hub_payment_orders
  alter column plan_name set not null,
  alter column duration_days set not null;

alter table public.hub_payment_orders
  drop constraint if exists hub_payment_orders_duration_days_check;

alter table public.hub_payment_orders
  add constraint hub_payment_orders_duration_days_check
  check (duration_days > 0);

create index if not exists hub_subscriptions_user_ends_idx
  on public.hub_subscriptions(user_id, ends_at desc);

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
  v_start timestamptz;
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
    return v_order.cinetpay_transaction_id = p_transaction_id;
  end if;

  if v_order.status <> 'pending'
     or v_order.cinetpay_transaction_id is distinct from p_transaction_id
     or v_order.duration_days is null
     or v_order.duration_days < 1 then
    return false;
  end if;

  -- Serialize subscription extension per account to avoid overlapping
  -- concurrent purchases for the same user.
  perform 1
    from auth.users
   where id = v_order.user_id
   for update;

  select max(ends_at)
    into v_start
    from public.hub_subscriptions
   where user_id = v_order.user_id
     and status = 'active'
     and ends_at > now();

  v_start := greatest(coalesce(v_start, now()), now());

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
    v_start + (v_order.duration_days * interval '1 day'),
    'active'
  )
  on conflict (payment_order_id) do nothing;

  return true;
end;
$function$;

revoke all on function public.confirm_hub_payment(uuid, text)
  from public, anon, authenticated;

grant execute on function public.confirm_hub_payment(uuid, text)
  to service_role;
