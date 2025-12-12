"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Esencia } from "@/app/types/esencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { X, Plus } from "lucide-react";
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
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EsenciaDialog } from "./esencia-dialog";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  sorting: SortingState;
  setSorting: (
    updater: SortingState | ((old: SortingState) => SortingState),
  ) => void;
  columnFilters: ColumnFiltersState;
  setColumnFilters: (
    updater:
      | ColumnFiltersState
      | ((old: ColumnFiltersState) => ColumnFiltersState),
  ) => void;
  isLoading?: boolean;
  filterColumnId?: string;
  onEsenciaCreated?: () => void;
  esenciaToEdit?: Esencia | null;
  onEditReset?: () => void;
  dolarARS: number;
  generoPorDefault: "masculino" | "femenino";
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters,
  isLoading = false,
  filterColumnId = "nombre",
  onEsenciaCreated,
  esenciaToEdit,
  onEditReset,
  dolarARS,
  generoPorDefault,
}: DataTableProps<TData>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [proveedores, setProveedores] = useState<
    { id: string; nombre: string; }[]
  >([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchProveedores = async () => {
      setLoadingProveedores(true);
      const { data, error } = await supabase
        .from("proveedores")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) {
        toast.error("Error al cargar proveedores");
      } else {
        setProveedores(
          (data || []).map((item: any) => ({
            id: item.id,
            nombre: item.nombre ?? "",
          })),
        );
      }
      setLoadingProveedores(false);
    };

    fetchProveedores();
  }, []);

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

  const filterValue =
    (table.getColumn(filterColumnId)?.getFilterValue() as string) ?? "";

  // Handle Edit Mode from props
  useEffect(() => {
    if (esenciaToEdit) {
      setIsDialogOpen(true);
    }
  }, [esenciaToEdit]);

  const handleNew = () => {
    if (onEditReset) onEditReset();
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setTimeout(() => {
        if (onEditReset) onEditReset();
      }, 300);
    }
  };

  return (
    <>
      <div className="flex items-center gap-x-4 mb-4">
        <div className="relative max-w-sm">
          <Input
            placeholder="Buscar por nombre..."
            value={filterValue}
            onChange={(event) =>
              table.getColumn("nombre")?.setFilterValue(event.target.value)
            }
            className="pr-10"
          />
          {filterValue !== "" && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => table.getColumn("nombre")?.setFilterValue("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Select
          value={
            typeof table.getColumn("genero")?.getFilterValue() === "string"
              ? (table.getColumn("genero")?.getFilterValue() as string)
              : "todos"
          }
          onValueChange={(value) =>
            table
              .getColumn("genero")
              ?.setFilterValue(value === "todos" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filtrar por género" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
            <SelectItem value="ambiente">Ambiente</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={
            typeof table.getColumn("proveedor_id")?.getFilterValue() ===
              "string"
              ? (table.getColumn("proveedor_id")?.getFilterValue() as string)
              : "todos"
          }
          onValueChange={(value) =>
            table
              .getColumn("proveedor_id")
              ?.setFilterValue(value === "todos" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por proveedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-x-2" onClick={handleNew}>
          <Plus width={18} />
          Agregar esencia
        </Button>
      </div>

      <EsenciaDialog
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        esenciaToEdit={esenciaToEdit}
        onSuccess={onEsenciaCreated}
        dolarARS={dolarARS}
        generoPorDefault={generoPorDefault}
      />

      <div className="border rounded-md">
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
                <TableCell colSpan={columns.length} className="text-center">
                  Cargando datos...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
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
                <TableCell colSpan={columns.length} className="text-center">
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
