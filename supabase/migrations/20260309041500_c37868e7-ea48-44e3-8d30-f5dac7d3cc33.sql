-- Fix overly permissive insert policy on support_tickets
DROP POLICY "Anyone can create tickets" ON public.support_tickets;
CREATE POLICY "Authenticated users create tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);