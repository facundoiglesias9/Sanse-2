export type Insumo = {
  id: string;
  nombre: string;
  cantidad_necesaria: number;
  cantidad_lote: number;
  precio_lote: number;
  costo_unitario?: number;
  proveedor_id: string | null;
  proveedores?: {
    id: string;
    nombre: string;
    color: string;
  } | null;
  insumos_categorias_id: string;
  insumos_categorias?: {
    id: string;
    nombre: string;
  } | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  is_general: boolean;
};