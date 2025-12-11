"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/app/helpers/formatDate";
import { Proveedor } from "@/app/types/proveedor";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const proveedoresColumns = (
  onConfirmDelete: (id: string) => void,
  onEdit: (proveedor: Proveedor) => void,
): ColumnDef<Proveedor>[] => [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => <p className="font-bold">{row.getValue("nombre")}</p>,
    },
    {
      accessorKey: "gramos_configurados",
      header: "Gramos configurados",
      cell: ({ row }) => <p>{row.getValue("gramos_configurados")}</p>,
    },
    {
      accessorKey: "margen_venta",
      header: "Margen de venta",
      cell: ({ row }) => <p>{row.getValue("margen_venta")} %</p>,
    },
    {
      accessorKey: "color",
      header: "Color",
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger>
            <Badge
              className="h-5 min-w-5 rounded-full px-1 tabular-nums"
              variant={row.getValue("color")}
            /></TooltipTrigger>
          <TooltipContent>
            <p>{row.getValue("color") ?? "default"}</p>
          </TooltipContent>
        </Tooltip>
      ),
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
        const proveedor = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
              onClick={() => onEdit(proveedor)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
              onClick={() => onConfirmDelete(proveedor.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
