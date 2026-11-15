CREATE TABLE IF NOT EXISTS public.hub_ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.hub_campaigns(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_ad_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hub_ad_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_ad_events TO service_role;
CREATE INDEX IF NOT EXISTS hub_ad_events_owner_campaign_created_idx
  ON public.hub_ad_events (owner_user_id, campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hub_ad_events_campaign_type_created_idx
  ON public.hub_ad_events (campaign_id, event_type, created_at DESC);
