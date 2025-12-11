"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { formatDate } from "@/app/helpers/formatDate";
import { Esencia } from "@/app/types/esencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const esenciasColumns = (
  onConfirmDelete: (id: string) => void,
  onEdit: (esencia: Esencia) => void,
): ColumnDef<Esencia>[] => [
    {
      accessorKey: "nombre",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Esencia
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const nombre = row.getValue("nombre") as string;

        const scrapeFuente = (row.original as any)._scrape_fuente as "vanrossum" | undefined;
        const isScraped = scrapeFuente === "vanrossum";

        const scrapeTimeISO = (row.original as any)._scrape_time as string | undefined;
        const timeTxt = scrapeTimeISO
          ? new Date(scrapeTimeISO).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
          : undefined;

        return (
          <div className="relative inline-block font-bold">
            {isScraped && (
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <span
                      className="absolute -left-2 -top-1 h-2 w-2 rounded-full bg-blue-500 z-10"
                      aria-label={timeTxt ? `Actualizado con scraping: ${timeTxt}` : "Actualizado con scraping"}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">
                      {timeTxt ? `Actualizado con scraping: ${timeTxt}` : "Actualizado con scraping"}
                    </span>
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
      accessorKey: "precio_usd",
      header: "Precio USD",
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return "Consultar";
        const precioUsd = row.getValue("precio_usd") as number;
        if (precioUsd === 0) return "N/A";
        return <p>{formatCurrency(precioUsd, "USD")}</p>;
      },
    },
    {
      accessorKey: "precio_ars",
      header: "Precio ARS",
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return "Consultar";
        const precioArs = row.getValue("precio_ars") as number;
        if (precioArs === 0) return "N/A";
        return <p>{formatCurrency(precioArs, "ARS")}</p>;
      },
    },
    {
      accessorKey: "precio_por_perfume",
      header: "Precio por perfume",
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return "Consultar";
        const precio = row.getValue("precio_por_perfume") as number;
        return <p className="font-bold">{formatCurrency(precio, "ARS")}</p>;
      },
    },
    {
      accessorKey: "cantidad_gramos",
      header: "Cantidad (gr)",
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return "Consultar";
        const cantidadGramos = row.getValue("cantidad_gramos") as number;
        return <p>{cantidadGramos}</p>;
      },
    },
    {
      accessorKey: "proveedor_id",
      header: "Proveedor",
      filterFn: (row, id, value) => {
        if (!value) return true;
        return row.getValue(id) === value;
      },
      cell: ({ row }) => {
        const proveedor = row.original.proveedores;
        if (!proveedor) return <Badge variant="outline">N/A</Badge>;
        return (
          <Badge
            variant={
              [
                "default",
                "secondary",
                "destructive",
                "outline",
                "warning",
                "success",
                "indigo",
                "pink",
                "purple",
              ].includes(proveedor.color as string)
                ? (proveedor.color as
                  | "default"
                  | "secondary"
                  | "destructive"
                  | "outline"
                  | "warning"
                  | "success"
                  | "indigo"
                  | "pink"
                  | "purple")
                : "default"
            }
          >
            {proveedor.nombre}
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
            variant={
              genero === "masculino"
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
      accessorKey: "updated_at",
      header: "Última actualización",
      cell: ({ row }) => {
        const last =
          (row.original as any)._last_update ??
          (row.getValue("updated_at") as string);
        return <p>{formatDate(new Date(last))}</p>;
      },
    },
    {
      accessorKey: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const esencia = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
              onClick={() => onEdit(esencia)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
              onClick={() => onConfirmDelete(esencia.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
