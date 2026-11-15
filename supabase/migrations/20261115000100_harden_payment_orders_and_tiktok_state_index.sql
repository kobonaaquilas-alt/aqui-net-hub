-- Restrict payment-order records to the trusted server-side Worker.
-- The application reads and writes these rows only through authenticated Worker routes.
REVOKE ALL ON TABLE public.hub_payment_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_payment_orders TO service_role;

-- Cover the user_id foreign key used by TikTok OAuth state cleanup/lookup.
CREATE INDEX IF NOT EXISTS hub_tiktok_oauth_states_user_id_idx
  ON public.hub_tiktok_oauth_states (user_id);
