
-- Gamification: provider levels & user achievements
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  badge_label text NOT NULL,
  badge_icon text NOT NULL DEFAULT '🏆',
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own achievements" ON public.user_achievements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts achievements" ON public.user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view achievements" ON public.user_achievements
  FOR SELECT
  USING (true);
