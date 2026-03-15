
ALTER TABLE public.mobile_money_transfers 
  ADD COLUMN IF NOT EXISTS operator text DEFAULT 'mtn',
  ADD COLUMN IF NOT EXISTS name_on_account text,
  ADD COLUMN IF NOT EXISTS transfer_type text DEFAULT 'withdrawal';
