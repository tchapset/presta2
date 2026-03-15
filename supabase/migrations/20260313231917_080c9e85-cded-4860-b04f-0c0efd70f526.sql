
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'quote', 'both'));

COMMENT ON COLUMN public.profiles.pricing_type IS 'Provider pricing type: fixed (tarif fixe), quote (sur devis), both';

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS invoice_description text;

COMMENT ON COLUMN public.missions.invoice_description IS 'Custom invoice description written by the provider';
