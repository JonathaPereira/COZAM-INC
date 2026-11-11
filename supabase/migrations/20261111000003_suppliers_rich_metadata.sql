-- Migration 20261111000003: Suppliers Rich Metadata
-- Adds detailed registration fields for suppliers (address, contacts, state registration)

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Seed / atualiza dados oficiais de MZ Bernardi com proteção contra falha
DO $$
BEGIN
  UPDATE public.suppliers 
     SET cnpj = '02.418.125/0001-61', 
         legal_name = 'MZ BERNARDI E CIA LTDA',
         street = 'Rua Tenente Paulo Winteler',
         number = '258 Qd. 12',
         neighborhood = 'Centro',
         city = 'Satuba',
         state = 'AL',
         zip_code = '57.120-000',
         phone = '(82) 3037-2323',
         email = 'mzbernardi2016@gmail.com'
   WHERE name = 'MZ Bernardi' AND cnpj IS NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
