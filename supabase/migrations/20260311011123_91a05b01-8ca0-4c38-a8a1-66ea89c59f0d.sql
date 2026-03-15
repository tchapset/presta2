
CREATE TABLE public.mobile_money_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid REFERENCES public.missions(id),
  escrow_id uuid,
  amount bigint NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  admin_note text
);

ALTER TABLE public.mobile_money_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transfers" ON public.mobile_money_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all transfers" ON public.mobile_money_transfers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System inserts transfers" ON public.mobile_money_transfers
  FOR INSERT
  WITH CHECK (true);
