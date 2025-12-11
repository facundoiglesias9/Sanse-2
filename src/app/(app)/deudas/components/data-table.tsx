"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Deudas } from "@/app/types/deudas";
import { X, Plus, Loader2, Check, ChevronsUpDown } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  onDeudaCreated?: () => void;
  deudaToEdit?: Deudas | null;
  onEditReset?: () => void;
  totalDeudas: number;
  acreedores: { value: string; label: string; }[];
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters,
  isLoading = false,
  filterColumnId = "detalle",
  onDeudaCreated,
  deudaToEdit,
  onEditReset,
  totalDeudas,
  acreedores,
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
    detalle: z.string().min(1, "El detalle es obligatorio"),
    monto: z
      .number()
      .min(0, "El monto debe ser mayor o igual a 0")
      .nonnegative("La cantidad no puede ser negativa"),
    acreedor_id: z.string({
      required_error: "El acreedor es obligatorio",
    }),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      detalle: "",
      monto: 0,
      acreedor_id: "",
    },
  });

  useEffect(() => {
    if (deudaToEdit) {
      const safeDefaults = {
        detalle: deudaToEdit.detalle ?? "",
        monto: deudaToEdit.monto ?? 0,
        acreedor_id: deudaToEdit.acreedor_id ?? "",
      };
      form.reset(safeDefaults);
      setIsDialogOpen(true);
    }
  }, [deudaToEdit]);

  const handleNew = () => {
    if (onEditReset) onEditReset();
    form.reset({
      detalle: "",
      monto: 0,
      acreedor_id: "",
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

    if (deudaToEdit) {
      const res = await supabase
        .from("deudas")
        .update(data)
        .eq("id", deudaToEdit.id);
      error = res.error;
    } else {
      const res = await supabase.from("deudas").insert([data]);
      error = res.error;
    }

    if (error) {
      toast.error("Error al guardar la deuda", {
        description: error.message,
      });
    } else {
      toast.success("¡Deuda guardada correctamente!");
      if (onDeudaCreated) onDeudaCreated();
      setIsDialogOpen(false);
      if (onEditReset) onEditReset();
    }

    setIsLoadingForm(false);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <div className="relative max-w-sm">
            <Input
              placeholder="Buscar por detalle..."
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
            Agregar deuda
          </Button>
        </div>
        <div className="font-bold text-lg">
          Total de deudas: {formatCurrency(totalDeudas, "ARS", 0)}
        </div>
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
              {deudaToEdit ? "Editar deuda" : "Nueva deuda"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="detalle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalle</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={2}
                          thousandSeparator="."
                          decimalSeparator=","
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
              <FormField
                control={form.control}
                name="acreedor_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Acreedor</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-[200px] justify-between",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value
                              ? acreedores.find(
                                (acreedor) => acreedor.value === field.value,
                              )?.label
                              : "Selecionar acreedor"}
                            <ChevronsUpDown className="opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Buscar acreedor..."
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>Acreedor no encontrado.</CommandEmpty>
                            <CommandGroup>
                              {acreedores.map((acreedor) => (
                                <CommandItem
                                  value={acreedor.label}
                                  key={acreedor.value}
                                  onSelect={() => {
                                    form.setValue(
                                      "acreedor_id",
                                      acreedor.value,
                                    );
                                  }}
                                >
                                  {acreedor.label}
                                  <Check
                                    className={cn(
                                      "ml-auto",
                                      acreedor.value === field.value
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="mt-4 flex items-center justify-end gap-x-2">
                <Button type="submit" disabled={isLoadingForm} size="sm">
                  {isLoadingForm && (
                    <Loader2 width={18} className="animate-spin" />
                  )}
                  {deudaToEdit ? "Guardar cambios" : "Agregar deuda"}
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
