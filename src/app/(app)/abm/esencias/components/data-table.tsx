"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Esencia } from "@/app/types/esencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { X, Plus, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [proveedores, setProveedores] = useState<
    { id: string; nombre: string; }[]
  >([]);
  const [categorias, setCategorias] = useState<
    { id: string; nombre: string; }[]
  >([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const supabase = createClient();

  // normaliza texto y chequea si el nombre contiene "ezentie"
  const norm = (s: string | null | undefined) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const isEzentieNombre = (nombre?: string | null) =>
    norm(nombre).includes("ezentie");

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

    const fetchCategorias = async () => {
      setLoadingCategorias(true);
      const { data, error } = await supabase
        .from("insumos_categorias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) {
        toast.error("Error al cargar categorías de insumos");
      } else {
        setCategorias(
          (data || []).map((item: any) => ({
            id: item.id,
            nombre: item.nombre ?? "",
          })),
        );
      }
      setLoadingCategorias(false);
    };

    fetchProveedores();
    fetchCategorias();
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

  const FormSchema = z.object({
    nombre: z.string().nonempty("El nombre es obligatorio"),
    precio_usd: z
      .number()
      .min(0, "El precio en dólares debe ser mayor o igual a 0")
      .nonnegative("El precio USD no puede ser negativo"),
    precio_ars: z
      .number()
      .min(0, "El precio en pesos debe ser mayor o igual a 0")
      .nonnegative("El precio ARS no puede ser negativo"),
    cantidad_gramos: z
      .number()
      .min(0, "La cantidad de gramos debe ser mayor o igual a 0")
      .nonnegative("La cantidad de gramos no puede ser negativa"),
    proveedor_id: z.string().nonempty("El proveedor es obligatorio"),
    is_consultar: z.boolean(),
    genero: z.enum(["masculino", "femenino", "ambiente", "otro"]),
    insumos_categorias_id: z
      .string()
      .nonempty({ message: "La categoría es obligatoria" }),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      nombre: "",
      precio_usd: 0,
      precio_ars: 0,
      cantidad_gramos: 0,
      proveedor_id: "",
      is_consultar: false,
      genero: generoPorDefault,
      insumos_categorias_id: "",
    },
  });

  const proveedor_id = form.watch("proveedor_id");
  const proveedorSeleccionado = proveedores.find((p) => p.id === proveedor_id);
  const precioUsd = form.watch("precio_usd");

  useEffect(() => {
    const prov = proveedores.find((p) => p.id === proveedor_id);
    if (prov && isEzentieNombre(prov.nombre)) {
      const precioConvertido = (precioUsd || 0) * (dolarARS || 0);
      form.setValue("precio_ars", precioConvertido);
    }
  }, [precioUsd, proveedor_id, dolarARS, proveedores, form]);

  useEffect(() => {
    if (esenciaToEdit) {
      const safeDefaults = {
        nombre: esenciaToEdit.nombre ?? "",
        precio_usd: esenciaToEdit.precio_usd ?? 0,
        precio_ars: esenciaToEdit.precio_ars ?? 0,
        cantidad_gramos: esenciaToEdit.cantidad_gramos ?? 0,
        proveedor_id: esenciaToEdit.proveedor_id ?? "",
        is_consultar: esenciaToEdit.is_consultar ?? false,
        genero: esenciaToEdit.genero ?? generoPorDefault,
        insumos_categorias_id: esenciaToEdit.insumos_categorias_id ?? "",
      };
      form.reset(safeDefaults);
      setIsDialogOpen(true);
    }
  }, [esenciaToEdit]);

  const handleNew = () => {
    if (onEditReset) onEditReset();
    form.reset({
      nombre: "",
      precio_usd: 0,
      precio_ars: 0,
      cantidad_gramos: 0,
      proveedor_id: "",
      is_consultar: false,
      genero: generoPorDefault,
      insumos_categorias_id: "",
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
      precio_usd: data.precio_usd || 0,
      precio_ars: data.precio_ars || 0,
      cantidad_gramos: data.cantidad_gramos || 0,
    };

    let error;

    if (esenciaToEdit) {
      const res = await supabase
        .from("esencias")
        .update(safeData)
        .eq("id", esenciaToEdit.id);
      error = res.error;
    } else {
      const res = await supabase.from("esencias").insert([safeData]);
      error = res.error;
    }

    if (error) {
      toast.error("Error al guardar la esencia", {
        description: error.message,
      });
    } else {
      toast.success(
        esenciaToEdit
          ? "¡Esencia actualizada correctamente!"
          : "¡Esencia agregada correctamente!",
      );
      if (onEsenciaCreated) onEsenciaCreated();
      setIsDialogOpen(false);
      if (onEditReset) onEditReset();
    }

    setIsLoadingForm(false);
  }

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

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) handleCloseModal();
        }}
        aria-describedby={undefined}
      >
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {esenciaToEdit ? "Editar esencia" : "Nueva esencia"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 items-start gap-4">
                <FormField
                  control={form.control}
                  name="is_consultar"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-x-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>¿Consultar stock?</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insumos_categorias_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona una categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingCategorias ? (
                            <SelectItem value="undefined" disabled>
                              Cargando...
                            </SelectItem>
                          ) : categorias.length === 0 ? (
                            <SelectItem value="undefined" disabled>
                              No hay categorías
                            </SelectItem>
                          ) : (
                            categorias.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                {/* Mostrar USD si el proveedor es Ezentie (en cualquier variante de nombre) */}
                {isEzentieNombre(proveedorSeleccionado?.nombre) ? (
                  <FormField
                    control={form.control}
                    name="precio_usd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio USD</FormLabel>
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
                ) : (
                  <FormField
                    control={form.control}
                    name="precio_ars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio ARS</FormLabel>
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
                )}

                {/* Proveedor */}
                <FormField
                  control={form.control}
                  name="proveedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona un proveedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingProveedores ? (
                            <SelectItem value="undefined" disabled>
                              Cargando...
                            </SelectItem>
                          ) : proveedores.length === 0 ? (
                            <SelectItem value="undefined" disabled>
                              No hay proveedores
                            </SelectItem>
                          ) : (
                            proveedores.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cantidad_gramos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
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
                <FormField
                  control={form.control}
                  name="genero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Género</FormLabel>
                      <Select
                        value={field.value}
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
              </div>

              <div className="mt-4 flex items-center justify-end gap-x-2">
                <Button type="submit" disabled={isLoadingForm} size="sm">
                  {isLoadingForm && (
                    <Loader2 width={18} className="animate-spin" />
                  )}
                  {esenciaToEdit ? "Guardar cambios" : "Agregar esencia"}
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
