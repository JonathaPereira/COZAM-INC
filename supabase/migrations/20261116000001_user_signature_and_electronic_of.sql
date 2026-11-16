-- =============================================================================
-- Migration 011: Assinatura Digital do Usuário e Emissão Eletrônica de OFs
-- Totalmente aditivo e seguro: preserva 100% dos dados existentes.
-- =============================================================================

-- 1. Campos de assinatura e cargo institucional no perfil do usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS signature_data_url text;

-- 2. Campos de rastreamento de assinatura eletrônica na Ordem de Fornecimento
ALTER TABLE public.supply_orders
  ADD COLUMN IF NOT EXISTS signed_electronically boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS electronic_signature_hash text;
