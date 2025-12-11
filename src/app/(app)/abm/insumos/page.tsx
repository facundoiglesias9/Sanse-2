"use client";

import { useState, useEffect } from "react";
import { Insumo } from "@/app/types/insumo";
import { createClient } from "@/utils/supabase/client";
import { DataTable } from "@/app/(app)/abm/insumos/components/data-table";
import { insumosColumns } from "@/app/(app)/abm/insumos/components/columns";
import { toast } from "sonner";
import { LoaderTable } from "@/app/(app)/components/loader-table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingTableInsumos, setLoadingTableInsumos] = useState(false);
  const [insumoToEdit, setInsumoToEdit] = useState<Insumo | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const supabase = createClient();

  async function fetchInsumos() {
    setLoadingTableInsumos(true);
    const { data } = await supabase
      .from("insumos")
      .select(`*`)
      .order("nombre", { ascending: true });

    const enriched = (data || []).map((insumo) => ({
      ...insumo,
      costo_unitario:
        insumo.cantidad_lote > 0
          ? (insumo.precio_lote / insumo.cantidad_lote) *
          insumo.cantidad_necesaria
          : 0,
    }));

    setInsumos(enriched);
    setLoadingTableInsumos(false);
  }

  useEffect(() => {
    fetchInsumos();
  }, []);

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("insumos")
      .delete()
      .match({ id: deleteId });

    setIsDeleting(false);

    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }

    setInsumos((prev) => prev.filter((insumo) => insumo.id !== deleteId));
    setDialogOpen(false);
    setDeleteId(null);
    toast.success("¡Insumo eliminado correctamente!");
  };

  const handleEdit = (insumo: Insumo) => {
    setInsumoToEdit(null);
    setTimeout(() => setInsumoToEdit(insumo), 0);
  };

  const resetEdit = () => {
    setInsumoToEdit(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        Gestión de insumos
      </h1>

      {loadingTableInsumos ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={insumosColumns(confirmDelete, handleEdit)}
          data={insumos}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          isLoading={false}
          onInsumoCreated={fetchInsumos}
          insumoToEdit={insumoToEdit}
          onEditReset={resetEdit}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        aria-describedby={undefined}
      >
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
          </DialogHeader>
          <p>
            Esta acción no se puede deshacer. Se eliminará el insumo
            permanentemente.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Eliminar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
