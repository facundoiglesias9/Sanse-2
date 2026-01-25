"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/app/(app)/components/lista_de_precios/data-table";
import { getListaPreciosColumns } from "@/app/(app)/components/lista_de_precios/columns";
import { Perfume } from "@/app/types/perfume";
import { createClient } from "@/utils/supabase/client";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { LoaderTable } from "@/app/(app)/components/loader-table";
import { FormulaInfoDialog } from "@/app/(app)/components/lista_de_precios/formula-info-dialog";


export default function ListaDePreciosPage() {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [loadingTableListaDePrecios, setLoadingTableListaDePrecios] =
    useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();



  // Obtener rol del usuario y config de mantenimiento
  useEffect(() => {
    const initPage = async () => {
      // 1. Get User Role


      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        const role = profile?.rol || session.user.user_metadata?.rol || "comprador";
        setUserRole(role);
      } else {
        // Guest user
        setUserRole("comprador"); // O "guest" si manejas
      }
    };
    initPage();
  }, []);

  // Determinar vista: revendedores ven mayorista, compradores ven minorista
  const requestedView = searchParams.get("view") as "minorista" | "mayorista";

  let view: "minorista" | "mayorista" = requestedView || "minorista";
  if (userRole === "revendedor") view = "mayorista";
  if (userRole === "comprador") view = "minorista"; // El comprador siempre ve minorista

  // EARLY RETURN logic moved to bottom to prevent Hook Error



  const fetchListaDePrecios = async () => {
    if (userRole === null) return; // Esperar a que se determine el rol
    setLoadingTableListaDePrecios(true);

    const { data: esencias } = await supabase
      .from("esencias")
      .select(
        `
          *,
          insumos_categorias:insumos_categorias_id(id, nombre),
          proveedores(id, nombre, gramos_configurados, color, margen_venta),
          stock_al_momento
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

        let baseGramos = 0; // El tamaño correspondiente a precioFinalArs

        // Prioridad al precio de 100g, si existe
        const precio100g = precio100gByEsencia.get(esencia.id);
        if (typeof precio100g === "number" && !Number.isNaN(precio100g)) {
          precioFinalArs = precio100g;
          baseGramos = 100;
        } else if (esencia.precio_usd && currencies["ARS"]) {
          precioFinalArs = esencia.precio_usd * currencies["ARS"];
          baseGramos = esencia.cantidad_gramos || 0;
        } else if (esencia.precio_ars) {
          precioFinalArs = esencia.precio_ars;
          baseGramos = esencia.cantidad_gramos || 0;
        }

        const precioPorGramo = baseGramos > 0 ? precioFinalArs / baseGramos : 0;
        const gramosReceta = esencia.proveedores?.gramos_configurados ?? 0;

        const costoMateriaPrima = precioPorGramo * gramosReceta;

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
                ? (Number(insumoReal.precio_lote) / Number(insumoReal.cantidad_lote))
                : 0;

              const qty = Number(customIns.cantidad_necesaria || customIns.cantidad || 0);
              const totalInsumo = Number(costoU) * qty;

              return Number(acc) + totalInsumo;
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
          Number(costoMateriaPrima) + Number(costoFrasco) + Number(costoOtrosInsumos);

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
          familia_olfativa: esencia.familia_olfativa,
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
          stock_al_momento: esencia.stock_al_momento,
        };
      });

    // Ordenar por Categoría (Fina primero) -> Nombre
    perfumesCalculados.sort((a, b) => {
      const catA = (a.insumos_categorias?.nombre || "").toLowerCase();
      const catB = (b.insumos_categorias?.nombre || "").toLowerCase();

      const isFinaA = catA.includes("perfumería fina");
      const isFinaB = catB.includes("perfumería fina");

      // 1. Prioridad: Perfumería Fina primero
      if (isFinaA && !isFinaB) return -1;
      if (!isFinaA && isFinaB) return 1;

      // 2. Alfabetico por Categoría
      if (catA < catB) return -1;
      if (catA > catB) return 1;

      // 3. Alfabetico por Nombre
      return a.nombre.localeCompare(b.nombre);
    });

    setPerfumes(perfumesCalculados);
    setLoadingTableListaDePrecios(false);
  };

  useEffect(() => {
    if (!loadingCurrencies && userRole) {
      fetchListaDePrecios();
    }
  }, [currencies, loadingCurrencies, userRole]);

  // Filtrar solo para Van Rossum si el usuario es revendedor o comprador
  // Filtrar para Revendedores y Compradores:
  // - Si la categoría es "Perfumería fina", solo mostrar productos de "Van Rossum".
  // - Para las demás categorías, mostrar todos los productos de todos los proveedores.
  const filteredPerfumes = (userRole === "revendedor" || userRole === "comprador")
    ? perfumes.filter(p => {
      const categoria = p.insumos_categorias?.nombre?.toLowerCase() || "";
      const proveedor = p.proveedores?.nombre?.toLowerCase() || "";

      // Si es perfumería fina, restringir a Van Rossum
      if (categoria.includes("perfumería fina") || categoria === "fina") {
        return proveedor === "van rossum";
      }

      // Si no es perfumería fina, mostrar todo
      return true;
    })
    : perfumes;



  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-6">
        <h1 className="text-3xl font-bold text-center">
          Lista de precios {view === "mayorista" ? "mayorista" : "minorista"}
        </h1>
        {userRole === "admin" && <FormulaInfoDialog />}
      </div>

      {loadingTableListaDePrecios || userRole === null ? (
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


