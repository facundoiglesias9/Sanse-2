-- Migration: Add pagador_id to gastos table
-- Purpose: Track who paid each expense (Facundo, Lukas, or Sanse common fund)
-- Date: 2025-12-10

-- Add pagador_id column (nullable to allow Sanse/common fund expenses)
ALTER TABLE gastos 
ADD COLUMN IF NOT EXISTS pagador_id UUID REFERENCES profiles(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_gastos_pagador ON gastos(pagador_id);

-- Comment for documentation
COMMENT ON COLUMN gastos.pagador_id IS 'ID del inversor que pagó el gasto. NULL representa la caja común (Sanse)';
