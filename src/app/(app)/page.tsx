"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/app/(app)/components/lista_de_precios/data-table";
import { getListaPreciosColumns } from "@/app/(app)/components/lista_de_precios/columns";
import { Perfume } from "@/app/types/perfume";
import { createClient } from "@/utils/supabase/client";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { LoaderTable } from "@/app/(app)/components/loader-table";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ListaDePreciosPage() {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [loadingTableListaDePrecios, setLoadingTableListaDePrecios] =
    useState(false);

  const [show100g, setShow100g] = useState(false);

  const searchParams = useSearchParams();
  const view = (searchParams.get("view") as "minorista" | "mayorista") || "minorista";

  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();

  const fetchListaDePrecios = async () => {
    setLoadingTableListaDePrecios(true);

    const { data: esencias } = await supabase
      .from("esencias")
      .select(
        `
          *,
          insumos_categorias:insumos_categorias_id(id, nombre),
          proveedores(id, nombre, gramos_configurados, color, margen_venta)
        `,
      )
      .order("nombre", { ascending: true });

    // Ya no dependemos de "precios_vanrossum_latest" para el precio activo, usamos columnas en esencias
    // Pero mantenemos compatibilidad por si acaso (aunque priorizamos esencias.precio_ars_100g/30g)

    const { data: insumos } = await supabase.from("insumos").select("*");

    const frascoFemenino = insumos?.find(
      (i) => i.nombre === "Frascos femeninos",
    );
    const frascoMasculino = insumos?.find(
      (i) => i.nombre === "Frascos masculinos",
    );

    const calcularCostoFrasco = (insumo: any) =>
      insumo && insumo.cantidad_lote > 0
        ? (insumo.precio_lote / insumo.cantidad_lote) *
        insumo.cantidad_necesaria
        : 0;

    const DESCUENTO_MAYORISTA = 0.85; // 15% de descuento

    const perfumesCalculados: Perfume[] = (esencias ?? [])
      .filter((esencia) => !esencia.is_consultar)
      .map((esencia) => {
        let precioFinalArs = 0;
        let cantidadParaCalculo = 1;

        // Lógica dinámica de precio
        if (show100g) {
          if (esencia.precio_ars_100g) {
            precioFinalArs = esencia.precio_ars_100g;
            cantidadParaCalculo = 100;
          } else {
            // Fallback si no hay 100g específico pero queremos ver eso... 
            // O usamos la lógica legacy de "si es VanRossum intentar 100"
            // Si no hay dato, usamos precio_ars base
            if (esencia.precio_usd && currencies["ARS"]) {
              precioFinalArs = esencia.precio_usd * currencies["ARS"];
              cantidadParaCalculo = esencia.cantidad_gramos ?? 1;
            } else if (esencia.precio_ars) {
              // Aquí podríamos entrar si es un producto manual
              precioFinalArs = esencia.precio_ars;
              cantidadParaCalculo = esencia.cantidad_gramos ?? 1;
            }
          }
        } else {
          // 30g mode (Default)
          if (esencia.precio_ars_30g) {
            precioFinalArs = esencia.precio_ars_30g;
            cantidadParaCalculo = 30;
          } else {
            // Fallback
            if (esencia.precio_usd && currencies["ARS"]) {
              precioFinalArs = esencia.precio_usd * currencies["ARS"];
              cantidadParaCalculo = esencia.cantidad_gramos ?? 1;
            } else if (esencia.precio_ars) {
              precioFinalArs = esencia.precio_ars;
              cantidadParaCalculo = esencia.cantidad_gramos ?? 1;

              // Corrección legacy: si precio_ars era de 100g pero estamos en 30g mode?
              // Asumimos precio_ars es "el que está configurado como default".
            }
          }
        }

        const gramosPor = esencia.proveedores?.gramos_configurados ?? 1;
        // Normalizamos precio unitario
        // Si cantidadParaCalculo = 100, precioFinalArs = $X. 
        // Costo x perfume = (Precio / CantidadParaCalculo) * (Gramos x Perfume ? No)

        // Wait, logic above was:
        // perfumesPorCantidad = esencia.cantidad_gramos / gramosPor
        // costo = precioFinal / perfumesPorCantidad

        // Nueva lógica:
        // Tenemos $X por Y gramos.
        // Costo por gramo = $X / Y
        // Un perfume usa Z gramos (1?).
        // Ajustemos:

        const gramosBase = cantidadParaCalculo; // 30 o 100 (o lo que tenga la esencia)
        const costoPorGramo = gramosBase > 0 ? (precioFinalArs / gramosBase) : 0;
        const gramosPorPerfume = gramosPor; // "gramos_configurados" es lo que usa un perfume?
        // En código original: "perfumesPorCantidad = cantidad_gramos / gramosPor" => "Cuantos perfumes saco de esta botella"
        // Ej: Botella 100g, un perfume usa 30g? No, gramos_configurados suele ser 50g o 100g?
        // "esencia.proveedores.gramos_configurados" -> 1.
        // Asumamos que el costo materia prima es unitario si gramosPor=1.

        // Legacy:
        // perfumesPorCantidad = (100 / 1) = 100.
        // precio_por_perfume = (10000 / 100) = 100.

        // Vamos a respetar la formula anterior adaptando los inputs:
        // Input: "esencia.cantidad_gramos" ahora es dinámico "cantidadParaCalculo"

        const perfumesPorCantidad = cantidadParaCalculo / gramosPor;
        const costoMateriaPrima = perfumesPorCantidad > 0 ? precioFinalArs / perfumesPorCantidad : 0;

        // Cálculo del frasco según género
        let costoFrasco = 0;
        let costoOtrosInsumos = 0;

        // Priority: Custom Insumos (FULL OVERRIDE)
        if (esencia.custom_insumos && Array.isArray(esencia.custom_insumos) && esencia.custom_insumos.length > 0) {
          costoFrasco = 0; // Custom list assumes full responsibility
          costoOtrosInsumos = esencia.custom_insumos.reduce((acc: number, customIns: any) => {
            // Buscamos el insumo ACTUAL en la base de datos para tener precio actualizado
            const insumoReal = insumos?.find((i) => i.id === customIns.id);

            if (insumoReal) {
              const costoU = insumoReal.cantidad_lote > 0
                ? (insumoReal.precio_lote / insumoReal.cantidad_lote)
                : 0;
              // Usamos la cantidad guardada en la receta
              return acc + (costoU * (customIns.cantidad || 0));
            }
            return acc;
          }, 0);
        } else {
          // Fallback logic removed as part of Category decoupling.
          // If no custom_insumos are defined, the product has no extra costs.
          costoFrasco = 0;
          costoOtrosInsumos = 0;
        }

        const costoTotal =
          costoMateriaPrima + costoFrasco + costoOtrosInsumos;

        // Margen Minorista
        const margenPorcentaje = esencia.margen_minorista ?? (esencia.proveedores?.margen_venta ?? 100);
        const margenDecimal = margenPorcentaje / 100;
        const precio = costoTotal * (1 + margenDecimal);

        // Precio Mayorista
        let precioMayorista = 0;
        if (esencia.margen_mayorista != null) {
          precioMayorista = costoTotal * (1 + esencia.margen_mayorista / 100);
        } else {
          precioMayorista = precio * DESCUENTO_MAYORISTA;
        }

        return {
          id: esencia.id,
          nombre: esencia.nombre,
          genero: esencia.genero,
          proveedor: esencia.proveedor,
          costo: costoTotal,
          precio,
          precio_mayorista: precioMayorista,
          proveedor_id: esencia.proveedor_id,
          proveedores: esencia.proveedores,
          insumos_categorias_id: esencia.insumos_categorias?.id,
          insumos_categorias: esencia.insumos_categorias,
          precio_ars: precioFinalArs,
          precio_usd: esencia.precio_usd,
          cantidad_gramos: cantidadParaCalculo,
          // Custom fields passthrough
          margen_minorista: esencia.margen_minorista,
          margen_mayorista: esencia.margen_mayorista,
          custom_insumos: esencia.custom_insumos,
        };
      });

    setPerfumes(perfumesCalculados);
    setLoadingTableListaDePrecios(false);
  };

  useEffect(() => {
    if (!loadingCurrencies) {
      fetchListaDePrecios();
    }
  }, [currencies, loadingCurrencies, show100g]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-center">
          Lista de precios {view === "mayorista" ? "mayorista" : "minorista"}
        </h1>
        <Tabs
          value={show100g ? "100g" : "30g"}
          onValueChange={(val) => setShow100g(val === "100g")}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="30g">30g</TabsTrigger>
            <TabsTrigger value="100g">100g</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loadingTableListaDePrecios ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={getListaPreciosColumns(view)}
          data={perfumes}
          isLoading={false}
          onDataUpdate={fetchListaDePrecios}
          view={view}
        />
      )}
    </div>
  );
}
