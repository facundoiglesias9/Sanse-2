"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Inventario } from "@/app/types/inventario";
import { getLowStockMeta } from "@/app/helpers/stock-logic";
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
  FormDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Loader2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  onInventarioCreated?: () => void;
  inventarioToEdit?: Inventario | null;
  onEditReset?: () => void;
  generoPorDefault: "masculino" | "femenino" | null;
  tipoOptions: string[];
  onManageTipos?: () => void;
}

export function DataTable<TData extends { tipo?: string; nombre?: string; cantidad?: number; }>({
  columns,
  data,
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters,
  isLoading = false,
  filterColumnId = "nombre",
  onInventarioCreated,
  inventarioToEdit,
  onEditReset,
  generoPorDefault,
  tipoOptions,
  onManageTipos,
}: DataTableProps<TData>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [mostrarPerfumesCero, setMostrarPerfumesCero] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const supabase = createClient();

  const orderedTipoOptions = useMemo(() => {
    const fromProps = (tipoOptions || [])
      .map((t) => (t ?? "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(fromProps));

    if (inventarioToEdit?.tipo) {
      const current = inventarioToEdit.tipo.trim();
      if (current && !unique.includes(current)) unique.push(current);
    }

    return unique.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [tipoOptions, inventarioToEdit?.tipo]);

  // getLowStockMeta is now imported from @/app/helpers/stock-logic

  // enriquecimiento + filtro local (según toggle)
  const dataEnriched = useMemo(() => {
    const base = (data || []).map((it: any) => {
      const meta = getLowStockMeta({
        tipo: it.tipo ?? "",
        nombre: it.nombre ?? "",
        cantidad: Number(it.cantidad) || 0,
      });
      return {
        ...it,
        _lowStock: meta.low,
        _lowStockThreshold: meta.threshold,
      };
    });

    if (mostrarPerfumesCero) return base;

    const isPerfume = (t?: string) => (t ?? "").trim().toLowerCase() === "perfume";
    return base.filter((it: any) => !(isPerfume(it.tipo) && (Number(it.cantidad) || 0) === 0));
  }, [data, mostrarPerfumesCero]);

  const table = useReactTable({
    data: dataEnriched as TData[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnFilters },
    autoResetPageIndex: false,
  });

  const filterValue =
    (table.getColumn(filterColumnId)?.getFilterValue() as string) ?? "";

  const FormSchema = useMemo(
    () =>
      z.object({
        nombre: z.string().nonempty({ message: "El nombre es obligatorio" }),
        tipo: z
          .string()
          .nonempty({ message: "El tipo es obligatorio" })
          .refine(
            (value) =>
              orderedTipoOptions.length === 0 ||
              orderedTipoOptions.some(
                (option) => option.toLowerCase() === value.toLowerCase(),
              ),
            { message: "Seleccioná un tipo válido" },
          ),
        genero: z.enum(["masculino", "femenino", "ambiente", "otro"]).nullable(),
        cantidad: z
          .number()
          .min(0, "La cantidad debe ser mayor o igual a 0")
          .nonnegative("La cantidad no puede ser negativa"),
      }),
    [orderedTipoOptions],
  );

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      nombre: "",
      tipo: "",
      genero: generoPorDefault,
      cantidad: 0,
    },
  });

  useEffect(() => {
    if (inventarioToEdit) {
      const safeDefaults = {
        nombre: inventarioToEdit.nombre ?? "",
        tipo: inventarioToEdit.tipo ?? "",
        genero: inventarioToEdit.genero ?? generoPorDefault,
        cantidad: inventarioToEdit.cantidad ?? 0,
      };
      form.reset(safeDefaults);
      setIsDialogOpen(true);
    }
  }, [inventarioToEdit]);

  const handleNew = () => {
    if (onEditReset) onEditReset();
    form.reset({
      nombre: "",
      tipo: "",
      cantidad: 0,
      genero: generoPorDefault,
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

    const safeData = {
      ...data,
      nombre: data.nombre.trim(),
      tipo: data.tipo.trim(),
      cantidad: data.cantidad || 0,
      genero: data.genero || "otro",
    };

    let error;

    if (inventarioToEdit) {
      const res = await supabase
        .from("inventario")
        .update(safeData)
        .eq("id", inventarioToEdit.id);
      error = res.error;
    } else {
      const res = await supabase.from("inventario").insert([safeData]);
      error = res.error;
    }

    if (error) {
      toast.error("Error al guardar el item", {
        description: error.message,
      });
    } else {
      toast.success("¡Item guardado correctamente!");
      if (onInventarioCreated) onInventarioCreated();
      setIsDialogOpen(false);
      if (onEditReset) onEditReset();
    }

    setIsLoadingForm(false);
  }

  const handleSendLowStock = async () => {
    setIsSendingEmail(true);
    try {
      const response = await fetch("/api/inventory/send-low-stock-report", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el reporte");
      }

      if (data.count === 0) {
        toast.info("No hay items con stock bajo para reportar.");
      } else {
        toast.success(`Reporte enviado con éxito (${data.count} items).`);
      }
    } catch (error: any) {
      toast.error("Error al enviar el reporte", {
        description: error.message,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">

          {/* Sección de Filtros */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
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
                typeof table.getColumn("tipo")?.getFilterValue() === "string"
                  ? (table.getColumn("tipo")?.getFilterValue() as string)
                  : "todos"
              }
              onValueChange={(value) =>
                table
                  .getColumn("tipo")
                  ?.setFilterValue(value === "todos" ? undefined : value)
              }
              disabled={orderedTipoOptions.length === 0}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {orderedTipoOptions.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Acciones y Conmutadores */}
          <div className="flex flex-col gap-3 items-end w-full lg:w-auto">
            {/* Alternar shadcn/ui */}
            <div className="flex items-center gap-2 mb-1">
              <Label htmlFor="toggle-cero" className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Mostrar perfumes sin stock
              </Label>
              <Switch
                id="toggle-cero"
                checked={mostrarPerfumesCero}
                onCheckedChange={(v) => setMostrarPerfumesCero(Boolean(v))}
              />
            </div>

            <div className="flex items-center gap-3">
              {onManageTipos && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onManageTipos}
                  className="border-primary/20 hover:border-primary/50 text-foreground"
                >
                  Gestionar tipos
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                onClick={handleSendLowStock}
                disabled={isSendingEmail}
                title="Enviar stock bajo"
              >
                {isSendingEmail ? <Loader2 className="animate-spin h-4 w-4" /> : <Mail width={18} />}
              </Button>
              <Button
                size="sm"
                className="gap-x-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all"
                onClick={handleNew}
              >
                <Plus width={18} />
                Agregar item
              </Button>
            </div>
          </div>
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
              {inventarioToEdit ? "Editar item" : "Nuevo item"}
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        disabled={orderedTipoOptions.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orderedTipoOptions.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {orderedTipoOptions.length === 0 && (
                        <FormDescription className="text-xs">
                          Configurá tipos en el gestor para poder crear items.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="genero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Género</FormLabel>
                      <Select
                        value={field.value ?? undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar género" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="femenino">Femenino</SelectItem>
                          <SelectItem value="ambiente">Ambiente</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cantidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
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
              </div>

              <div className="mt-4 flex items-center justify-end gap-x-2">
                <Button type="submit" disabled={isLoadingForm} size="sm">
                  {isLoadingForm && (
                    <Loader2 width={18} className="animate-spin" />
                  )}
                  {inventarioToEdit ? "Guardar cambios" : "Agregar inventario"}
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
