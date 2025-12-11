import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Insumo } from "@/app/(app)/herramientas/calculadora-margen/types";
import { insumosColumns } from "@/app/(app)/herramientas/calculadora-margen/components/columns";
import { DataTable } from "@/app/(app)/herramientas/calculadora-margen/components/data-table";

export function TablaInsumos({
  value,
  onChange,
  categoriaActiva,
}: {
  value: Insumo[];
  onChange: (v: Insumo[]) => void;
  categoriaActiva: string;
}) {
  // Handlers definidos y tipados explícitamente:
  const handleEdit = (id: string, key: keyof Insumo, val: string | number) => {
    onChange(
      value.map((ins) =>
        ins.id === id
          ? {
              ...ins,
              [key]:
                key === "nombre"
                  ? val
                  : val === "" || val === undefined || isNaN(Number(val))
                    ? 0
                    : Number(val),
            }
          : ins,
      ),
    );
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((ins) => ins.id !== id));
  };

  // Agregar insumo nuevo (no precargado)
  const addInsumo = () =>
    onChange([
      ...value,
      {
        id: `nuevo-${Date.now()}`,
        nombre: "",
        precioLote: 0,
        cantidadLote: 0,
        cantidadNecesaria: 0,
        isGeneral: false,
        proveedorId: null,
        insumosCategoriasId: categoriaActiva,
      },
    ]);

  return (
    <div className="my-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Insumos generales</h3>
        <Button type="button" size="sm" className="gap-x-2" onClick={addInsumo}>
          <Plus width={18} />
          Agregar insumo
        </Button>
      </div>
      <DataTable
        columns={insumosColumns(handleEdit, handleRemove)}
        data={value}
      />
    </div>
  );
}
