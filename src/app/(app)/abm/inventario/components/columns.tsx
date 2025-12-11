"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Inventario } from "@/app/types/inventario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { formatDate } from "@/app/helpers/formatDate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function getLowStockMeta(it: { tipo: string; nombre: string; cantidad: number; }) {
  const tipo = (it.tipo || "").trim();
  const name = (it.nombre || "").trim().toLowerCase();

  if (tipo === "Perfume") return { low: false, threshold: null };
  if (tipo === "Frasco") return { low: it.cantidad <= 4, threshold: 4 };
  if (tipo === "Etiqueta") return { low: it.cantidad <= 4, threshold: 4 };
  if (tipo === "Esencia") return { low: it.cantidad <= 15, threshold: 15 };

  if (tipo === "Insumo") {
    if (name.includes("alcohol")) return { low: it.cantidad <= 500, threshold: 500 };
    if (name.includes("bolsas de madera")) return { low: it.cantidad <= 10, threshold: 10 };
  }

  return { low: false, threshold: null };
}

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
      header: "Tipo",
      cell: ({ row }) => {
        const tipo = row.getValue("tipo") as string;
        return (
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
        );
      },
    },
    {
      accessorKey: "genero",
      header: "Género",
      cell: ({ row }) => {
        const genero = row.getValue("genero") as string;
        return (
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
        );
      },
    },
    {
      accessorKey: "cantidad",
      header: "Cantidad",
      cell: ({ row }) => <p>{row.getValue("cantidad") as number}</p>,
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
        const it = row.original;
        return (
          <div className="flex items-center gap-2">
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
