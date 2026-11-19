-- SECURITY DEFINER routines use an empty search_path to prevent object shadowing.
-- All application tables in these functions are schema-qualified.
ALTER FUNCTION public.confirm_hub_payment(uuid, text) SET search_path = '';
ALTER FUNCTION public.confirm_uploaded_hub_payment(uuid, uuid) SET search_path = '';
