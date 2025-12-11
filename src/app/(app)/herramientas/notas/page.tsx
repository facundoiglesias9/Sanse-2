"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Nota } from "@/app/types/nota";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import CardNote from "@/app/(app)/herramientas/notas/components/card-note";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar22 } from "@/components/calendar-22";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const FormSchema = z.object({
  titulo: z.string().min(2).max(100),
  nota: z.string().min(10, {
    message: "La nota debe tener al menos 10 caracteres.",
  }),
  fecha_vencimiento: z.date().nullable().optional(),
  prioridad: z.enum(["alta", "normal", "baja"]),
});

export default function BlocDeNotasPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitulo, setEditingTitulo] = useState("");
  const [editingNota, setEditingNota] = useState("");
  const [editingPrioridad, setEditingPrioridad] = useState("normal");
  const [editingFechaVencimiento, setEditingFechaVencimiento] =
    useState<Date | null>(null);
  const prioridades = ["alta", "normal", "baja"];
  const supabase = createClient();

  async function fetchNotas() {
    setIsLoading(true);

    const { data } = await supabase
      .from("notas")
      .select("*, profiles:created_by(nombre)")
      .order("fecha_vencimiento", { ascending: true })
      .order("prioridad", { ascending: true });

    setNotas(data || []);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchNotas();
  }, []);

  // Crear nueva nota desde el formulario
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      titulo: "",
      nota: "",
      prioridad: "normal",
      fecha_vencimiento: undefined,
    },
  });

  const notaValue = form.watch("nota");
  const notaTitle = form.watch("titulo");

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);

    const { error } = await supabase
      .from("notas")
      .insert([
        {
          titulo: data.titulo,
          nota: data.nota,
          prioridad: data.prioridad,
          fecha_vencimiento: data.fecha_vencimiento ?? null,
        },
      ])
      .single();

    if (error) {
      toast.error("Error al crear la nota", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    // Recarga la lista de notas
    await fetchNotas();
    form.reset();
    setIsLoading(false);
  }

  // Eliminar nota
  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("notas")
      .delete()
      .match({ id: deleteId });
    setIsDeleting(false);
    setDialogOpen(false);
    setDeleteId(null);
    if (!error) {
      setNotas(notas.filter((n) => n.id !== deleteId));
    } else {
      toast.error("Error al eliminar la nota");
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDialogOpen(true);
  };

  const comenzarEdit = (nota: Nota) => {
    setEditingId(nota.id);
    setEditingTitulo(nota.titulo);
    setEditingNota(nota.nota);
    setEditingPrioridad(nota.prioridad);
    setEditingFechaVencimiento(
      nota.fecha_vencimiento ? new Date(nota.fecha_vencimiento) : null,
    );
  };

  const cancelarEdit = () => {
    setEditingId(null);
    setEditingTitulo("");
    setEditingNota("");
    setEditingPrioridad("normal");
    setEditingFechaVencimiento(null);
    form.reset();
  };

  const guardarEdit = async () => {
    if (!editingId) return;
    setIsLoading(true);

    const fechaFinal = editingFechaVencimiento ? editingFechaVencimiento : null;

    const { error } = await supabase
      .from("notas")
      .update({
        titulo: editingTitulo,
        nota: editingNota,
        prioridad: editingPrioridad,
        fecha_vencimiento: fechaFinal,
      })
      .eq("id", editingId);

    if (!error) {
      await fetchNotas();
      setEditingId(null);
    } else {
      toast.error("No se pudo editar la nota");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Notas</h1>
      <div className="min-w-lg mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Título"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prioridad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {prioridades.map((prioridad) => (
                          <SelectItem key={prioridad} value={prioridad}>
                            {prioridad.charAt(0).toUpperCase() +
                              prioridad.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="nota"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Escribe tu nota acá..."
                      className="resize-none"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fecha_vencimiento"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Calendar22
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={
                isLoading ||
                !notaValue ||
                notaTitle.trim().length < 2 ||
                notaValue.trim().length < 10
              }
            >
              {isLoading ? "Creando..." : "Crear nota"}
            </Button>
          </form>
        </Form>
      </div>

      {/* Renderizado de notas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <AnimatePresence>
          {notas.map((nota) => (
            <motion.div
              key={nota.id}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18 }}
              layout
            >
              <CardNote
                username={nota.profiles?.nombre || "Usuario desconocido"}
                titulo={nota.titulo}
                updatedAt={new Date(nota.updated_at)}
                nota={nota.nota}
                originalNota={nota.nota}
                fechaVencimiento={
                  nota.fecha_vencimiento
                    ? new Date(nota.fecha_vencimiento)
                    : null
                }
                prioridad={nota.prioridad}
                onDelete={() => confirmDelete(nota.id)}
                onEdit={() => comenzarEdit(nota)}
                isEditing={editingId === nota.id}
                editingTitulo={editingTitulo}
                editingNota={editingNota}
                editingPrioridad={editingPrioridad}
                editingFechaVencimiento={editingFechaVencimiento}
                setEditingTitulo={setEditingTitulo}
                setEditingNota={setEditingNota}
                setEditingPrioridad={setEditingPrioridad}
                setEditingFechaVencimiento={setEditingFechaVencimiento}
                onSaveEdit={guardarEdit}
                onCancelEdit={cancelarEdit}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
            Esta acción no se puede deshacer. Se eliminará la nota
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
