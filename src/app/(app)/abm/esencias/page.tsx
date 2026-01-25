"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/app/(app)/abm/esencias/components/data-table";
import { esenciasColumns as columnasMasculinas } from "@/app/(app)/abm/esencias/components/columns";
import { Esencia } from "@/app/types/esencia";
import { createClient } from "@/utils/supabase/client";
import { LoaderTable } from "@/app/(app)/components/loader-table";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EsenciasPage() {
  const [esencias, setEsencias] = useState<Esencia[]>([]);
  const [loadingEsencias, setLoadingEsencias] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [esenciaToEdit, setEsenciaToEdit] = useState<Esencia | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Pendientes (sin scrape en la última corrida)
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingVR, setPendingVR] = useState<Esencia[]>([]);

  // Alternar 30g / 100g
  const [show100g, setShow100g] = useState(false);

  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();

  // Auxiliar de recálculo (para enriquecimiento y alternancia dinámica)
  const calculateDerived = (base: Esencia, activeGrams: number, activePriceArs: number | null | undefined): Esencia => {
    const gramosPor = base.proveedores?.gramos_configurados ?? 1;

    // Si activePriceArs es null/undefined, precioFinal será 0 o basado en USD
    // Pero si estamos "simulando" 100g y no hay precio, debería ser 0 o null?
    // Mantengamos lógica original fallbacks

    let precioFinal = 0;
    if (base.precio_usd && currencies["ARS"]) {
      // Si tiene precio USD, ¿ignoramos el toggle de ARS?
      // Usualmente si hay precio USD, manda sobre ARS.
      // Pero para VanRossum (scraping), suele ser ARS.
      precioFinal = base.precio_usd * currencies["ARS"];
    } else if (activePriceArs) {
      precioFinal = activePriceArs;
    }

    const perfumesPorCantidad =
      activeGrams && gramosPor > 0
        ? activeGrams / gramosPor
        : 1;

    const precio_por_perfume =
      perfumesPorCantidad > 0 ? precioFinal / perfumesPorCantidad : 0;

    return {
      ...base,
      precio_ars: activePriceArs ?? base.precio_ars, // Visual override
      cantidad_gramos: activeGrams,                  // Visual override
      precio_por_perfume,
    };
  };



  const fetchEsencias = async (showLoader = true) => {
    if (showLoader) setLoadingEsencias(true);

    // 1) Esencias (consulta actualizada para incluir nuevas columnas)
    const { data: esenciasDB, error: eEs } = await supabase
      .from("esencias")
      .select("*, proveedores(id, nombre, gramos_configurados, color)")
      .order("nombre", { ascending: true });

    if (eEs) {
      toast.error("Error al cargar esencias");
      if (showLoader) setLoadingEsencias(false);
      return;
    }

    // 2) Últimos precios scrapeados (solo metadatos/legado)
    const { data: ultimos, error: ePv } = await supabase
      .from("precios_vanrossum_latest")
      .select("esencia_id, precio_ars_100g, actualizado_en");

    if (ePv) {
      // Solo registrar, no bloquear
      console.error("Error loading VR latest", ePv);
    }

    const scrapedMap = new Map<
      string,
      { precio: number | null; actualizado_en: string | null; }
    >(
      (ultimos ?? []).map((u: any) => [
        u.esencia_id as string,
        {
          precio: (u.precio_ars_100g ?? null) as number | null,
          actualizado_en: (u.actualizado_en ?? null) as string | null,
        },
      ])
    );

    // 3) Enriquecer (Base) + banderas
    // Nota: Ya no calculamos por perfume aquí, lo hacemos en displayedEsencias
    const deco: Esencia[] = (esenciasDB || []).map((e) => {
      const s = scrapedMap.get(e.id);
      const lastUpdate = s?.actualizado_en ?? e.updated_at ?? null;
      let out = { ...e };

      // Campos de metadatos
      if (s) {
        (out as any)._scrape_fuente = "vanrossum";
        (out as any)._scrape_consultar = s.precio === null; // Lógica de vista heredada
        (out as any)._scrape_time = s.actualizado_en;
      }
      (out as any)._last_update = lastUpdate;
      return out;
    });

    // 4) Calcular pendientes VR
    const vrEsencias = deco.filter(
      (ee) => (ee.proveedores?.nombre || "").trim().toLowerCase() === "van rossum"
    );
    const scrapedIds = new Set(scrapedMap.keys());
    const pendientes = vrEsencias.filter((ee) => !scrapedIds.has(ee.id));

    setPendingVR(pendientes);
    setEsencias(deco);
    if (showLoader) setLoadingEsencias(false);
  };

  useEffect(() => {
    if (!loadingCurrencies) fetchEsencias();
  }, [loadingCurrencies]);

  // Estado derivado para visualización
  const displayedEsencias = esencias.map((e) => {
    // Determinar gramos/precio efectivos
    // Lógica predeterminada: usar guardado.
    // Lógica dinámica: intentar usar columna correspondiente.

    let activePrice: number | null | undefined = e.precio_ars;
    let activeGrams = e.cantidad_gramos ?? 1;

    // Solo aplicar lógica de alternancia para ítems de Van Rossum (o aquellos con las columnas)
    if (show100g) {
      if (e.precio_ars_100g) {
        activePrice = e.precio_ars_100g;
        activeGrams = 100;
      } else if ((e.proveedores?.nombre || "").toLowerCase().includes("van rossum")) {
        // ¿Si es ítem genérico de VR pero NO se encuentra precio de 100g, qué hacer?
        // ¿Quizás volver a la lógica de 30g o dejar como está?
        // ¿Si queremos vista estricta de 100g, y falta, quizás mostrar vacío/nulo?
        // Mantengamos: "Si está disponible, cambiar". Si no, mantener predeterminado.
      }
    } else {
      // Vista de 30g (predeterminado)
      // ¿Siempre intentar usar columna de 30g si está disponible? 
      // ¿O simplemente usar `precio_ars` que usualmente es 30g?
      // Si queremos mostrar estrictamente precio de 30g si está disponible:
      if (e.precio_ars_30g) {
        activePrice = e.precio_ars_30g;
        activeGrams = 30;
      } else if (!show100g && e.cantidad_gramos === 100 && e.precio_ars_30g) {
        // caso especial: si el predeterminado era 100g pero queremos vista de 30g
        activePrice = e.precio_ars_30g;
        activeGrams = 30;
      }
    }

    return calculateDerived(e, activeGrams, activePrice);
  });

  const confirmDelete = useCallback((id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    const { error } = await supabase.from("esencias").delete().match({ id: deleteId });
    setIsDeleting(false);

    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }

    setEsencias((prev) => prev.filter((e) => e.id !== deleteId));
    setDialogOpen(false);
    setDeleteId(null);
    toast.success("¡Esencia eliminada correctamente!");
  };

  const handleEdit = useCallback((esencia: Esencia) => {
    // setEsenciaToEdit(null); // No forzar null antes para evitar parpadeos o cierres
    setEsenciaToEdit(esencia);
  }, []);

  const resetEdit = () => setEsenciaToEdit(null);

  const columns = useMemo(() => columnasMasculinas(confirmDelete, handleEdit), [confirmDelete, handleEdit]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      <div className="relative flex items-center justify-center mb-8">
        <h1 className="text-3xl font-bold text-center">Gestión de esencias</h1>

        {/* Botón de pendientes: esquinado a la derecha */}
        {!loadingEsencias && pendingVR.length > 0 && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <Button
              variant="outline"
              onClick={() => setPendingOpen(true)}
              title="Ver esencias sin datos de scraping en la última corrida"
            >
              Pendientes de scraping: {pendingVR.length}
            </Button>
          </div>
        )}
      </div>

      {loadingEsencias ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={columns}
          data={displayedEsencias}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          isLoading={false}
          onEsenciaCreated={() => {
            fetchEsencias(false);
            resetEdit();
          }}
          esenciaToEdit={esenciaToEdit}
          onEditReset={resetEdit}
          dolarARS={currencies["ARS"]}
          generoPorDefault="masculino"
          headerChildren={
            <Tabs
              value={show100g ? "100g" : "30g"}
              onValueChange={(val) => setShow100g(val === "100g")}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="30g">30g (Default)</TabsTrigger>
                <TabsTrigger value="100g">100g</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
      )}

      {/* Confirmación de eliminación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} aria-describedby={undefined}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
          </DialogHeader>
          <p>Esta acción no se puede deshacer. Se eliminará la esencia permanentemente.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              <span className="inline-flex items-center gap-2">
                {isDeleting && <Loader2 className="animate-spin h-4 w-4" />}
                Eliminar
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Listado de pendientes VR */}
      <Dialog open={pendingOpen} onOpenChange={setPendingOpen} aria-describedby={undefined}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Esencias sin scraping (última corrida)</DialogTitle>
          </DialogHeader>
          {pendingVR.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pendientes.</p>
          ) : (
            <div className="max-h-80 overflow-auto text-sm">
              <ul className="list-disc pl-5 space-y-1">
                {pendingVR.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">{e.nombre}</span>{" "}
                    <span className="text-muted-foreground">— {e.genero ?? "Otro"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            Sugerencia: revisá la <Link href="/accept-orphans">página de huérfanos</Link> de Van Rossum para matchear y crear alias si corresponde.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}