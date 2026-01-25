"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Inventario } from "@/app/types/inventario";
import { createClient } from "@/utils/supabase/client";
import { DataTable } from "@/app/(app)/abm/inventario/components/data-table";
import { inventarioColumns } from "@/app/(app)/abm/inventario/components/columns";
import { toast } from "sonner";
import { LoaderTable } from "@/app/(app)/components/loader-table";
import { Button } from "@/components/ui/button";
import { Loader2, Package, AlertTriangle } from "lucide-react";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  InventarioTipoRecord,
  TipoManagerDialog,
} from "@/app/(app)/abm/inventario/components/tipo-manager-dialog";
import { getLowStockMeta } from "@/app/helpers/stock-logic";

const FALLBACK_TIPOS = ["Perfume", "Frasco", "Etiqueta", "Esencia", "Insumo"];

export default function InventarioPage() {
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingTableInventario, setLoadingTableInventario] = useState(false);
  const [inventarioToEdit, setInventarioToEdit] = useState<Inventario | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [tipos, setTipos] = useState<InventarioTipoRecord[]>([]);
  const [isTipoManagerOpen, setIsTipoManagerOpen] = useState(false);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [tiposError, setTiposError] = useState<string | null>(null);
  const [canManageTipos, setCanManageTipos] = useState(true);

  const supabase = createClient();

  const tipoOptions = useMemo(() => {
    const configured = tipos.map((t) => t.nombre).filter(Boolean);
    const fromInventario = Array.from(
      new Set(
        (inventario || [])
          .map((item) => (item.tipo || "").trim())
          .filter((t) => t !== ""),
      ),
    );

    const base = configured.length > 0 ? configured : FALLBACK_TIPOS;
    const merged = Array.from(new Set([...base, ...fromInventario]));

    return merged.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [tipos, inventario]);

  async function fetchInventario() {
    setLoadingTableInventario(true);
    const { data, error } = await supabase
      .from("inventario")
      .select("*")
      .order("tipo", { ascending: true });

    if (error) {
      toast.error("Error al cargar inventario");
      setLoadingTableInventario(false);
      return;
    }

    setInventario((data ?? []) as Inventario[]);
    setLoadingTableInventario(false);
  }

  async function fetchTipos() {
    setLoadingTipos(true);
    const { data, error } = await supabase
      .from("inventario_tipos")
      .select("id, nombre")
      .order("nombre", { ascending: true });
    setLoadingTipos(false);

    if (error) {
      console.error("Error al cargar tipos de inventario:", error.message);
      if (!tiposError) {
        toast.error(
          "No se pudo cargar la configuración de tipos. Se usarán los valores existentes.",
        );
      }
      setTiposError(error.message);
      setCanManageTipos(false);
      setTipos([]);
      return;
    }

    if (tiposError) {
      toast.success("Tipos de inventario sincronizados correctamente.");
    }

    setTiposError(null);
    setCanManageTipos(true);
    setTipos(
      (data ?? []).map((item) => ({
        id: item.id,
        nombre: item.nombre,
      })),
    );
  }

  useEffect(() => {
    fetchInventario();
    fetchTipos();
  }, []);

  const confirmDelete = useCallback((id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const { error } = await supabase.from("inventario").delete().match({ id: deleteId });
    setIsDeleting(false);

    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }

    setInventario((prev) => prev.filter((i) => i.id !== deleteId));
    setDialogOpen(false);
    setDeleteId(null);
    toast.success("¡Item eliminado correctamente!");
  };

  const handleEdit = useCallback((inv: Inventario) => {
    setInventarioToEdit(null);
    setTimeout(() => setInventarioToEdit(inv), 0);
  }, []);

  const resetEdit = () => setInventarioToEdit(null);

  const handleOpenTipoManager = () => {
    if (!canManageTipos) {
      toast.error(
        "No encontramos la tabla de tipos configurables.",
      );
      return;
    }
    setIsTipoManagerOpen(true);
  };

  const handleTipoCreate = async (nombre: string): Promise<boolean> => {
    if (!canManageTipos) {
      toast.error("La gestión de tipos no está disponible actualmente.");
      return false;
    }

    const trimmed = nombre.trim();
    if (!trimmed) {
      toast.error("El nombre del tipo no puede estar vacío.");
      return false;
    }

    const exists = tipos.some(
      (tipo) => tipo.nombre.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast.error("Ya existe un tipo con ese nombre.");
      return false;
    }

    const { error } = await supabase
      .from("inventario_tipos")
      .insert([{ nombre: trimmed }]);

    if (error) {
      toast.error("No se pudo crear el tipo.");
      return false;
    }

    toast.success("Tipo creado correctamente.");
    await fetchTipos();
    return true;
  };

  const handleTipoRename = async (
    id: string,
    nuevoNombre: string,
  ): Promise<boolean> => {
    if (!canManageTipos) {
      toast.error("La gestión de tipos no está disponible actualmente.");
      return false;
    }

    const target = tipos.find((tipo) => tipo.id === id);
    if (!target) {
      toast.error("No se encontró el tipo seleccionado.");
      return false;
    }

    const trimmed = nuevoNombre.trim();
    if (!trimmed) {
      toast.error("El nombre del tipo no puede estar vacío.");
      return false;
    }

    if (target.nombre.toLowerCase() === trimmed.toLowerCase()) {
      toast.info("No hubo cambios en el nombre del tipo.");
      return false;
    }

    const exists = tipos.some(
      (tipo) => tipo.id !== id && tipo.nombre.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      toast.error("Ya existe otro tipo con ese nombre.");
      return false;
    }

    const { error } = await supabase
      .from("inventario_tipos")
      .update({ nombre: trimmed })
      .eq("id", id);

    if (error) {
      toast.error("No se pudo actualizar el tipo.");
      return false;
    }

    const { error: inventarioError } = await supabase
      .from("inventario")
      .update({ tipo: trimmed })
      .eq("tipo", target.nombre);

    if (inventarioError) {
      toast.error(
        "El tipo se renombró, pero no se pudo actualizar el inventario. Revisá los datos manualmente.",
      );
    } else {
      toast.success("Tipo actualizado correctamente.");
    }

    await Promise.all([fetchTipos(), fetchInventario()]);
    return inventarioError ? false : true;
  };

  const handleTipoDelete = async (id: string): Promise<boolean> => {
    if (!canManageTipos) {
      toast.error("La gestión de tipos no está disponible actualmente.");
      return false;
    }

    const target = tipos.find((tipo) => tipo.id === id);
    if (!target) {
      toast.error("No se encontró el tipo seleccionado.");
      return false;
    }

    const { error: countError, count } = await supabase
      .from("inventario")
      .select("id", { count: "exact", head: true })
      .eq("tipo", target.nombre);

    if (countError) {
      toast.error("No se pudo verificar el inventario antes de eliminar el tipo.");
      return false;
    }

    if ((count ?? 0) > 0) {
      toast.error(
        `Hay ${count} ítems con el tipo "${target.nombre}". Actualizá esos registros antes de eliminarlo.`,
      );
      return false;
    }

    const { error } = await supabase
      .from("inventario_tipos")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("No se pudo eliminar el tipo.");
      return false;
    }

    toast.success("Tipo eliminado correctamente.");
    await fetchTipos();
    return true;
  };

  const memoizedColumns = useMemo(
    () => inventarioColumns(confirmDelete, handleEdit),
    [confirmDelete, handleEdit]
  );

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Gestión de inventario</h1>
        <h4 className="text-sm text-muted-foreground">
          Cuidado cuando creas o editas el tipo del{" "}
          <span className="underline font-semibold">item</span> porque distingue
          entre <span className="underline font-semibold">mayúsculas</span> y{" "}
          <span className="underline font-semibold">minúsculas</span>.
        </h4>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Productos Registrados</span>
            <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tighter">
              {inventario.length.toLocaleString('es-AR')}
            </span>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-full group-hover:scale-110 transition-transform">
            <Package className="w-8 h-8 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group flex items-center justify-between relative overflow-hidden">
          {/* Gradient glow bg */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

          <div className="flex flex-col gap-1 z-10">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Stock Crítico</span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-red-600 dark:text-red-400 font-mono tracking-tighter">
                {inventario.filter(i => {
                  const meta = getLowStockMeta({
                    tipo: i.tipo || "",
                    nombre: i.nombre || "",
                    cantidad: Number(i.cantidad) || 0
                  });
                  return meta.low;
                }).length}
              </span>
              <span className="text-[10px] font-extrabold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full animate-pulse">
                REQUIERE ATENCIÓN
              </span>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full group-hover:scale-110 transition-transform z-10">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {loadingTableInventario ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={memoizedColumns}
          data={inventario}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          isLoading={false}
          onInventarioCreated={fetchInventario}
          inventarioToEdit={inventarioToEdit}
          onEditReset={resetEdit}
          generoPorDefault={null}
          tipoOptions={tipoOptions}
          onManageTipos={handleOpenTipoManager}
        />
      )}

      <TipoManagerDialog
        open={isTipoManagerOpen}
        onOpenChange={setIsTipoManagerOpen}
        tipos={tipos}
        isLoading={loadingTipos}
        onCreate={handleTipoCreate}
        onRename={handleTipoRename}
        onDelete={handleTipoDelete}
        fallbackTipos={FALLBACK_TIPOS}
        canManage={canManageTipos}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} aria-describedby={undefined}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
          </DialogHeader>
          <p>Esta acción no se puede deshacer. Se eliminará el item permanentemente.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
