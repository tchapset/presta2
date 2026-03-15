
-- Add storage bucket for avatars and gallery
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin policies for missions
CREATE POLICY "Admins view all missions" ON public.missions FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all missions" ON public.missions FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Admin policy for profiles
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Admin policy for wallets
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admin policy for transactions
CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert transactions" ON public.transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Providers view open missions
CREATE POLICY "Providers view open missions" ON public.missions FOR SELECT USING (provider_id IS NULL AND status = 'pending');

-- Message update for read receipts
CREATE POLICY "Recipients can mark messages read" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM missions 
    WHERE missions.id = messages.mission_id 
    AND (missions.client_id = auth.uid() OR missions.provider_id = auth.uid())
  )
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON public.notifications FOR INSERT WITH CHECK (true);
