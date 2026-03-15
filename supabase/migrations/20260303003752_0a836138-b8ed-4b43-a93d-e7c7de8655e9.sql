
-- Add new columns to profiles for provider onboarding
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS years_of_experience integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}'::text[];

-- Note: We keep 'both' in enum for backward compat but enforce single role in app logic
-- Update any existing 'both' roles to 'client'
UPDATE public.user_roles SET role = 'client' WHERE role = 'both';
