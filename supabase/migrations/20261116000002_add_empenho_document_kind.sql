-- =============================================================================
-- Migration: Adiciona 'EMPENHO' ao enum public.document_kind
-- Executada em transação separada para permitir uso imediato na migration seguinte.
-- =============================================================================
ALTER TYPE public.document_kind ADD VALUE IF NOT EXISTS 'EMPENHO';
