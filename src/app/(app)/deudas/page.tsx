"use client";

import { useState, useEffect } from "react";
import { Deudas } from "@/app/types/deudas";
import { createClient } from "@/utils/supabase/client";
import { DataTable } from "@/app/(app)/deudas/components/data-table";
import { deudasColumns } from "@/app/(app)/deudas/components/columns";
import { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { LoaderTable } from "@/app/(app)/components/loader-table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DeudasPage() {
  const [deudas, setDeudas] = useState<Deudas[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingTableDeudas, setLoadingTableDeudas] = useState(false);
  const [deudaToEdit, setDeudaToEdit] = useState<Deudas | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [acreedores, setAcreedores] = useState<
    { value: string; label: string }[]
  >([]);

  // Estados para manejar el diálogo de saldar deuda
  const [dialogSaldarOpen, setDialogSaldarOpen] = useState(false);
  const [deudaASaldar, setDeudaASaldar] = useState<Deudas | null>(null);
  const [isSaldando, setIsSaldando] = useState(false);

  const supabase = createClient();

  async function fetchDeudas() {
    setLoadingTableDeudas(true);
    const { data } = await supabase
      .from("deudas")
      .select("*")
      .order("created_at", { ascending: false });

    setDeudas(data || []);
    setLoadingTableDeudas(false);
  }

  useEffect(() => {
    fetchDeudas();
  }, []);

  async function fetchAcreedores() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre");
    if (error) {
      toast.error("Error al cargar acreedores");
      return;
    }
    setAcreedores(
      data.map((perfil) => ({
        value: perfil.id,
        label: perfil.nombre,
      })),
    );
  }

  useEffect(() => {
    fetchAcreedores();
  }, []);

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("deudas")
      .delete()
      .match({ id: deleteId });

    setIsDeleting(false);

    if (error) {
      console.error("Error al eliminar:", error.message);
      return;
    }

    setDeudas((prev) => prev.filter((deuda) => deuda.id !== deleteId));
    setDialogOpen(false);
    setDeleteId(null);
    toast.success("¡Deuda eliminada correctamente!");
  };

  const handleEdit = (deuda: Deudas) => {
    setDeudaToEdit(null);
    setTimeout(() => setDeudaToEdit(deuda), 0);
  };

  const resetEdit = () => {
    setDeudaToEdit(null);
  };

  const handleSaldarDeuda = async () => {
    if (!deudaASaldar) return;
    setIsSaldando(true);

    // 1. Registrar el gasto
    const { error: errorGasto } = await supabase.from("gastos").insert({
      created_at: new Date(),
      detalle: `Pago deuda: ${deudaASaldar.detalle}`,
      monto: deudaASaldar.monto,
    });

    if (errorGasto) {
      toast.error("Error al registrar el gasto");
      setIsSaldando(false);
      return;
    }

    // 2. Eliminar la deuda
    const { error: errorDeuda } = await supabase
      .from("deudas")
      .delete()
      .match({ id: deudaASaldar.id });

    setIsSaldando(false);

    if (errorDeuda) {
      toast.error("Error al eliminar la deuda");
      return;
    }

    setDeudas((prev) => prev.filter((d) => d.id !== deudaASaldar.id));
    setDialogSaldarOpen(false);
    setDeudaASaldar(null);
    toast.success("¡Deuda saldada correctamente!");
  };

  const confirmSaldar = (deuda: Deudas) => {
    setDeudaASaldar(deuda);
    setDialogSaldarOpen(true);
  };

  const totalDeudas = deudas.reduce((acc, deuda) => acc + deuda.monto, 0);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Deudas</h1>

      {loadingTableDeudas ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={deudasColumns(
            confirmDelete,
            handleEdit,
            confirmSaldar,
            acreedores,
          )}
          data={deudas}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          isLoading={false}
          onDeudaCreated={fetchDeudas}
          deudaToEdit={deudaToEdit}
          onEditReset={resetEdit}
          totalDeudas={totalDeudas}
          acreedores={acreedores}
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
            Esta acción no se puede deshacer. Se eliminará la venta
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

      {/* Confirmación para saldar una deuda */}
      <Dialog
        open={dialogSaldarOpen}
        onOpenChange={setDialogSaldarOpen}
        aria-describedby={undefined}
      >
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Saldar deuda?</DialogTitle>
          </DialogHeader>
          <p>
            Esta acción no se puede deshacer. Se agregará un gasto y eliminará
            la deuda permanentemente.
            <br />
            <br />
            <span className="font-semibold">
              {deudaASaldar?.detalle}
            </span> por{" "}
            <span className="font-semibold">
              {deudaASaldar && formatCurrency(deudaASaldar.monto, "ARS", 0)}
            </span>
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDialogSaldarOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaldarDeuda} disabled={isSaldando}>
              {isSaldando ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Saldar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
