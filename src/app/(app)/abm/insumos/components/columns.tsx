"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { formatDate } from "@/app/helpers/formatDate";
import { Insumo } from "@/app/types/insumo";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export const insumosColumns = (
  onConfirmDelete: (id: string) => void,
  onEdit: (insumo: Insumo) => void,
): ColumnDef<Insumo>[] => [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => <p className="font-bold">{row.getValue("nombre")}</p>,
    },
    {
      accessorKey: "costo_unitario",
      header: "Costo unitario",
      cell: ({ row }) => {
        const costoUnitario = row.getValue("costo_unitario") as number;
        return <p>{formatCurrency(costoUnitario, "ARS", 0)}</p>;
      },
    },
    {
      accessorKey: "cantidad_necesaria",
      header: "Cantidad necesaria",
      cell: ({ row }) => {
        const cantidadNecesaria = row.getValue("cantidad_necesaria") as number;
        return <p>{cantidadNecesaria}</p>;
      },
    },
    {
      accessorKey: "precio_lote",
      header: "Precio por lote",
      cell: ({ row }) => {
        const precioLote = row.getValue("precio_lote") as number;
        return <p>{formatCurrency(precioLote, "ARS", 0)}</p>;
      },
    },
    {
      accessorKey: "cantidad_lote",
      header: "Cantidad por lote",
      cell: ({ row }) => {
        const cantidadLote = row.getValue("cantidad_lote") as number;
        return <p>{cantidadLote}</p>;
      },
    },
    // Categoría column removed
    {
      accessorKey: "updated_at",
      header: "Última actualización",
      cell: ({ row }) => {
        const updatedAt = row.getValue("updated_at") as string;
        return <p>{formatDate(new Date(updatedAt))}</p>;
      },
    },
    {
      accessorKey: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const insumo = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
              onClick={() => onEdit(insumo)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
              onClick={() => onConfirmDelete(insumo.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
