
CREATE TABLE public.platform_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform reviews"
  ON public.platform_reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert platform reviews"
  ON public.platform_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- One review per user per mission
CREATE UNIQUE INDEX platform_reviews_user_mission_idx ON public.platform_reviews (user_id, mission_id) WHERE mission_id IS NOT NULL;
