
-- Add welcome_message, last_seen_at, avg_response_time, badges, subscription_type to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS welcome_message text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS avg_response_time_minutes integer DEFAULT null,
  ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subscription_type text DEFAULT 'free';

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('message-attachments', 'message-attachments', true) ON CONFLICT DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'message-attachments');

-- Storage RLS: anyone can view attachments
CREATE POLICY "Public view attachments" ON storage.objects FOR SELECT USING (bucket_id = 'message-attachments');

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
