"use client";

import { Insumo } from "@/app/(app)/herramientas/calculadora-margen/types";
import { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";

const preventSubmitOnEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    (e.target as HTMLInputElement).blur();
  }
};

export const insumosColumns = (
  handleEdit: (id: string, key: keyof Insumo, value: string | number) => void,
  handleRemove: (id: string) => void,
): ColumnDef<Insumo>[] => [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <Input
              required
              defaultValue={row.getValue("nombre") as string}
              disabled={
                row.original.isGeneral || row.original.esFrascoSeleccionado
              }
              className="w-36"
              onKeyDown={preventSubmitOnEnter}
              onBlur={(e) =>
                handleEdit(row.original.id, "nombre", e.target.value)
              }
            />
            {(row.original.isGeneral || row.original.esFrascoSeleccionado) && (
              <Badge>Precargado</Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "precioLote",
      header: "Precio x lote",
      cell: ({ row }) => {
        return (
          <NumberInput
            required
            min={0}
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
            defaultValue={row.getValue("precioLote") as number}
            className="w-28"
            onKeyDown={preventSubmitOnEnter}
            onBlur={(e) => {
              const s = (e.target as HTMLInputElement).value || "";
              const n = s === "" ? 0 : Number(s.replace(/\./g, "").replace(",", "."));
              handleEdit(row.original.id, "precioLote", n);
            }}
            placeholder="0,00"
          />
        );
      },
    },
    {
      accessorKey: "cantidadLote",
      header: "Cant. lote",
      cell: ({ row }) => {
        return (
          <NumberInput
            required
            min={0}
            decimalScale={0}
            defaultValue={row.getValue("cantidadLote") as number}
            className="w-28"
            onKeyDown={preventSubmitOnEnter}
            onBlur={(e) => {
              const s = (e.target as HTMLInputElement).value || "";
              const n = s === "" ? 0 : Number(s.replace(/\./g, "").replace(",", "."));
              handleEdit(row.original.id, "cantidadLote", n);
            }}
            placeholder="0"
          />
        );
      },
    },
    {
      accessorKey: "cantidadNecesaria",
      header: "Cant. necesaria",
      cell: ({ row }) => {
        return (
          <NumberInput
            required
            min={0}
            decimalScale={0}
            defaultValue={row.getValue("cantidadNecesaria") as number}
            className="w-24"
            onKeyDown={preventSubmitOnEnter}
            onBlur={(e) => {
              const s = (e.target as HTMLInputElement).value || "";
              const n = s === "" ? 0 : Number(s.replace(/\./g, "").replace(",", "."));
              handleEdit(row.original.id, "cantidadNecesaria", n);
            }}
            placeholder="0"
          />
        );
      },
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
            onClick={() => handleRemove(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];
