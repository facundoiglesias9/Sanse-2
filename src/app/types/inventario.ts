export type Inventario = {
  id: string;
  nombre: string;
  tipo: string;
  genero?: "masculino" | "femenino" | "ambiente" | "otro";
  cantidad?: number;
  created_by: Date;
  updated_by: Date;
  updated_at: Date;
};