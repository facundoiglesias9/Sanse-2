"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Inventario } from "@/app/types/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { formatDate } from "@/app/helpers/formatDate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { getLowStockMeta } from "@/app/helpers/stock-logic";

export const inventarioColumns = (
  onConfirmDelete: (id: string) => void,
  onEdit: (inventario: Inventario) => void,
): ColumnDef<Inventario>[] => [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => {
        const nombre = row.getValue("nombre") as string;
        const tipo = row.original.tipo as string;
        const cantidad = Number(row.original.cantidad) || 0;

        // Preferimos los flags precalculados si existen; si no, calculamos acá.
        const preLow = (row.original as any)._lowStock as boolean | undefined;
        const preThr = (row.original as any)._lowStockThreshold as number | null | undefined;
        const meta = preLow !== undefined ? { low: preLow, threshold: preThr ?? null } : getLowStockMeta({ tipo, nombre, cantidad });

        const tooltipText =
          meta.threshold === null
            ? `Cantidad: ${cantidad}`
            : meta.threshold === 0
              ? `Sin stock (cantidad = ${cantidad})`
              : `Stock bajo (≤ ${meta.threshold}). Cantidad: ${cantidad}`;

        return (
          <div className="relative inline-block font-bold">
            {meta.low && (
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <span
                      className="absolute -left-2 -top-1 h-2 w-2 rounded-full bg-red-500 z-10"
                      aria-label={tooltipText}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">{tooltipText}</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {nombre}
          </div>
        );
      },
    },
    {
      accessorKey: "tipo",
      header: () => <div className="text-center">Tipo</div>,
      cell: ({ row }) => {
        const tipo = row.getValue("tipo") as string;
        return (
          <div className="flex justify-center">
            <Badge
              variant={
                tipo === "Frasco"
                  ? "outline"
                  : tipo === "Insumo"
                    ? "warning"
                    : tipo === "Esencia"
                      ? "purple"
                      : tipo === "Perfume"
                        ? "success"
                        : "default"
              }
            >
              {tipo}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "genero",
      header: () => <div className="text-center">Género</div>,
      cell: ({ row }) => {
        const genero = row.getValue("genero") as string;
        return (
          <div className="flex justify-center">
            <Badge
              variant={genero === "masculino"
                ? "indigo"
                : genero === "femenino"
                  ? "pink"
                  : genero === "ambiente"
                    ? "warning"
                    : "default"
              }
            >
              {capitalizeFirstLetter(genero)}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "cantidad",
      header: () => <div className="text-center">Cantidad</div>,
      cell: ({ row }) => <div className="text-center font-medium">{row.getValue("cantidad") as number}</div>,
    },
    {
      accessorKey: "updated_at",
      header: () => <div className="text-center">Última actualización</div>,
      cell: ({ row }) => {
        const updatedAt = row.getValue("updated_at") as string;
        return <div className="text-center text-muted-foreground text-sm">{formatDate(new Date(updatedAt))}</div>;
      },
    },
    {
      accessorKey: "acciones",
      header: () => <div className="text-center">Acciones</div>,
      cell: ({ row }) => {
        const it = row.original;
        return (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
              onClick={() => onEdit(it)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
              onClick={() => onConfirmDelete(it.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
