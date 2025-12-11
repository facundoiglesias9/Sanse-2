"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/app/(app)/components/lista_de_precios/data-table";
import { getListaPreciosColumns } from "@/app/(app)/components/lista_de_precios/columns";
import { Perfume } from "@/app/types/perfume";
import { createClient } from "@/utils/supabase/client";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { LoaderTable } from "@/app/(app)/components/loader-table";

export default function ListaDePreciosPage() {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [loadingTableListaDePrecios, setLoadingTableListaDePrecios] =
    useState(false);

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

    // Traemos el último precio 100g por esencia desde la vista
    const { data: ultimos } = await supabase
      .from("precios_vanrossum_latest")
      .select("esencia_id, precio_ars_100g");

    // Mapeo rápido por esencia_id (uuid -> número)
    const precio100gByEsencia = new Map<string, number>(
      (ultimos ?? [])
        .filter((u) => typeof u.precio_ars_100g === "number")
        .map((u) => [u.esencia_id as string, u.precio_ars_100g as number]),
    );

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

        // Prioridad al precio de 100g, si existe
        const precio100g = precio100gByEsencia.get(esencia.id);
        if (typeof precio100g === "number" && !Number.isNaN(precio100g)) {
          precioFinalArs = precio100g;
        } else if (esencia.precio_usd && currencies["ARS"]) {
          precioFinalArs = esencia.precio_usd * currencies["ARS"];
        } else if (esencia.precio_ars) {
          precioFinalArs = esencia.precio_ars;
        }

        const gramosPor = esencia.proveedores?.gramos_configurados ?? 1;
        const perfumesPorCantidad =
          esencia.cantidad_gramos && gramosPor > 0
            ? esencia.cantidad_gramos / gramosPor
            : 1;

        const costoMateriaPrima =
          perfumesPorCantidad > 0 ? precioFinalArs / perfumesPorCantidad : 0;

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
          precio_ars: esencia.precio_ars,
          precio_usd: esencia.precio_usd,
          cantidad_gramos: esencia.cantidad_gramos,
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
  }, [currencies, loadingCurrencies]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        Lista de precios {view === "mayorista" ? "mayorista" : "minorista"}
      </h1>
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
