export type Esencia = {
  id: string;
  nombre: string;
  precio_usd?: number;
  precio_ars?: number;
  precio_ars_30g?: number | null;
  precio_ars_100g?: number | null;
  precio_por_perfume?: number;
  cantidad_gramos?: number;
  proveedor_id: string;
  proveedores?: {
    id: string;
    nombre: string;
    color: string;
    gramos_configurados?: number;
    margen_venta?: number;
  } | null;
  insumos_categorias_id: string;
  insumos_categorias?: {
    id: string;
    nombre: string;
  } | null;
  is_consultar?: boolean;
  genero: "masculino" | "femenino" | "ambiente" | "otro";
  created_by: string;
  created_at: Date;
  updated_at: Date;
};