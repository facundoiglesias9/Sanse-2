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
import { Loader2 } from "lucide-react";
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

interface EsenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esenciaToEdit?: Esencia | null;
  defaultValues?: Partial<Esencia>;
  onSuccess?: (createdEsencia: Esencia) => void;
  dolarARS: number;
  generoPorDefault?: "masculino" | "femenino" | "ambiente" | "otro";
}

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

export function EsenciaDialog({
  open,
  onOpenChange,
  esenciaToEdit,
  defaultValues,
  onSuccess,
  dolarARS,
  generoPorDefault = "masculino",
}: EsenciaDialogProps) {
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
    const fetchResources = async () => {
      setLoadingProveedores(true);
      setLoadingCategorias(true);

      const [provRes, catRes] = await Promise.all([
        supabase
          .from("proveedores")
          .select("id, nombre")
          .order("nombre", { ascending: true }),
        supabase
          .from("insumos_categorias")
          .select("id, nombre")
          .order("nombre", { ascending: true }),
      ]);

      if (provRes.error) {
        toast.error("Error al cargar proveedores");
      } else {
        setProveedores(
          (provRes.data || []).map((item: any) => ({
            id: item.id,
            nombre: item.nombre ?? "",
          }))
        );
      }

      if (catRes.error) {
        toast.error("Error al cargar categorías de insumos");
      } else {
        setCategorias(
          (catRes.data || []).map((item: any) => ({
            id: item.id,
            nombre: item.nombre ?? "",
          }))
        );
      }
      setLoadingProveedores(false);
      setLoadingCategorias(false);
    };

    if (open) {
      fetchResources();
    }
  }, [open]);

  // Cálculo de precios para Ezentie
  useEffect(() => {
    const prov = proveedores.find((p) => p.id === proveedor_id);
    if (prov && isEzentieNombre(prov.nombre)) {
      const precioConvertido = (precioUsd || 0) * (dolarARS || 0);
      form.setValue("precio_ars", precioConvertido);
    }
  }, [precioUsd, proveedor_id, dolarARS, proveedores, form]);

  useEffect(() => {
    if (open) {
      if (esenciaToEdit) {
        form.reset({
          nombre: esenciaToEdit.nombre ?? "",
          precio_usd: esenciaToEdit.precio_usd ?? 0,
          precio_ars: esenciaToEdit.precio_ars ?? 0,
          cantidad_gramos: esenciaToEdit.cantidad_gramos ?? 0,
          proveedor_id: esenciaToEdit.proveedor_id ?? "",
          is_consultar: esenciaToEdit.is_consultar ?? false,
          genero: esenciaToEdit.genero ?? generoPorDefault,
          insumos_categorias_id: esenciaToEdit.insumos_categorias_id ?? "",
        });
      } else if (defaultValues) {
        form.reset({
          nombre: defaultValues.nombre ?? "",
          precio_usd: defaultValues.precio_usd ?? 0,
          precio_ars: defaultValues.precio_ars ?? 0,
          cantidad_gramos: defaultValues.cantidad_gramos ?? 0,
          proveedor_id: defaultValues.proveedor_id ?? "",
          is_consultar: defaultValues.is_consultar ?? false,
          genero: defaultValues.genero ?? generoPorDefault,
          insumos_categorias_id: defaultValues.insumos_categorias_id ?? "",
        });
      } else {
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
      }
    }
  }, [open, esenciaToEdit, defaultValues, generoPorDefault]);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => form.reset(), 300);
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
    let resultData;

    if (esenciaToEdit) {
      const res = await supabase
        .from("esencias")
        .update(safeData)
        .eq("id", esenciaToEdit.id)
        .select()
        .single();
      error = res.error;
      resultData = res.data;
    } else {
      const res = await supabase.from("esencias").insert([safeData]).select().single();
      error = res.error;
      resultData = res.data;
    }

    if (error) {
      toast.error("Error al guardar la esencia", {
        description: error.message,
      });
    } else {
      toast.success(
        esenciaToEdit
          ? "¡Esencia actualizada correctamente!"
          : "¡Esencia agregada correctamente!"
      );
      if (onSuccess && resultData) onSuccess(resultData);
      handleClose();
    }

    setIsLoadingForm(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
                          value={
                            typeof field.value === "number" ? field.value : undefined
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
                          value={
                            typeof field.value === "number" ? field.value : undefined
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
                            : field.value === undefined ||
                              field.value === null ||
                              field.value === ""
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
                onClick={handleClose}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
