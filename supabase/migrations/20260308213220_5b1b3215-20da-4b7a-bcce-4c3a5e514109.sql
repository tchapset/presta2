
-- Remove overly permissive SELECT policy - edge function uses service role
DROP POLICY "Service can read all subscriptions" ON public.push_subscriptions;
