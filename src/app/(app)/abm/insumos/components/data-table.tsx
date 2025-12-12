"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Insumo } from "@/app/types/insumo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { X, Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

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
  onInsumoCreated?: () => void;
  insumoToEdit?: Insumo | null;
  onEditReset?: () => void;
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
  onInsumoCreated,
  insumoToEdit,
  onEditReset,
}: DataTableProps<TData>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  // Category fetching logic removed

  const supabase = createClient();

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

  const FormSchema = z.object({
    nombre: z.string().nonempty({ message: "El nombre es obligatorio" }),
    cantidad_necesaria: z
      .number()
      .min(0, "La cantidad debe ser mayor o igual a 0")
      .nonnegative("La cantidad no puede ser negativa"),
    precio_lote: z.number().nonnegative("El precio no puede ser negativo"),
    cantidad_lote: z.number().nonnegative("La cantidad no puede ser negativa"),
    insumos_categorias_id: z.string().optional().nullable(),
    is_general: z.boolean(),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      nombre: "",
      cantidad_necesaria: 0,
      precio_lote: 0,
      cantidad_lote: 0,
      insumos_categorias_id: null,
      is_general: false,
    },
  });

  useEffect(() => {
    if (insumoToEdit) {
      const safeDefaults = {
        nombre: insumoToEdit.nombre ?? "",
        cantidad_necesaria: insumoToEdit.cantidad_necesaria ?? 0,
        precio_lote: insumoToEdit.precio_lote ?? 0,
        cantidad_lote: insumoToEdit.cantidad_lote ?? 0,
        insumos_categorias_id: insumoToEdit.insumos_categorias_id ?? "",
        is_general: insumoToEdit.is_general ?? false,
      };
      form.reset(safeDefaults);
      setIsDialogOpen(true);
    }
  }, [insumoToEdit]);

  const handleNew = () => {
    if (onEditReset) onEditReset();
    form.reset({
      nombre: "",
      cantidad_necesaria: 0,
      precio_lote: 0,
      cantidad_lote: 0,
      insumos_categorias_id: "",
      is_general: false,
    });
    setIsDialogOpen(true);
  };

  const handleCloseModal = () => {
    setIsDialogOpen(false);
    setTimeout(() => {
      form.reset();
      if (onEditReset) onEditReset();
    }, 300);
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoadingForm(true);
    let error;

    if (insumoToEdit) {
      const res = await supabase
        .from("insumos")
        .update(data)
        .eq("id", insumoToEdit.id);
      error = res.error;
    } else {
      const res = await supabase.from("insumos").insert([data]);
      error = res.error;
    }

    if (error) {
      toast.error("Error al guardar el insumo", {
        description: error.message,
      });
    } else {
      toast.success("¡Insumo guardado correctamente!");
      if (onInsumoCreated) onInsumoCreated();
      setIsDialogOpen(false);
      if (onEditReset) onEditReset();
    }

    setIsLoadingForm(false);
  }

  return (
    <>
      <div className="flex items-center gap-x-4">
        <div className="relative max-w-sm">
          <Input
            placeholder="Buscar por nombre..."
            value={filterValue}
            onChange={(event) =>
              table
                .getColumn(filterColumnId)
                ?.setFilterValue(event.target.value)
            }
            className="pr-10"
          />
          {filterValue !== "" && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() =>
                table.getColumn(filterColumnId)?.setFilterValue("")
              }
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <Button size="sm" className="gap-x-2" onClick={handleNew}>
          <Plus width={18} />
          Agregar insumo
        </Button>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) handleCloseModal();
        }}
        aria-describedby={undefined}
      >
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {insumoToEdit ? "Editar insumo" : "Nuevo insumo"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="is_general"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-x-3 mb-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={
                            insumoToEdit?.id ===
                            "1f826bb3-0f2b-42db-9209-2f7a425a620c" ||
                            insumoToEdit?.id ===
                            "53733085-0cf6-4d9e-bdf1-00fae9d71fda"
                          }
                        />
                      </FormControl>
                      <FormLabel>¿Insumo general?</FormLabel>
                    </div>
                    <FormDescription className="text-xs">
                      Si el insumo es general, se calculará junto con los demás
                      insumos generales de su misma categoría.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cantidad_necesaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad necesaria</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={0}
                          value={
                            typeof field.value === "number"
                              ? field.value
                              : field.value === undefined || field.value === null || field.value === ""
                                ? undefined
                                : Number(field.value)
                          }
                          onValueChange={(n) => field.onChange(n ?? 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref as any}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="precio_lote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio por lote</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          thousandSeparator="."
                          decimalSeparator=","
                          value={typeof field.value === "number" ? field.value : undefined}
                          onValueChange={(n) => field.onChange(n ?? 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref as any}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cantidad_lote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad por lote</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={0}
                          value={
                            typeof field.value === "number"
                              ? field.value
                              : field.value === undefined || field.value === null || field.value === ""
                                ? undefined
                                : Number(field.value)
                          }
                          onValueChange={(n) => field.onChange(n ?? 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref as any}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
// Category FormField Removed
              </div>

              <div className="mt-4 flex items-center justify-end gap-x-2">
                <Button type="submit" disabled={isLoadingForm} size="sm">
                  {isLoadingForm && (
                    <Loader2 width={18} className="animate-spin" />
                  )}
                  {insumoToEdit ? "Guardar cambios" : "Agregar insumo"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border mt-4">
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
