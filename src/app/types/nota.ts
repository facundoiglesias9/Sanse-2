export type Prioridad = 'alta' | 'normal' | 'baja';

export type Nota = {
  id: string;
  titulo: string;
  nota: string;
  fecha_vencimiento?: Date | null;
  prioridad: Prioridad;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
  profiles?: {
    nombre: string | null;
  } | null;
};