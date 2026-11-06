create table if not exists public.hub_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.hub_plans(id),
  payment_order_id uuid not null unique references public.hub_payment_orders(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.hub_subscriptions enable row level security;

drop policy if exists hub_subscriptions_owner_read
  on public.hub_subscriptions;

create policy hub_subscriptions_owner_read
  on public.hub_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.hub_subscriptions to authenticated;

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
    v_start + (v_plan.duration_days * interval '1 day'),
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
