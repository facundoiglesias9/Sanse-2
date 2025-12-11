import { Proveedor } from "@/app/types/proveedor";

export interface Insumo {
  id: string;
  nombre: string;
  precioLote: number;
  cantidadLote: number;
  cantidadNecesaria: number;
  isGeneral: boolean;
  proveedorId?: string | null;
  insumosCategoriasId: string;
  esFrascoSeleccionado?: boolean; // Agregado para identificar si es un frasco seleccionado
}

export interface InputsGeneralesState {
  proveedor: Proveedor;
  precioEsencia: number;
  moneda: "USD" | "ARS";
  gramosLote: number;
  margen: number;
  descuentoMayorista: number;
  tipoFrasco: "femenino" | "masculino" | "otro";
}