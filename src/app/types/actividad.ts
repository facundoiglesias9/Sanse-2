export interface Actividad {
  id: string;
  user_id: string | null;
  action: string;
  created_at: string;
  extra_data: any;
  profiles: { nombre: string | null; } | null;
}
