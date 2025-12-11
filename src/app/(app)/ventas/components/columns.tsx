"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { formatDate } from "@/app/helpers/formatDate";
import { Ventas } from "@/app/types/ventas";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, Trash2 } from "lucide-react";

export const ventasColumns = (
  onView: (ventas: Ventas) => void,
): ColumnDef<Ventas>[] => [
  {
    accessorKey: "created_at",
    header: "Fecha",
    cell: ({ row }) => {
      const fecha = row.getValue("created_at") as string;
      return <p className="font-semibold">{formatDate(new Date(fecha))}</p>;
    },
  },
  {
    accessorKey: "cliente",
    header: "Cliente",
    cell: ({ row }) => {
      const cliente = row.getValue("cliente") as string;
      return <p>{cliente}</p>;
    },
  },
  {
    accessorKey: "cantidad_perfumes",
    header: "Cantidad total",
    cell: ({ row }) => {
      const cantidadPerfumes = row.getValue("cantidad_perfumes") as number;
      return <p>{cantidadPerfumes}</p>;
    },
  },
  {
    accessorKey: "precio_total",
    header: "Precio total",
    cell: ({ row }) => {
      const total = row.getValue("precio_total") as number;
      return <p className="font-bold">{formatCurrency(total, "ARS", 0)}</p>;
    },
  },
  {
    accessorKey: "acciones",
    header: "Acciones",
    cell: ({ row }) => {
      const ventas = row.original;
      return (
        <div className="flex items-center gap-x-2">
          <Button size="icon" variant="outline" onClick={() => onView(ventas)}>
            <Eye size={16} />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => toast.info("No se puede eliminar una venta")}
          >
            <Trash2 size={16} className="text-destructive" />
          </Button>
        </div>
      );
    },
  },
];
