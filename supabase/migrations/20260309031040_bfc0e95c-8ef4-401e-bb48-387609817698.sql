
-- Verification requests table
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  phone_number text,
  phone_verified boolean DEFAULT false,
  id_document_url text,
  selfie_url text,
  identity_match boolean,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add verification columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS verification_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- RLS
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own verification" ON public.verification_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own verification" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own verification" ON public.verification_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all verifications" ON public.verification_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for verification docs
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT DO NOTHING;

-- Storage RLS: users upload own docs
CREATE POLICY "Users upload verification docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users view own verification docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins view all verification docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND has_role(auth.uid(), 'admin'::app_role));
