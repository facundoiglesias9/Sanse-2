// types/perfume.ts
import { Insumo } from "./insumo";

export type Genero = "masculino" | "femenino" | "otro";

export type ProveedorLite = {
  id: string;
  nombre: string;
  color?: string | null;              // p.ej. "indigo", "pink", etc.
  gramos_configurados?: number | null; // usado en el cálculo de costo
  margen_venta?: number | null;        // usado en el cálculo de precio
};

export type InsumoCategoriaLite = {
  id: string;
  nombre: string;
};

export type Perfume = {
  id: string;
  nombre: string;
  genero: Genero;
  costo: number;
  precio: number;
  precio_mayorista: number;

  // proveedor
  proveedor_id: string;
  proveedor?: string | null;                 // nombre plano (lo devolvés en el map)
  proveedores?: ProveedorLite | null;        // objeto anidado para UI

  // insumos / categoría
  insumos?: Insumo[];
  insumos_categorias_id?: string | null;
  insumos_categorias?: InsumoCategoriaLite | null;

  // Campos crudos de BD para edición
  precio_ars?: number | null;
  precio_usd?: number | null;
  cantidad_gramos?: number | null;

  // Campos de personalización
  margen_minorista?: number | null;
  margen_mayorista?: number | null;
  custom_insumos?: any | null;
};