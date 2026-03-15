
-- Escrow payments table to track FreeMoPay transactions
CREATE TABLE public.escrow_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL,
  amount bigint NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 10.00,
  commission_amount bigint NOT NULL DEFAULT 0,
  provider_amount bigint NOT NULL DEFAULT 0,
  freemopay_reference text,
  external_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payer_phone text,
  callback_received_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  auto_release_at timestamptz,
  dispute_reason text,
  dispute_evidence_urls text[] DEFAULT '{}',
  admin_resolution text,
  admin_resolution_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.escrow_payments ENABLE ROW LEVEL SECURITY;

-- Participants can view escrow for their missions
CREATE POLICY "Mission participants view escrow"
  ON public.escrow_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.missions
      WHERE missions.id = escrow_payments.mission_id
      AND (missions.client_id = auth.uid() OR missions.provider_id = auth.uid())
    )
  );

-- Only system/edge functions insert (via service role), but allow client to insert
CREATE POLICY "Clients create escrow payments"
  ON public.escrow_payments FOR INSERT
  WITH CHECK (auth.uid() = payer_id);

-- Admins manage all
CREATE POLICY "Admins manage escrow"
  ON public.escrow_payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow updates for webhook status changes (service role will handle this)
CREATE POLICY "Participants update escrow"
  ON public.escrow_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.missions
      WHERE missions.id = escrow_payments.mission_id
      AND (missions.client_id = auth.uid() OR missions.provider_id = auth.uid())
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_escrow_payments_updated_at
  BEFORE UPDATE ON public.escrow_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
