"use client";

import { useState, useEffect } from "react";
import { Ventas } from "@/app/types/ventas";
import { Gastos } from "@/app/types/gastos";
import { formatDate } from "@/app/helpers/formatDate";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { createClient } from "@/utils/supabase/client";
import { DataTable } from "@/app/(app)/ventas/components/data-table";
import { ventasColumns } from "@/app/(app)/ventas/components/columns";
import { toast } from "sonner";
import { LoaderTable } from "@/app/(app)/components/loader-table";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function VentasPage() {
  const [ventas, setVentas] = useState<Ventas[]>([]);
  const [gastos, setGastos] = useState<Gastos[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState<string>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogGastosOpen, setDialogGastosOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingTableVentas, setLoadingTableVentas] = useState(false);
  const [loadingTableGastos, setLoadingTableGastos] = useState(false);
  const [ventasToView, setVentasToView] = useState<Ventas | null>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [deleteTipo, setDeleteTipo] = useState<"venta" | "gasto">("venta");

  const supabase = createClient();

  async function fetchVentas() {
    setLoadingTableVentas(true);
    const { data } = await supabase
      .from("ventas")
      .select("*")
      .order("created_at", { ascending: false });

    setVentas(data || []);
    setLoadingTableVentas(false);
  }

  async function fetchGastos() {
    setLoadingTableGastos(true);
    const { data } = await supabase
      .from("gastos")
      .select("*")
      .order("created_at", { ascending: false });

    setGastos(data || []);
    setLoadingTableGastos(false);
  }

  useEffect(() => {
    fetchVentas();
    fetchGastos();
  }, []);

  const confirmDelete = (id: string, tipo: "venta" | "gasto") => {
    setDeleteId(id);
    setDeleteTipo(tipo);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from(deleteTipo === "venta" ? "ventas" : "gastos")
      .delete()
      .match({ id: deleteId });

    setIsDeleting(false);

    if (error) {
      toast.error("Error al eliminar");
      return;
    }

    if (deleteTipo === "venta") {
      setVentas((prev) => prev.filter((v) => v.id !== deleteId));
    } else {
      setGastos((prev) => prev.filter((g) => g.id !== deleteId));
    }

    setDialogOpen(false);
    setDeleteId(null);
    toast.success("¡Item eliminado correctamente!");
  };

  const handleView = (ventas: Ventas) => {
    setVentasToView(null);
    setTimeout(() => setVentasToView(ventas), 0);
  };

  const resetView = () => {
    setVentasToView(null);
  };

  // Función para filtrar las ventas según la selección
  function filtrarVentasPorFecha(ventas: Ventas[], filtro: string): Ventas[] {
    const ahora = new Date();

    switch (filtro) {
      case "hoy": {
        return ventas.filter((v) => {
          const fechaVenta = new Date(v.created_at);
          return (
            fechaVenta.getFullYear() === ahora.getFullYear() &&
            fechaVenta.getMonth() === ahora.getMonth() &&
            fechaVenta.getDate() === ahora.getDate()
          );
        });
      }

      case "ayer": {
        const ayer = new Date(ahora);
        ayer.setDate(ahora.getDate() - 1);
        return ventas.filter((v) => {
          const fechaVenta = new Date(v.created_at);
          return (
            fechaVenta.getFullYear() === ayer.getFullYear() &&
            fechaVenta.getMonth() === ayer.getMonth() &&
            fechaVenta.getDate() === ayer.getDate()
          );
        });
      }

      case "semana": {
        const primerDiaSemana = new Date(ahora);
        primerDiaSemana.setDate(ahora.getDate() - ahora.getDay()); // domingo inicio semana
        primerDiaSemana.setHours(0, 0, 0, 0);
        return ventas.filter((v) => {
          const fechaVenta = new Date(v.created_at);
          return fechaVenta >= primerDiaSemana && fechaVenta <= ahora;
        });
      }

      case "mes": {
        return ventas.filter((v) => {
          const fechaVenta = new Date(v.created_at);
          return (
            fechaVenta.getFullYear() === ahora.getFullYear() &&
            fechaVenta.getMonth() === ahora.getMonth()
          );
        });
      }

      case "anio": {
        return ventas.filter((v) => {
          const fechaVenta = new Date(v.created_at);
          return fechaVenta.getFullYear() === ahora.getFullYear();
        });
      }

      case "todas":
      default:
        return ventas;
    }
  }

  // Función para filtrar los gastos según la selección
  function filtrarGastosPorFecha(gastos: Gastos[], filtro: string): Gastos[] {
    const ahora = new Date();

    switch (filtro) {
      case "hoy": {
        return gastos.filter((g) => {
          const fechaGasto = new Date(g.created_at);
          return (
            fechaGasto.getFullYear() === ahora.getFullYear() &&
            fechaGasto.getMonth() === ahora.getMonth() &&
            fechaGasto.getDate() === ahora.getDate()
          );
        });
      }

      case "ayer": {
        const ayer = new Date(ahora);
        ayer.setDate(ahora.getDate() - 1);
        return gastos.filter((g) => {
          const fechaGasto = new Date(g.created_at);
          return (
            fechaGasto.getFullYear() === ayer.getFullYear() &&
            fechaGasto.getMonth() === ayer.getMonth() &&
            fechaGasto.getDate() === ayer.getDate()
          );
        });
      }

      case "semana": {
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(ahora.getDate() - ahora.getDay());
        inicioSemana.setHours(0, 0, 0, 0);
        return gastos.filter((g) => {
          const fechaGasto = new Date(g.created_at);
          return fechaGasto >= inicioSemana && fechaGasto <= ahora;
        });
      }

      case "mes":
        return gastos.filter((g) => {
          const fechaGasto = new Date(g.created_at);
          return (
            fechaGasto.getFullYear() === ahora.getFullYear() &&
            fechaGasto.getMonth() === ahora.getMonth()
          );
        });

      case "anio":
        return gastos.filter((g) => {
          const fechaGasto = new Date(g.created_at);
          return fechaGasto.getFullYear() === ahora.getFullYear();
        });

      case "todos":
      default:
        return gastos;
    }
  }

  const ventasFiltradas = filtrarVentasPorFecha(ventas, fechaFiltro);
  const gastosFiltrados = filtrarGastosPorFecha(gastos, fechaFiltro);

  const totalCaja =
    ventasFiltradas.reduce((acc, venta) => acc + venta.precio_total, 0) -
    gastosFiltrados.reduce((acc, gasto) => acc + gasto.monto, 0);

  const FormSchema = z.object({
    detalle: z.string().nonempty("El detalle es obligatorio"),
    monto: z
      .number()
      .min(0, "El monto debe ser mayor o igual a 0")
      .nonnegative("El monto no puede ser negativo"),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      detalle: "",
      monto: 0,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoadingForm(true);

    const { error } = await supabase.from("gastos").insert({
      created_at: new Date(),
      detalle: data.detalle,
      monto: data.monto,
    });

    if (error) {
      toast.error("Error al guardar el gasto", {
        description: error.message,
      });
    } else {
      toast.success("¡Gasto guardado correctamente!");
      setDialogGastosOpen(false);
      await fetchGastos();
    }

    setIsLoadingForm(false);
  }

  const handleNewGasto = () => {
    form.reset({
      detalle: "",
      monto: 0,
    });
    setDialogGastosOpen(true);
  };

  const handleCloseModal = () => {
    setDialogGastosOpen(false);
    setTimeout(() => {
      form.reset();
    }, 300);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-6">Ventas</h2>

      {loadingTableVentas ? (
        <LoaderTable />
      ) : (
        <DataTable
          columns={ventasColumns(handleView)}
          data={ventasFiltradas}
          isLoading={loadingTableVentas}
          selectedVenta={ventasToView}
          onViewReset={resetView}
          fechaFiltro={fechaFiltro}
          setFechaFiltro={setFechaFiltro}
          totalCaja={totalCaja}
          onNewGasto={handleNewGasto}
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

      {loadingTableGastos ? (
        <LoaderTable />
      ) : (
        <>
          <h2 className="text-3xl font-bold text-center mb-6">Gastos</h2>
          <Table>
            <TableCaption>
              Esta es una lista de gastos que tuvimos. También aparecerán el
              saldo de deudas.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Fecha</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gastos.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(new Date(item.created_at))}</TableCell>
                  <TableCell>{item.detalle}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.monto, "ARS", 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.detalle.startsWith("Pago deuda:") ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              size="icon"
                              variant="outline"
                              disabled
                              className="opacity-50 cursor-not-allowed"
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          No se puede eliminar un gasto generado por el pago de
                          una deuda.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => confirmDelete(item.id, "gasto")}
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Dialog
        open={dialogGastosOpen}
        onOpenChange={(open) => {
          setDialogGastosOpen(open);
          if (!open) handleCloseModal();
        }}
        aria-describedby={undefined}
      >
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Agregar gasto</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center gap-4">
                <FormField
                  control={form.control}
                  name="detalle"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Detalle</FormLabel>
                      <FormControl>
                        <Input
                          required
                          autoComplete="off"
                          className="w-full"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monto"
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <NumberInput
                          required
                          min={0}
                          decimalScale={2}
                          thousandSeparator="."
                          decimalSeparator=","
                          value={
                            typeof field.value === "number"
                              ? field.value
                              : field.value === undefined || field.value === null || field.value === ""
                                ? undefined
                                : Number(field.value)
                          }
                          onValueChange={(n) => field.onChange(n ?? 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref as any}
                          placeholder="0,00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-x-2">
                <Button type="submit" disabled={isLoadingForm} size="sm">
                  {isLoadingForm && (
                    <Loader2 width={18} className="animate-spin" />
                  )}
                  Agregar gasto
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
