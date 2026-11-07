-- Secure administration for AQUI NET ADS and AQUI NET PARTNERS.
create table if not exists public.hub_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.hub_admin_users enable row level security;
revoke all on public.hub_admin_users from anon, authenticated;
grant all on public.hub_admin_users to service_role;

-- Admin-only reads and status changes are performed by the Worker using service_role.
-- Members retain access only to their own submitted requests through existing RLS policies.
create index if not exists hub_ad_requests_status_created_idx
  on public.hub_ad_requests(status, created_at desc);
create index if not exists hub_partner_applications_status_created_idx
  on public.hub_partner_applications(status, created_at desc);
