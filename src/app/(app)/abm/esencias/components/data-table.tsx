"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Esencia } from "@/app/types/esencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { X, Plus, Filter, Search, FileUp } from "lucide-react";
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
import { ImportPDFDialog } from "./import-pdf-dialog";

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
  headerChildren?: React.ReactNode;
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
  headerChildren,
}: DataTableProps<TData>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [proveedores, setProveedores] = useState<
    { id: string; nombre: string; }[]
  >([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchProveedores = async () => {
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

  // Manejar modo de edición desde propiedades
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
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="relative max-w-sm w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre..."
              value={filterValue}
              onChange={(event) =>
                table.getColumn("nombre")?.setFilterValue(event.target.value)
              }
              className="pl-9 pr-10 bg-background"
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
            onValueChange={(value) =>
              table
                .getColumn("genero")
                ?.setFilterValue(value === "todos" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[150px] bg-background">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Género" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los proveedores</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="femenino">Femenino</SelectItem>
              <SelectItem value="ambiente">Ambiente</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              table
                .getColumn("proveedor_id")
                ?.setFilterValue(value === "todos" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[180px] bg-background">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Proveedor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los géneros</SelectItem>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              table
                .getColumn("familia_olfativa")
                ?.setFilterValue(value === "todos" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[180px] bg-background">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Familia Olfativa" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las familias</SelectItem>
              <SelectItem value="Cítrico">Cítrico</SelectItem>
              <SelectItem value="Floral">Floral</SelectItem>
              <SelectItem value="Amaderado">Amaderado</SelectItem>
              <SelectItem value="Frutal">Frutal</SelectItem>
              <SelectItem value="Dulce">Dulce</SelectItem>
              <SelectItem value="Especiado">Especiado</SelectItem>
              <SelectItem value="Fresco">Fresco</SelectItem>
              <SelectItem value="Oriental">Oriental</SelectItem>
              <SelectItem value="Gourmand">Gourmand</SelectItem>
              <SelectItem value="Herbal">Herbal</SelectItem>
              <SelectItem value="Almizclada">Almizclada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 w-full xl:w-auto justify-end">
          {headerChildren}
          <Button
            size="sm"
            variant="outline"
            className="gap-x-2"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <FileUp width={18} />
            Importar PDF
          </Button>
          <Button size="sm" className="gap-x-2" onClick={handleNew}>
            <Plus width={18} />
            Agregar esencia
          </Button>
        </div>
      </div>

      <EsenciaDialog
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        esenciaToEdit={esenciaToEdit}
        onSuccess={onEsenciaCreated}
        dolarARS={dolarARS}
        generoPorDefault={generoPorDefault}
      />

      <ImportPDFDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={onEsenciaCreated}
        proveedores={proveedores}
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