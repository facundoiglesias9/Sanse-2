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
  const [userRole, setUserRole] = useState<string>("revendedor");

  const searchParams = useSearchParams();
  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();

  // Obtener rol del usuario
  useEffect(() => {
    const getUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        const role = profile?.rol || session.user.user_metadata?.rol || "revendedor";
        setUserRole(role);
      }
    };
    getUserRole();
  }, []);

  // Determinar vista: revendedores siempre ven mayorista
  const requestedView = searchParams.get("view") as "minorista" | "mayorista";
  const view = userRole === "revendedor" ? "mayorista" : (requestedView || "minorista");

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

        // Prioridad: Insumos Personalizados (SOBREESCRIBIR TODO)
        if (esencia.custom_insumos && Array.isArray(esencia.custom_insumos) && esencia.custom_insumos.length > 0) {
          costoFrasco = 0; // La lista personalizada asume toda la responsabilidad
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
          // Lógica de respaldo eliminada como parte del desacoplamiento de Categoría.
          // Si no se definen insumos personalizados, el producto no tiene costos extra.
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
          // Paso de campos personalizados
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

  // Filtrar solo para Van Rossum si el usuario es revendedor
  const filteredPerfumes = userRole === "revendedor"
    ? perfumes.filter(p => p.proveedores?.nombre?.toLowerCase() === "van rossum")
    : perfumes;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        Lista de precios {view === "mayorista" ? "mayorista" : "minorista"}
      </h1>
      {loadingTableListaDePrecios ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={getListaPreciosColumns(view, userRole)}
          data={filteredPerfumes}
          isLoading={false}
          onDataUpdate={fetchListaDePrecios}
          view={view}
          userRole={userRole}
        />
      )}
    </div>
  );
}
