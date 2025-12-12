"use client";

import { useEffect, useState } from "react";
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

  // Toggle 30g / 100g
  const [show100g, setShow100g] = useState(false);

  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();

  // Recalculate helper (for enrichment and dynamic toggle)
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

  const enrichEsencias = (data: Esencia[]): Esencia[] => {
    // This initial enrichment is for the "base" state (usually defaults)
    // But we will use calculateDerived in the render loop dynamic too.
    // Let's just return data, and do calc later? 
    // Actually, `fetchEsencias` sets `esencias`.
    // We should store raw data or base data, and derive in render?
    // Current code sets `esencias` with enriched data.
    // Let's keep `esencias` as the "Base Store" (with scraped defaults)
    // and derive a `displayedEsencias` for the table.
    return data;
  };

  const fetchEsencias = async () => {
    setLoadingEsencias(true);

    // 1) Esencias (updated query to include new cols)
    const { data: esenciasDB, error: eEs } = await supabase
      .from("esencias")
      .select("*, proveedores(id, nombre, gramos_configurados, color)")
      .order("nombre", { ascending: true });

    if (eEs) {
      toast.error("Error al cargar esencias");
      setLoadingEsencias(false);
      return;
    }

    // 2) Últimos precios scrapeados (metadata only/legacy)
    const { data: ultimos, error: ePv } = await supabase
      .from("precios_vanrossum_latest")
      .select("esencia_id, precio_ars_100g, actualizado_en");

    if (ePv) {
      // Just log, don't block
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

    // 3) Enriquecer (Base) + flags
    // Note: We don't calc per-perfume here anymore, we do it in displayedEsencias
    const deco: Esencia[] = (esenciasDB || []).map((e) => {
      const s = scrapedMap.get(e.id);
      const lastUpdate = s?.actualizado_en ?? e.updated_at ?? null;
      let out = { ...e };

      // Metadata fields
      if (s) {
        (out as any)._scrape_fuente = "vanrossum";
        (out as any)._scrape_consultar = s.precio === null; // Legacy view logic
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
    setLoadingEsencias(false);
  };

  useEffect(() => {
    if (!loadingCurrencies) fetchEsencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCurrencies]);

  // Derived state for display
  const displayedEsencias = esencias.map((e) => {
    // Determine effective grams/price
    // Default logic: use stored.
    // Dynamic logic: try to use corresponding column.

    let activePrice: number | null | undefined = e.precio_ars;
    let activeGrams = e.cantidad_gramos ?? 1;

    // Only apply toggle logic for Van Rossum items (or those with the cols)
    if (show100g) {
      if (e.precio_ars_100g) {
        activePrice = e.precio_ars_100g;
        activeGrams = 100;
      } else if ((e.proveedores?.nombre || "").toLowerCase().includes("van rossum")) {
        // If generic VR item but NO 100g price found, what?
        // Maybe fallback to 30g logic or stay as is?
        // If we strictly want 100g view, and it's missing, maybe showing empty/null?
        // Let's stick to: "If available, switch". Else keep default.
      }
    } else {
      // 30g view (default)
      // Always try to use 30g col if available? 
      // Or just use `precio_ars` which is usually 30g?
      // If we want to strictly show 30g price if available:
      if (e.precio_ars_30g) {
        activePrice = e.precio_ars_30g;
        activeGrams = 30;
      } else if (!show100g && e.cantidad_gramos === 100 && e.precio_ars_30g) {
        // special case: if default was 100g but we want 30g view
        activePrice = e.precio_ars_30g;
        activeGrams = 30;
      }
    }

    return calculateDerived(e, activeGrams, activePrice);
  });

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  };

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

  const handleEdit = (esencia: Esencia) => {
    setEsenciaToEdit(null);
    setTimeout(() => setEsenciaToEdit(esencia), 0);
  };

  const resetEdit = () => setEsenciaToEdit(null);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Gestión de esencias</h1>
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
        </div>

        {/* Botón de pendientes: solo si hay > 0 y no está cargando */}
        {!loadingEsencias && pendingVR.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setPendingOpen(true)}
            title="Ver esencias sin datos de scraping en la última corrida"
          >
            Pendientes de scraping: {pendingVR.length}
          </Button>
        )}
      </div>

      {loadingEsencias ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={columnasMasculinas(confirmDelete, handleEdit)}
          data={displayedEsencias}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          isLoading={false}
          onEsenciaCreated={fetchEsencias}
          esenciaToEdit={esenciaToEdit}
          onEditReset={resetEdit}
          dolarARS={currencies["ARS"]}
          generoPorDefault="masculino"
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