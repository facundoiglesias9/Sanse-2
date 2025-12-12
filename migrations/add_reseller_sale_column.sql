-- Add is_reseller_sale column to ventas table
-- This column identifies sales made by reseller users

ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS is_reseller_sale BOOLEAN DEFAULT FALSE;

-- Optional: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ventas_is_reseller_sale 
ON ventas(is_reseller_sale);
