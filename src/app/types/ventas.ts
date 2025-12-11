import { Perfume } from './perfume';
export type Ventas = {
  id: string;
  cantidad_perfumes: number;
  precio_total: number;
  perfumes: Perfume[];
  created_at: Date;
};