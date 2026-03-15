
-- Remove automatic role assignment from handle_new_user trigger
-- so new users must go through role selection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  
  -- Do NOT insert into user_roles here - user must choose their role
  RETURN NEW;
END;
$function$;
