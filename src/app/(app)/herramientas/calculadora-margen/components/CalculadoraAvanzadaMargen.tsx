"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { TablaInsumos } from "@/app/(app)/herramientas/calculadora-margen/components/TablaInsumos";
import { Insumo } from "@/app/(app)/herramientas/calculadora-margen/types";
import { redondearAlMilMasCercano } from "@/app/helpers/redondear";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

const FormSchema = z.object({
  proveedor_id: z.string().nonempty("El proveedor es obligatorio"),
  precio_esencia: z
    .number()
    .min(0, "El precio debe ser mayor a 0")
    .nonnegative("El precio no puede ser negativo"),
  moneda: z.enum(["ARS", "USD"]),
  gramos_comprar: z
    .number()
    .min(1, "Los gramos deben ser mayor a 0")
    .nonnegative("La cantidad no puede ser negativa"),
  tipo_frasco: z.enum(["femenino", "masculino", "otro"]),
  insumos_categoria_id: z.string().nonempty("La categoría es obligatoria"),
  margen: z.number().min(0, "El margen debe ser mayor a 0"),
  descuento_mayorista: z
    .number()
    .min(0, "El descuento debe ser mayor a 0")
    .max(100, "El descuento no puede ser mayor a 100"),
});

type ResultadoCalculo = {
  // costos (exactos)
  costoTotal: number;

  // precios sugeridos
  precioSugeridoExacto: number;
  precioSugeridoRedondeado: number;
  ajusteRedondeoSugerido: number; // redondeado - exacto

  // precios mayoristas
  precioMayoristaExacto: number;
  precioMayoristaRedondeado: number;

  // márgenes teóricos (sin redondeo)
  margenDineroTeorico: number;
  margenPorcentajeTeorico: number;

  // márgenes efectivos (usando precio redondeado de venta)
  margenDineroEfectivo: number;
  margenPorcentajeEfectivo: number;
};

export default function CalculadoraAvanzadaMargen() {
  const [resultados, setResultados] = useState<ResultadoCalculo | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [proveedores, setProveedores] = useState<
    {
      id: string;
      nombre: string;
      gramos_configurados?: number;
      margen_venta?: number;
    }[]
  >([]);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string; }[]>(
    [],
  );
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [loadingInsumosCategorias, setLoadingInsumosCategorias] =
    useState(false);
  const monedas = ["ARS", "USD"];
  const { currencies } = useCurrencies();
  const supabase = createClient();

  // === helpers de formato y precisión ===
  const to2 = (n: number) => Math.round(n * 100) / 100;
  const fmtARS = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  useEffect(() => {
    const fetchProveedores = async () => {
      setLoadingProveedores(true);
      const { data, error } = await supabase
        .from("proveedores")
        .select("id, nombre, gramos_configurados, margen_venta");

      if (error) {
        toast.error("Error al cargar proveedores");
      } else {
        setProveedores(
          (data || []).map((item: any) => ({
            id: item.id,
            nombre: item.nombre ?? "",
            gramos_configurados: item.gramos_configurados,
            margen_venta: item.margen_venta,
          })),
        );
      }
      setLoadingProveedores(false);
    };

    fetchProveedores();
  }, []);

  useEffect(() => {
    async function fetchInsumos() {
      const { data, error } = await supabase.from("insumos").select("*");
      if (error) {
        console.error("Error al cargar insumos:", error);
        toast.error("No se pudieron cargar los insumos.");
        return;
      }
      setInsumos(
        (data ?? []).map((insumo: any) => ({
          id: insumo.id,
          nombre: insumo.nombre,
          precioLote: insumo.precio_lote,
          cantidadLote: insumo.cantidad_lote,
          cantidadNecesaria: insumo.cantidad_necesaria,
          isGeneral: insumo.is_general,
          proveedorId: insumo.proveedor_id ?? null,
          insumosCategoriasId: insumo.insumos_categorias_id,
        })),
      );
    }

    async function fetchInsumosCategorias() {
      setLoadingInsumosCategorias(true);
      const { data, error } = await supabase
        .from("insumos_categorias")
        .select("id, nombre");

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
      setLoadingInsumosCategorias(false);
    }

    fetchInsumos();
    fetchInsumosCategorias();
  }, []);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      proveedor_id: "",
      precio_esencia: 0,
      moneda: "ARS",
      gramos_comprar: 30,
      tipo_frasco: "femenino",
      insumos_categoria_id: "999b53c3-f181-4910-86fd-5c5b1f74af7b", // Perfumería fina
      margen: 100,
      descuento_mayorista: 15,
    },
  });

  const moneda = form.watch("moneda");
  const proveedor_id = form.watch("proveedor_id");

  // Cuando cambia el proveedor, autocompleta margen sugerido
  useEffect(() => {
    const proveedor = proveedores.find((p) => p.id === proveedor_id);
    if (proveedor) {
      if (
        proveedor.margen_venta != null &&
        !isNaN(Number(proveedor.margen_venta))
      ) {
        form.setValue("margen", Number(proveedor.margen_venta));
      }
    }
  }, [proveedor_id, proveedores, form]);

  const tipoFrasco = form.watch("tipo_frasco");
  const insumos_categoria_id = form.watch("insumos_categoria_id");
  const proveedorSeleccionado = proveedores.find((p) => p.id === proveedor_id);

  const frascoSeleccionado = insumos.find((insumo) => {
    const nombre = insumo.nombre.trim().toLowerCase();
    const perteneceCategoria =
      insumo.insumosCategoriasId === insumos_categoria_id;

    if (!perteneceCategoria) return false;
    if (tipoFrasco === "femenino")
      return nombre.includes("femenino") && nombre.includes("frasco");
    if (tipoFrasco === "masculino")
      return nombre.includes("masculino") && nombre.includes("frasco");
    return false;
  });

  const insumosGenerales = insumos.filter(
    (insumo) =>
      insumo.isGeneral &&
      insumo.insumosCategoriasId === insumos_categoria_id &&
      (insumo.proveedorId === proveedor_id || insumo.proveedorId === null),
  );

  const idsBase = [
    ...insumosGenerales.map((i) => i.id),
    ...(frascoSeleccionado ? [frascoSeleccionado.id] : []),
  ];

  const esFrasco = (insumo: Insumo) => {
    const nombre = insumo.nombre.trim().toLowerCase();
    return (
      nombre.includes("frasco") &&
      (nombre.includes("femenino") || nombre.includes("masculino"))
    );
  };

  const insumosAgregados = insumos.filter(
    (i) =>
      !idsBase.includes(i.id) &&
      !esFrasco(i) &&
      i.insumosCategoriasId === insumos_categoria_id,
  );

  const insumosParaTabla = [
    ...insumosGenerales,
    ...(frascoSeleccionado &&
      !insumosGenerales.some((i) => i.id === frascoSeleccionado.id)
      ? [{ ...frascoSeleccionado, esFrascoSeleccionado: true }]
      : []),
    ...insumosAgregados,
  ];

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoadingForm(true);

    const insumosParaCalculo = [
      ...insumosGenerales,
      ...(frascoSeleccionado &&
        !insumosGenerales.some((i) => i.id === frascoSeleccionado.id)
        ? [frascoSeleccionado]
        : []),
      ...insumosAgregados,
    ];

    calcularMargen(
      data.proveedor_id,
      data.precio_esencia,
      data.gramos_comprar,
      data.margen,
      data.descuento_mayorista,
      insumosParaCalculo,
    );

    setIsLoadingForm(false);
  }

  function calcularMargen(
    proveedor_id: string,
    precio_esencia: number,
    cantidad_gramos: number,
    margen: number,
    descuento_mayorista: number,
    insumos: Insumo[],
  ) {
    setResultados(null);

    try {
      const proveedor = proveedores.find((p) => p.id === proveedor_id);
      const gramosPor = proveedor?.gramos_configurados ?? 1;

      const perfumesPorCantidad =
        cantidad_gramos && gramosPor > 0 ? cantidad_gramos / gramosPor : 1;

      // Conversión solo si la moneda es USD
      if (moneda === "USD" && currencies["ARS"]) {
        precio_esencia = precio_esencia * currencies["ARS"];
      }

      // Costos exactos
      const costoMateriaPrima =
        perfumesPorCantidad > 0 ? precio_esencia / perfumesPorCantidad : 0;

      const costoInsumosGenerales = insumos.reduce((acc, insumo) => {
        const costoUnitario =
          insumo.cantidadLote > 0
            ? (insumo.precioLote / insumo.cantidadLote) *
            insumo.cantidadNecesaria
            : 0;
        return acc + costoUnitario;
      }, 0);

      const costoTotal = to2(costoMateriaPrima + costoInsumosGenerales);

      // Precios exactos
      const margenMultiplicador = 1 + Number(margen) / 100;
      const precioSugeridoExacto = to2(costoTotal * margenMultiplicador);

      const descuentoFactor = 1 - Number(descuento_mayorista) / 100;
      const precioMayoristaExacto = to2(precioSugeridoExacto * descuentoFactor);

      // Redondeos "comerciales"
      const precioSugeridoRedondeado = redondearAlMilMasCercano(
        precioSugeridoExacto,
      );
      const precioMayoristaRedondeado = redondearAlMilMasCercano(
        precioMayoristaExacto,
      );

      // Ajuste explícito por redondeo (cuánto se movió el precio sugerido)
      const ajusteRedondeoSugerido = to2(
        precioSugeridoRedondeado - precioSugeridoExacto,
      );

      // Márgenes teóricos (sin redondeo)
      const margenDineroTeorico = to2(precioSugeridoExacto - costoTotal);
      const margenPorcentajeTeorico =
        costoTotal > 0 ? to2((margenDineroTeorico / costoTotal) * 100) : 0;

      // Márgenes efectivos (usando el precio redondeado de venta)
      const margenDineroEfectivo = to2(precioSugeridoRedondeado - costoTotal);
      const margenPorcentajeEfectivo =
        costoTotal > 0 ? to2((margenDineroEfectivo / costoTotal) * 100) : 0;

      setResultados({
        costoTotal,
        precioSugeridoExacto,
        precioSugeridoRedondeado,
        ajusteRedondeoSugerido,
        precioMayoristaExacto,
        precioMayoristaRedondeado,
        margenDineroTeorico,
        margenPorcentajeTeorico,
        margenDineroEfectivo,
        margenPorcentajeEfectivo,
      });
    } catch (err: any) {
      console.error("Error en el cálculo:", err);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col p-5">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mb-6"
          >
            <div className="grid items-start grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="proveedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingProveedores ? (
                          <div className="px-4 py-2 text-muted-foreground">
                            Cargando...
                          </div>
                        ) : proveedores.length === 0 ? (
                          <div className="px-4 py-2 text-muted-foreground">
                            No hay proveedores
                          </div>
                        ) : (
                          proveedores.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Selecciona un proveedor para autocompletar el margen y
                      gramos configurados utilizado en los calculos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-start gap-x-2">
                <FormField
                  control={form.control}
                  name="precio_esencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de la esencia</FormLabel>
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
                      <FormDescription className="text-xs">
                        Para ingresar valores decimales, utiliza el punto (. )
                        como separador. Ejemplo: 12.5
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="moneda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {monedas.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="grid items-start grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gramos_comprar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Esencia a comprar</FormLabel>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo_frasco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de frasco</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  name="insumos_categoria_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria de insumos</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingInsumosCategorias ? (
                            <div className="px-4 py-2 text-muted-foreground">
                              Cargando...
                            </div>
                          ) : categorias.length === 0 ? (
                            <div className="px-4 py-2 text-muted-foreground">
                              No hay categorías
                            </div>
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
            </div>
            <div className="grid items-start grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="margen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margen</FormLabel>
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
                    <FormDescription className="text-xs">
                      {proveedorSeleccionado?.margen_venta != null
                        ? `Margen sugerido para este proveedor: ${proveedorSeleccionado.margen_venta}%`
                        : "Sin margen sugerido para este proveedor."}
                      <br />
                      Podés editar el margen para simular diferentes escenarios.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descuento_mayorista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descuento mayorista</FormLabel>
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
            </div>

            {/* Insumos generales */}
            <TablaInsumos
              value={insumosParaTabla}
              categoriaActiva={insumos_categoria_id}
              onChange={(nuevoArrayFiltrado) => {
                setInsumos((insumosPrevios) =>
                  insumosPrevios
                    .map((insumo) => {
                      const actualizado = nuevoArrayFiltrado.find(
                        (i) => i.id === insumo.id,
                      );
                      return actualizado ? actualizado : insumo;
                    })
                    .filter(
                      (insumo) =>
                        nuevoArrayFiltrado.some((i) => i.id === insumo.id) ||
                        !insumosParaTabla.some((i) => i.id === insumo.id),
                    )
                    .concat(
                      nuevoArrayFiltrado.filter(
                        (i) =>
                          !insumosPrevios.some((insumo) => insumo.id === i.id),
                      ),
                    ),
                );
              }}
            />

            <div className="flex justify-center items-center gap-x-4">
              <Button type="submit" disabled={isLoadingForm}>
                {isLoadingForm && (
                  <Loader2 width={18} className="animate-spin" />
                )}
                Calcular margen
              </Button>
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="outline"
                disabled={resultados === null}
              >
                {showDetails ? "Ocultar detalles" : "Ver detalles"}
              </Button>
            </div>
          </form>
        </Form>

        {/* Resultados */}
        {resultados && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-muted/50 border-2 border-primary/20 rounded-xl shadow-lg p-6 space-y-2">
              <div>
                <div className="text-xl font-bold flex items-center gap-x-2 mb-2">
                  <span>📊</span>
                  <h3>Resultados</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para mayor claridad mostramos el precio{" "}
                  <strong>redondeado</strong> y también el valor{" "}
                  <strong>exacto</strong> (sin redondeo). El margen
                  <em> efectivo</em> se calcula con el precio redondeado.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Costo total */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    Costo total por perfume (exacto)
                  </span>
                  <span className="font-semibold text-lg">
                    {fmtARS(resultados.costoTotal)}
                  </span>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.span
                        className="text-[10px] text-green-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        costoTotal = costoMateriaPrima + costoInsumosGenerales
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Precio sugerido */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    Precio de venta sugerido (redondeado)
                  </span>
                  <span className="font-semibold text-lg">
                    {fmtARS(resultados.precioSugeridoRedondeado)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Exacto: {fmtARS(resultados.precioSugeridoExacto)}{" "}
                    {resultados.ajusteRedondeoSugerido !== 0 ? (
                      <em>
                        · Ajuste:{" "}
                        <span
                          className={
                            resultados.ajusteRedondeoSugerido >= 0
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }
                        >
                          {fmtARS(resultados.ajusteRedondeoSugerido)}
                        </span>
                      </em>
                    ) : null}
                  </span>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.span
                        className="text-[10px] text-green-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        precioSugerido = costoTotal × (1 + margen / 100)
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Precio mayorista */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    Precio mayorista (redondeado)
                  </span>
                  <span className="font-semibold text-lg">
                    {fmtARS(resultados.precioMayoristaRedondeado)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Exacto: {fmtARS(resultados.precioMayoristaExacto)}
                  </span>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.span
                        className="text-[10px] text-green-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        precioMayorista = precioSugerido ×
                        (1 - descuentoMayorista / 100)
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Margen en dinero */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    Margen en dinero
                  </span>
                  <span className="font-semibold text-lg">
                    {fmtARS(resultados.margenDineroEfectivo)}
                  </span>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.span
                        className="text-[10px] text-green-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        margenDinero = precioVenta - costoTotal
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Margen */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-muted-foreground text-sm">
                    Margen
                  </span>
                  <span className="font-semibold text-lg">
                    {resultados.margenPorcentajeEfectivo.toFixed(2)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Teórico sin redondeo:{" "}
                    {resultados.margenPorcentajeTeorico.toFixed(2)}%
                  </span>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.span
                        className="text-[10px] text-green-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        margen% = (margenDinero / costoTotal) × 100
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
