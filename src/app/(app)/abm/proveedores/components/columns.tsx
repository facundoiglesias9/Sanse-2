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
      header: () => <div className="text-center">Nombre</div>,
      cell: ({ row }) => <div className="text-center font-bold">{row.getValue("nombre")}</div>,
    },
    {
      accessorKey: "gramos_configurados",
      header: () => <div className="text-center">Gramos configurados</div>,
      cell: ({ row }) => <div className="text-center">{row.getValue("gramos_configurados")}</div>,
    },
    {
      accessorKey: "margen_venta",
      header: () => <div className="text-center">Margen de venta</div>,
      cell: ({ row }) => <div className="text-center">{row.getValue("margen_venta")} %</div>,
    },
    {
      accessorKey: "color",
      header: () => <div className="text-center">Color</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger>
              <Badge
                className="h-5 min-w-5 rounded-full px-1 tabular-nums"
                variant={row.getValue("color")}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{row.getValue("color") ?? "default"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      ),
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
        const proveedor = row.original;
        return (
          <div className="flex items-center justify-center gap-2">
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
