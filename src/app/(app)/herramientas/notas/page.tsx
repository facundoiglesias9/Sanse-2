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
import { Loader2, Plus, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
    const [notas, setNotas] = useState<Nota[]>([]);
    const [profiles, setProfiles] = useState<{ id: string; nombre: string | null }[]>([]);
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

    const prioridades = ["alta", "normal", "baja"];
    const supabase = createClient();
    // ... (omitting intermediate code, use existing context or multiple chunks if needed. Wait, single chunk replacement is easier if I target the state definition first, then the function, then the render)

    // Actually, I can do it in one ReplaceFileContent if the file isn't too huge, but it's large.
    // I will split into multiple chunks in MultiReplaceFileContent for safety and clarity? No, the tool is ReplaceFileContent (singular).
    // I will use MultiReplaceFileContent for multiple edits in the same file.


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
                // 1. Sort by Expiration Date (Ascending: Sooner first)
                // Null dates should be at the end? Or beginning? Usually end for "future tasks without deadline".
                // Let's assume nulls at the end.
                if (a.fecha_vencimiento && !b.fecha_vencimiento) return -1;
                if (!a.fecha_vencimiento && b.fecha_vencimiento) return 1;
                if (a.fecha_vencimiento && b.fecha_vencimiento) {
                    const dateA = new Date(a.fecha_vencimiento).getTime();
                    const dateB = new Date(b.fecha_vencimiento).getTime();
                    if (dateA !== dateB) return dateA - dateB;
                }

                // 2. Sort by Priority (Alta -> Normal -> Baja)
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

        // If a user is selected, assign it to them (created_by)
        // Otherwise, supabase might use default or we can let it be (it will use current user usually via trigger or RLS, but here we can force it)
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
        setDeleteId(null);
        if (!error) {
            setNotas(notas.filter((n) => n.id !== deleteId));
            toast.success("Nota eliminada");
        } else {
            toast.error("Error al eliminar la nota");
        }
    };

    const confirmDelete = (id: string) => {
        setDeleteId(id);
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
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Notas</h1>
                        <p className="text-muted-foreground">Gestiona tus tareas y recordatorios con estilo.</p>
                    </div>

                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all font-semibold gap-2">
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
                        {notas.map((nota) => (
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
                                    setEditingAssignedTo={setEditingAssignedTo}
                                    onSaveEdit={guardarEdit}
                                    onCancelEdit={cancelarEdit}
                                    profiles={profiles}
                                    editingAssignedTo={editingAssignedTo}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {notas.length === 0 && !isLoading && (
                        <div className="col-span-full py-20 text-center opacity-40">
                            <p className="text-xl font-medium">No hay notas creadas.</p>
                        </div>
                    )}
                </div>
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
    );
}
