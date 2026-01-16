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
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Esencia
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
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
          <div className="flex items-center justify-center w-full gap-2 font-bold">
            {isScraped && (
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <span
                      className="h-2 w-2 rounded-full bg-blue-500 shrink-0"
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
      header: () => <div className="text-center">Precio USD</div>,
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return <div className="text-center">Consultar</div>;
        const precioUsd = row.getValue("precio_usd") as number;
        if (precioUsd === 0) return <div className="text-center">N/A</div>;
        return <div className="text-center">{formatCurrency(precioUsd, "USD")}</div>;
      },
    },
    {
      accessorKey: "precio_ars",
      header: () => <div className="text-center">Precio ARS</div>,
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return <div className="text-center">Consultar</div>;
        const precioArs = row.getValue("precio_ars") as number;
        if (precioArs === 0) return <div className="text-center">N/A</div>;
        return <div className="text-center">{formatCurrency(precioArs, "ARS")}</div>;
      },
    },
    {
      accessorKey: "precio_por_perfume",
      header: () => <div className="text-center">Precio por perfume</div>,
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return <div className="text-center">Consultar</div>;
        const precio = row.getValue("precio_por_perfume") as number;
        return <div className="text-center font-bold">{formatCurrency(precio, "ARS")}</div>;
      },
    },
    {
      accessorKey: "cantidad_gramos",
      header: () => <div className="text-center">Cantidad (gr)</div>,
      cell: ({ row }) => {
        const scrapeConsultar = Boolean((row.original as any)._scrape_consultar);
        if (row.original.is_consultar || scrapeConsultar) return <div className="text-center">Consultar</div>;
        const cantidadGramos = row.getValue("cantidad_gramos") as number;
        return <div className="text-center">{cantidadGramos}</div>;
      },
    },
    {
      accessorKey: "proveedor_id",
      header: () => <div className="text-center">Proveedor</div>,
      filterFn: (row, id, value) => {
        if (!value) return true;
        return row.getValue(id) === value;
      },
      cell: ({ row }) => {
        const proveedor = row.original.proveedores;
        if (!proveedor) return <div className="text-center"><Badge variant="outline">N/A</Badge></div>;
        return (
          <div className="flex justify-center">
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
          </div>
        );
      },
    },
    {
      accessorKey: "familia_olfativa",
      header: () => <div className="text-center">Familia Olfativa</div>,
      filterFn: (row, id, value) => {
        if (!value) return true;
        const rowValue = row.getValue(id) as string | null;
        if (!rowValue) return false;
        return rowValue.includes(value);
      },
      cell: ({ row }) => {
        const val = row.getValue("familia_olfativa") as string | null;
        if (!val) return <div className="text-center">-</div>;
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className="max-w-[150px] truncate block" title={val}>
              {val}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "updated_at",
      header: () => <div className="text-center">Última actualización</div>,
      cell: ({ row }) => {
        const last =
          (row.original as any)._last_update ??
          (row.getValue("updated_at") as string);
        return <div className="text-center">{formatDate(new Date(last))}</div>;
      },
    },
    {
      accessorKey: "acciones",
      header: () => <div className="text-center">Acciones</div>,
      cell: ({ row }) => {
        const esencia = row.original;
        return (
          <div className="flex items-center justify-center gap-2">
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
