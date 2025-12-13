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
      header: () => <div className="text-center">Nombre</div>,
      cell: ({ row }) => <div className="text-center font-bold">{row.getValue("nombre")}</div>,
    },
    {
      accessorKey: "costo_unitario",
      header: () => <div className="text-center">Costo unitario</div>,
      cell: ({ row }) => {
        const costoUnitario = row.getValue("costo_unitario") as number;
        return <div className="text-center">{formatCurrency(costoUnitario, "ARS", 0)}</div>;
      },
    },
    {
      accessorKey: "cantidad_necesaria",
      header: () => <div className="text-center">Cantidad necesaria</div>,
      cell: ({ row }) => {
        const cantidadNecesaria = row.getValue("cantidad_necesaria") as number;
        return <div className="text-center">{cantidadNecesaria}</div>;
      },
    },
    {
      accessorKey: "precio_lote",
      header: () => <div className="text-center">Precio por lote</div>,
      cell: ({ row }) => {
        const precioLote = row.getValue("precio_lote") as number;
        return <div className="text-center">{formatCurrency(precioLote, "ARS", 0)}</div>;
      },
    },
    {
      accessorKey: "cantidad_lote",
      header: () => <div className="text-center">Cantidad por lote</div>,
      cell: ({ row }) => {
        const cantidadLote = row.getValue("cantidad_lote") as number;
        return <div className="text-center">{cantidadLote}</div>;
      },
    },
    {
      accessorKey: "updated_at",
      header: () => <div className="text-center">Última actualización</div>,
      cell: ({ row }) => {
        const updatedAt = row.getValue("updated_at") as string;
        return <div className="text-center">{formatDate(new Date(updatedAt))}</div>;
      },
    },
    {
      accessorKey: "acciones",
      header: () => <div className="text-center">Acciones</div>,
      cell: ({ row }) => {
        const insumo = row.original;
        return (
          <div className="flex items-center justify-center gap-2">
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
