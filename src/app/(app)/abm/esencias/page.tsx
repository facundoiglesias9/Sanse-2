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

  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();

  const enrichEsencias = (data: Esencia[]): Esencia[] => {
    return data.map((esencia) => {
      const gramosPor = esencia.proveedores?.gramos_configurados ?? 1;
      const perfumesPorCantidad =
        esencia.cantidad_gramos && gramosPor > 0
          ? esencia.cantidad_gramos / gramosPor
          : 1;

      let precioFinal = 0;
      if (esencia.precio_usd && currencies["ARS"]) {
        precioFinal = esencia.precio_usd * currencies["ARS"];
      } else if (esencia.precio_ars) {
        precioFinal = esencia.precio_ars;
      }

      const precio_por_perfume =
        perfumesPorCantidad > 0 ? precioFinal / perfumesPorCantidad : 0;

      return { ...esencia, precio_por_perfume };
    });
  };

  const fetchEsencias = async () => {
    setLoadingEsencias(true);

    // 1) Esencias
    const { data: esenciasDB, error: eEs } = await supabase
      .from("esencias")
      .select("*, proveedores(id, nombre, gramos_configurados, color)")
      .order("nombre", { ascending: true });

    if (eEs) {
      toast.error("Error al cargar esencias");
      setLoadingEsencias(false);
      return;
    }

    // 2) Últimos precios scrapeados
    const { data: ultimos, error: ePv } = await supabase
      .from("precios_vanrossum_latest")
      .select("esencia_id, precio_ars_100g, actualizado_en");

    if (ePv) {
      toast.error("Error al cargar precios de Van Rossum");
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

    // 3) Enriquecer + flags de scraping + _last_update
    const enriquecidas = esenciasDB ? enrichEsencias(esenciasDB) : [];
    const decoradas = enriquecidas.map((e) => {
      const s = scrapedMap.get(e.id);
      const lastUpdate = s?.actualizado_en ?? e.updated_at ?? null;
      if (s) {
        return {
          ...e,
          _scrape_fuente: "vanrossum",
          _scrape_consultar: s.precio === null,
          _scrape_time: s.actualizado_en, // para el puntito
          _last_update: lastUpdate,       // para la columna
        } as any;
      }
      return {
        ...e,
        _last_update: lastUpdate,
      } as any;
    });

    // 4) Calcular pendientes VR
    const vrEsencias = decoradas.filter(
      (ee) => (ee.proveedores?.nombre || "").trim().toLowerCase() === "van rossum"
    );
    const scrapedIds = new Set(scrapedMap.keys());
    const pendientes = vrEsencias.filter((ee) => !scrapedIds.has(ee.id));
    setPendingVR(pendientes);

    setEsencias(decoradas as Esencia[]);
    setLoadingEsencias(false);
  };

  useEffect(() => {
    if (!loadingCurrencies) fetchEsencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCurrencies]);

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
        <h1 className="text-3xl font-bold">Gestión de esencias</h1>

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
          data={esencias}
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
