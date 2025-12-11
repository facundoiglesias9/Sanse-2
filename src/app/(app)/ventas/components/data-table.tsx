"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { formatDate } from "@/app/helpers/formatDate";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Plus } from "lucide-react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  selectedVenta?: any;
  onViewReset?: () => void;
  fechaFiltro: string;
  setFechaFiltro: React.Dispatch<React.SetStateAction<string>>;
  totalCaja: number;
  onNewGasto: () => void;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  selectedVenta,
  onViewReset,
  fechaFiltro,
  setFechaFiltro,
  totalCaja,
  onNewGasto,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnFilters },
  });

  useEffect(() => {
    if (selectedVenta) setIsDialogOpen(true);
  }, [selectedVenta]);

  const handleCloseModal = () => {
    setIsDialogOpen(false);
    setTimeout(() => {
      if (onViewReset) onViewReset();
    }, 300);
  };

  return (
    <>
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) handleCloseModal();
        }}
        aria-describedby={undefined}
      >
        <DialogContent className="sm:max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              Detalle de la venta - {selectedVenta?.cliente}
            </DialogTitle>
          </DialogHeader>
          {selectedVenta && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/6 text-start">Fecha</TableHead>
                    <TableHead className="w-1/6 text-center">
                      Cantidad
                    </TableHead>
                    <TableHead className="w-1/4">Perfumes</TableHead>
                    <TableHead className="w-1/6 text-center">Género</TableHead>
                    <TableHead className="w-1/6 text-right">Precio</TableHead>
                  </TableRow>
                </TableHeader>
              </Table>

              <ScrollArea className="max-h-[300px]">
                <TooltipProvider>
                  <Table>
                    <TableBody>
                      {selectedVenta.perfumes
                        .split(";")
                        .filter((str: string) => str.trim() !== "")
                        .map((item: string, index: number) => {
                          const match = item.match(
                            /(.+?) x (\d+) - (.+?) \[\$(\d+)\]/,
                          );
                          if (!match) return null;

                          const [, nombre, cantidadStr, genero, precioStr] =
                            match;
                          const cantidad = Number(cantidadStr);
                          const precio = Number(precioStr);
                          const unitario = precio / cantidad;

                          return (
                            <TableRow key={index}>
                              <TableCell className="text-start w-1/6">
                                {index === 0 &&
                                  formatDate(
                                    new Date(selectedVenta.created_at),
                                  )}
                              </TableCell>
                              <TableCell className="text-center w-1/6">
                                {index === 0 && selectedVenta.cantidad_perfumes}
                              </TableCell>
                              <TableCell className="w-1/4">
                                {nombre.trim()} x {cantidad}
                              </TableCell>
                              <TableCell className="text-center w-1/6">
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
                              </TableCell>
                              <TableCell className="text-right w-1/6">
                                {cantidad > 1 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-default font-medium">
                                        {formatCurrency(precio, "ARS", 0)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      Precio unitario:{" "}
                                      {formatCurrency(unitario, "ARS", 0)}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  formatCurrency(precio, "ARS", 0)
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </ScrollArea>

              <Table>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-bold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(selectedVenta.precio_total, "ARS", 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </>
          )}
          <div className="mt-4 flex items-center justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCloseModal}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Select
            value={fechaFiltro}
            onValueChange={(value) => setFechaFiltro(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ventas</SelectItem>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="ayer">Ayer</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="anio">Este año</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="gap-x-2" onClick={onNewGasto}>
            <Plus width={18} />
            Agregar gasto
          </Button>
        </div>
        <div className="font-bold text-lg">
          Total en caja: {formatCurrency(totalCaja, "ARS", 0)}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Cargando datos...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No hay resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </>
  );
}
