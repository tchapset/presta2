
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS client_confirmed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS provider_confirmed_at timestamp with time zone DEFAULT NULL;
