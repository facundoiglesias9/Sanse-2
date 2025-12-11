"use client";

import { useState, useEffect } from "react";
import { Proveedor } from "@/app/types/proveedor";
import { createClient } from "@/utils/supabase/client";
import { DataTable } from "@/app/(app)/abm/proveedores/components/data-table";
import { proveedoresColumns } from "@/app/(app)/abm/proveedores/components/columns";
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

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingTableInsumos, setLoadingTableInsumos] = useState(false);
  const [insumoToEdit, setInsumoToEdit] = useState<Proveedor | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const supabase = createClient();

  async function fetchProveedores() {
    setLoadingTableInsumos(true);
    const { data } = await supabase
      .from("proveedores")
      .select("*")
      .order("updated_at", { ascending: false });

    setProveedores(data || []);
    setLoadingTableInsumos(false);
  }

  useEffect(() => {
    fetchProveedores();
  }, []);

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("proveedores")
      .delete()
      .match({ id: deleteId });

    setIsDeleting(false);

    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }

    setProveedores((prev) =>
      prev.filter((proveedor) => proveedor.id !== deleteId),
    );
    setDialogOpen(false);
    setDeleteId(null);
    toast.success("¡Proveedor eliminado correctamente!");
  };

  const handleEdit = (proveedor: Proveedor) => {
    setInsumoToEdit(null);
    setTimeout(() => setInsumoToEdit(proveedor), 0);
  };

  const resetEdit = () => {
    setInsumoToEdit(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-center mb-2">
          Gestión de proveedores
        </h1>
        <h4 className="text-sm text-muted-foreground">
          Cuidado cuando creas o editas el nombre del{" "}
          <span className="underline font-semibold">proveedor</span> porque
          distingue entre{" "}
          <span className="underline font-semibold">mayúsculas</span> y{" "}
          <span className="underline font-semibold">minúsculas</span>.
        </h4>
      </div>

      {loadingTableInsumos ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={proveedoresColumns(confirmDelete, handleEdit)}
          data={proveedores}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          isLoading={false}
          onProveedorCreated={fetchProveedores}
          proveedorToEdit={insumoToEdit}
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
            Esta acción no se puede deshacer. Se eliminará el proveedor
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
