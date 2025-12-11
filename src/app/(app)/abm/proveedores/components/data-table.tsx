"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Proveedor } from "@/app/types/proveedor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onProveedorCreated?: () => void;
  proveedorToEdit?: Proveedor | null;
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
  onProveedorCreated,
  proveedorToEdit,
  onEditReset,
}: DataTableProps<TData>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);

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
    gramos_configurados: z
      .number()
      .min(0, "Los gramos deben ser mayor o igual a 0")
      .nonnegative("Los gramos no pueden ser negativos"),
    margen_venta: z
      .number()
      .min(0, "El margen de venta debe ser mayor o igual a 0")
      .nonnegative("El margen de venta no puede ser negativo"),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      nombre: "",
      gramos_configurados: 0,
    },
  });

  useEffect(() => {
    if (proveedorToEdit) {
      const safeDefaults = {
        nombre: proveedorToEdit.nombre ?? "",
        gramos_configurados: proveedorToEdit.gramos_configurados ?? 0,
        margen_venta: proveedorToEdit.margen_venta ?? 0,
      };
      form.reset(safeDefaults);
      setIsDialogOpen(true);
    }
  }, [proveedorToEdit]);

  const handleNew = () => {
    if (onEditReset) onEditReset();
    form.reset({
      nombre: "",
      gramos_configurados: 0,
      margen_venta: 0,
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

    if (proveedorToEdit) {
      const res = await supabase
        .from("proveedores")
        .update(data)
        .eq("id", proveedorToEdit.id);
      error = res.error;
    } else {
      const res = await supabase.from("proveedores").insert([data]);
      error = res.error;
    }

    if (error) {
      toast.error("Error al guardar el proveedor", {
        description: error.message,
      });
    } else {
      toast.success("¡Proveedor guardado correctamente!");
      if (onProveedorCreated) onProveedorCreated();
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
          Agregar proveedor
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
              {proveedorToEdit ? "Editar proveedor" : "Nuevo proveedor"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="flex items-center gap-x-2">
                <FormField
                  control={form.control}
                  name="margen_venta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Margen de venta</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={2}
                          thousandSeparator="."
                          decimalSeparator=","
                          suffix=" %"
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
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gramos_configurados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gramos configurados</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={2}
                          thousandSeparator="."
                          decimalSeparator=","
                          suffix=" gr"
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
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-x-2">
                <Button type="submit" disabled={isLoadingForm} size="sm">
                  {isLoadingForm && (
                    <Loader2 width={18} className="animate-spin" />
                  )}
                  {proveedorToEdit ? "Guardar cambios" : "Agregar proveedor"}
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
