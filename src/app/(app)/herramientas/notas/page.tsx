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
import ModernCardNote from "@/app/(app)/herramientas/notas/components/modern-card-note";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar22 } from "@/components/calendar-22";
import { Loader2, Plus, User, Flag, Calendar, Filter } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    assigned_to: z.string().optional(),
});

export default function Notas2Page() {
    console.log("Renderizando Notas2Page"); // Debug log
    const [notas, setNotas] = useState<Nota[]>([]);
    const [profiles, setProfiles] = useState<{ id: string; nombre: string | null; }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitulo, setEditingTitulo] = useState("");
    const [editingNota, setEditingNota] = useState("");
    const [editingPrioridad, setEditingPrioridad] = useState("normal");
    const [editingFechaVencimiento, setEditingFechaVencimiento] =
        useState<Date | null>(null);
    const [editingAssignedTo, setEditingAssignedTo] = useState<string>("");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [session, setSession] = useState<any>(null);

    // Filtros
    const [filterUser, setFilterUser] = useState<string>("all");
    const [filterPriority, setFilterPriority] = useState<string>("all");
    const [filterDate, setFilterDate] = useState<string>("all");

    const prioridades = ["alta", "normal", "baja"];
    const supabase = createClient();

    const filteredNotas = notas.filter((nota) => {
        // Filtrar por Usuario
        if (filterUser !== "all") {
            // Comparamos con 'created_by'
            if (nota.created_by !== filterUser) return false;
        }

        // Filtrar por Prioridad
        if (filterPriority !== "all") {
            if (nota.prioridad !== filterPriority) return false;
        }

        // Filtrar por Fecha (Vencimiento)
        if (filterDate !== "all") {
            if (!nota.fecha_vencimiento) return false;
            const due = new Date(nota.fecha_vencimiento);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (filterDate === "today") {
                if (due.toDateString() !== today.toDateString()) return false;
            } else if (filterDate === "expired") {
                // La fecha de vencimiento es estrictamente anterior a hoy
                if (due >= today) return false;
            } else if (filterDate === "this_week") {
                // Próximos 7 días
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);
                if (due < today || due > nextWeek) return false;
            }
        }

        return true;
    });

    async function fetchProfiles() {
        const { data } = await supabase.from("profiles").select("id, nombre");
        if (data) {
            setProfiles(data);
        }
    }

    async function fetchNotas() {
        setIsLoading(true);

        const { data } = await supabase
            .from("notas")
            .select("*, profiles:created_by(nombre)");

        if (data) {
            const sorted = data.sort((a, b) => {
                // 1. Ordenar por Fecha de Vencimiento
                if (a.fecha_vencimiento && !b.fecha_vencimiento) return -1;
                if (!a.fecha_vencimiento && b.fecha_vencimiento) return 1;

                if (a.fecha_vencimiento && b.fecha_vencimiento) {
                    const dateA = new Date(a.fecha_vencimiento);
                    const dateB = new Date(b.fecha_vencimiento);

                    // Restablecer hora para comparar estrictamente por día calendario
                    dateA.setHours(0, 0, 0, 0);
                    dateB.setHours(0, 0, 0, 0);

                    if (dateA.getTime() !== dateB.getTime()) {
                        return dateA.getTime() - dateB.getTime();
                    }
                }

                // 2. Ordenar por Prioridad
                const priorityOrder: Record<string, number> = { "alta": 1, "normal": 2, "baja": 3 };
                const pA = priorityOrder[a.prioridad] || 99;
                const pB = priorityOrder[b.prioridad] || 99;
                return pA - pB;
            });
            setNotas(sorted);
        } else {
            setNotas([]);
        }
        setIsLoading(false);
    }

    useEffect(() => {
        fetchNotas();
        fetchProfiles();
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
    }, []);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            titulo: "",
            nota: "",
            prioridad: "normal",
            fecha_vencimiento: undefined,
            assigned_to: undefined,
        },
    });

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        setIsLoading(true);

        const payload: any = {
            titulo: data.titulo,
            nota: data.nota,
            prioridad: data.prioridad,
            fecha_vencimiento: data.fecha_vencimiento ?? null,
        };

        if (data.assigned_to) {
            payload.created_by = data.assigned_to;
        } else if (session?.user?.id) {
            payload.created_by = session.user.id;
        }

        const { error } = await supabase
            .from("notas")
            .insert([payload])
            .single();

        if (error) {
            toast.error("Error al crear la nota", {
                description: error.message,
            });
            setIsLoading(false);
            return;
        }

        await fetchNotas();
        form.reset();
        setIsLoading(false);
        setCreateDialogOpen(false);
        toast.success("Nota creada");
    }

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        const { error } = await supabase
            .from("notas")
            .delete()
            .match({ id: deleteId });
        setIsDeleting(false);

        if (!error) {
            const idToDelete = deleteId;
            setDeleteId(null);

            // Se eliminó comentario largo para evitar errores ocultos
            setTimeout(() => {
                setNotas((currentNotas) => currentNotas.filter((n) => n.id !== idToDelete));
                toast.success("Nota eliminada");
            }, 500);
        } else {
            setDeleteId(null);
            toast.error("Error al eliminar la nota");
        }
    };

    const confirmDelete = (id: string) => {
        setTimeout(() => setDeleteId(id), 50);
    };

    const comenzarEdit = (nota: Nota) => {
        setEditingId(nota.id);
        setEditingTitulo(nota.titulo);
        setEditingNota(nota.nota);
        setEditingPrioridad(nota.prioridad);
        setEditingFechaVencimiento(
            nota.fecha_vencimiento ? new Date(nota.fecha_vencimiento) : null,
        );
        setEditingAssignedTo(nota.created_by);
    };

    const cancelarEdit = () => {
        setEditingId(null);
        setEditingTitulo("");
        setEditingNota("");
        setEditingPrioridad("normal");
        setEditingFechaVencimiento(null);
        setEditingAssignedTo("");
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
                created_by: editingAssignedTo,
            })
            .eq("id", editingId);

        if (!error) {
            await fetchNotas();
            setEditingId(null);
            toast.success("Nota actualizada");
        } else {
            toast.error("No se pudo editar la nota");
        }
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground p-6 md:p-12 transition-colors duration-500">
            <div className="max-w-7xl mx-auto w-full">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Notas</h1>
                    <p className="text-muted-foreground">Gestiona tus tareas y recordatorios con estilo.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start w-full md:w-auto">
                        <Select value={filterUser} onValueChange={setFilterUser}>
                            <SelectTrigger className="w-full md:w-[200px] h-11 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all rounded-2xl shadow-sm ring-offset-0 focus:ring-0">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <User className="w-4 h-4" />
                                    <SelectValue placeholder="Usuario" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 rounded-xl">
                                <SelectItem value="all" className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer rounded-lg my-1">Todos los usuarios</SelectItem>
                                {profiles.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer rounded-lg my-1">
                                        {p.nombre || "Usuario"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                            <SelectTrigger className="w-full md:w-[220px] h-11 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all rounded-2xl shadow-sm ring-offset-0 focus:ring-0">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Flag className="w-4 h-4" />
                                    <SelectValue placeholder="Prioridad" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 rounded-xl">
                                <SelectItem value="all" className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer rounded-lg my-1">Todas las prioridades</SelectItem>
                                <SelectItem value="alta" className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer rounded-lg my-1">
                                    Alta
                                </SelectItem>
                                <SelectItem value="normal" className="text-blue-400 focus:bg-blue-500/10 focus:text-blue-300 cursor-pointer rounded-lg my-1">
                                    Normal
                                </SelectItem>
                                <SelectItem value="baja" className="text-green-400 focus:bg-green-500/10 focus:text-green-300 cursor-pointer rounded-lg my-1">
                                    Baja
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterDate} onValueChange={setFilterDate}>
                            <SelectTrigger className="w-full md:w-[180px] h-11 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all rounded-2xl shadow-sm ring-offset-0 focus:ring-0">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Calendar className="w-4 h-4" />
                                    <SelectValue placeholder="Fecha" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 rounded-xl">
                                <SelectItem value="all" className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer rounded-lg my-1">Cualquier fecha</SelectItem>
                                <SelectItem value="expired" className="text-orange-400 focus:bg-orange-500/10 focus:text-orange-300 cursor-pointer rounded-lg my-1">Vencidas</SelectItem>
                                <SelectItem value="today" className="text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-300 cursor-pointer rounded-lg my-1">Vence Hoy</SelectItem>
                                <SelectItem value="this_week" className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer rounded-lg my-1">Vence esta semana</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all font-semibold gap-2 w-full md:w-auto">
                                <Plus className="w-5 h-5" />
                                Nueva Nota
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl bg-card">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold">Crear nueva nota</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                                    <FormField
                                        control={form.control}
                                        name="titulo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-semibold text-foreground/80">Título</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Ej: Revisar stock"
                                                        className="bg-muted/50 border-transparent focus:border-primary/20"
                                                        disabled={isLoading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="assigned_to"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold text-foreground/80">Asignar a</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-muted/50 border-transparent focus:border-primary/20 w-full">
                                                                <SelectValue placeholder="Seleccionar usuario (Opcional)" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {profiles.map((profile) => (
                                                                <SelectItem key={profile.id} value={profile.id}>
                                                                    {profile.nombre || "Usuario sin nombre"}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="prioridad"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold text-foreground/80">Prioridad</FormLabel>
                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-muted/50 border-transparent focus:border-primary/20">
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
                                        <FormField
                                            control={form.control}
                                            name="fecha_vencimiento"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold text-foreground/80">Vencimiento</FormLabel>
                                                    <FormControl>
                                                        <Calendar22
                                                            value={field.value ?? null}
                                                            onChange={field.onChange}
                                                            className="bg-muted/50 border-transparent focus:border-primary/20"
                                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                                        />
                                                    </FormControl>
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
                                                <FormLabel className="font-semibold text-foreground/80">Contenido</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Escribe los detalles aquí..."
                                                        className="min-h-[120px] resize-none bg-muted/50 border-transparent focus:border-primary/20"
                                                        disabled={isLoading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                                            Crear Nota
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredNotas.map((nota) => (
                            <motion.div
                                key={nota.id}
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{ duration: 0.3, type: "spring", stiffness: 100 }}
                                layout
                            >
                                <ModernCardNote
                                    username={nota.profiles?.nombre || "Usuario"}
                                    titulo={nota.titulo}
                                    updatedAt={new Date(nota.updated_at)}
                                    nota={nota.nota}
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
                                    setEditingAssignedTo={setEditingAssignedTo}
                                    onSaveEdit={guardarEdit}
                                    onCancelEdit={cancelarEdit}
                                    profiles={profiles}
                                    editingAssignedTo={editingAssignedTo}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {filteredNotas.length === 0 && !isLoading && (
                        <div className="col-span-full py-20 text-center opacity-40">
                            <p className="text-xl font-medium">No se encontraron notas con estos filtros.</p>
                        </div>
                    )}
                </div>

                <Dialog
                    open={!!deleteId}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>¿Eliminar nota?</DialogTitle>
                        </DialogHeader>
                        <p className="text-muted-foreground">
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setDeleteId(null)}>
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
        </div>
    );
}
