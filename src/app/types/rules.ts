export type FieldDefinition = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'dynamic_select';
  options?: string[]; // For manual select
  source?: string;    // For dynamic select (e.g., 'categories', 'providers', 'bottleTypes')
};

export const DEFAULT_FIELD_DEFINITIONS: FieldDefinition[] = [
  { key: 'genero', label: 'Género', type: 'select', options: ['Masculino', 'Femenino', 'Unisex', 'Ambiente', 'Otro'] },
  { key: 'nombre', label: 'Nombre', type: 'text' },
  { key: 'categoria', label: 'Categoría', type: 'dynamic_select', source: 'categories' },
  { key: 'proveedor', label: 'Proveedor', type: 'dynamic_select', source: 'providers' },
  { key: 'botella', label: 'Tipo de Frasco', type: 'dynamic_select', source: 'bottleTypes' },
  { key: 'devolvio_envase', label: 'Devolvió Envase', type: 'boolean' },
];
