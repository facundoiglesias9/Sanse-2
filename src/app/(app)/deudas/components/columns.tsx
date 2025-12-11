"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/app/helpers/formatDate";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Deudas } from "@/app/types/deudas";
import { Button } from "@/components/ui/button";
import { HandMetal, Pencil, Trash2 } from "lucide-react";

export const deudasColumns = (
  onConfirmDelete: (id: string) => void,
  onEdit: (deuda: Deudas) => void,
  onConfirmSaldar: (deuda: Deudas) => void,
  acreedores: { value: string; label: string }[],
): ColumnDef<Deudas>[] => [
  {
    accessorKey: "created_at",
    header: "Fecha",
    cell: ({ row }) => {
      const fecha = row.getValue("created_at") as string;
      return <p>{formatDate(new Date(fecha))}</p>;
    },
  },
  {
    accessorKey: "detalle",
    header: "Detalle",
    cell: ({ row }) => {
      const detalle = row.getValue("detalle") as string;
      return <p>{detalle}</p>;
    },
  },
  {
    accessorKey: "monto",
    header: "Monto",
    cell: ({ row }) => {
      const monto = row.getValue("monto") as number;
      return <p className="font-bold">{formatCurrency(monto, "ARS", 0)}</p>;
    },
  },
  {
    accessorKey: "acreedor_id",
    header: "Acreedor",
    cell: ({ row }) => {
      const acreedorId = row.getValue("acreedor_id") as string;
      const acreedorNombre =
        acreedores.find((a) => a.value === acreedorId)?.label ||
        acreedorId ||
        "-";
      return <p className="font-bold">{acreedorNombre}</p>;
    },
  },
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
      const deuda = row.original;
      return (
        <div className="flex items-center gap-x-2">
          <Button size="icon" variant="outline" onClick={() => onEdit(deuda)}>
            <Pencil size={16} />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onConfirmSaldar(deuda)}
          >
            <HandMetal size={16} className="text-success" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onConfirmDelete(deuda.id)}
          >
            <Trash2 size={16} className="text-destructive" />
          </Button>
        </div>
      );
    },
  },
];
