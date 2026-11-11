-- Only the AdSense publisher identifier is publicly readable.
drop policy if exists hub_site_settings_public_adsense_read
  on public.hub_site_settings;

create policy hub_site_settings_public_adsense_read
  on public.hub_site_settings
  for select to anon, authenticated
  using (setting_key = 'adsense_client');
