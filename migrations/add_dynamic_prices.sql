-- Run this in Supabase SQL Editor

-- precios_vanrossum
ALTER TABLE precios_vanrossum 
ADD COLUMN IF NOT EXISTS precio_30g numeric,
ADD COLUMN IF NOT EXISTS precio_100g numeric;

-- precios_vanrossum_orphans
ALTER TABLE precios_vanrossum_orphans
ADD COLUMN IF NOT EXISTS precio_30g numeric,
ADD COLUMN IF NOT EXISTS precio_100g numeric;

-- esencias
ALTER TABLE esencias 
ADD COLUMN IF NOT EXISTS precio_ars_30g numeric,
ADD COLUMN IF NOT EXISTS precio_ars_100g numeric;
