
import { Button } from "@/components/ui/button";
import { formatDateZ, formatShortDate } from "@/app/helpers/formatDate";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontalIcon, CalendarIcon, Clock, Pin } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar22 } from "@/components/calendar-22";
import clsx from "clsx";

const prioridades = ["alta", "normal", "baja"];

export interface CardNoteProps {
    username: string;
    titulo: string;
    updatedAt: Date;
    nota: string;
    fechaVencimiento: Date | null;
    prioridad: string;
    isEditing?: boolean;
    editingTitulo?: string;
    editingNota?: string;
    editingPrioridad?: string;
    editingFechaVencimiento?: Date | null;
    editingAssignedTo?: string;
    setEditingTitulo?: (v: string) => void;
    setEditingNota?: (v: string) => void;
    setEditingPrioridad?: (v: string) => void;
    setEditingFechaVencimiento?: (v: Date | null) => void;
    setEditingAssignedTo?: (v: string) => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onSaveEdit?: () => void;
    onCancelEdit?: () => void;
    onTogglePin?: () => void;
    isPinned?: boolean;
    profiles?: { id: string; nombre: string | null; rol: string | null; }[];
}

function priorityStyles(prioridad: string) {
    switch (prioridad) {
        case "alta":
            // Pastel Red / Rose
            return "bg-rose-100 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-100";
        case "normal":
            // Pastel Blue / Slate
            return "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100";
        case "baja":
            // Pastel Teal / Green
            return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100";
        default:
            return "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100";
    }
}

function badgeStyles(prioridad: string) {
    switch (prioridad) {
        case "alta":
            return "bg-rose-200/50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300";
        case "normal":
            return "bg-slate-200/50 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300";
        case "baja":
            return "bg-emerald-200/50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
        default:
            return "bg-slate-200/50 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300";
    }
}

export default function ModernCardNote({
    username,
    titulo,
    updatedAt,
    nota,
    fechaVencimiento,
    prioridad,
    isEditing = false,
    editingTitulo = "",
    editingNota = "",
    editingPrioridad = "normal",
    editingFechaVencimiento = null,
    editingAssignedTo,
    setEditingTitulo,
    setEditingNota,
    setEditingPrioridad,
    setEditingFechaVencimiento,
    setEditingAssignedTo,
    onEdit,
    onDelete,
    onSaveEdit,
    onCancelEdit,
    onTogglePin,
    isPinned = false,
    profiles,
}: CardNoteProps) {
    return (
        <div
            className={clsx(
                "group relative flex flex-col gap-2 p-4 rounded-xl border transition-all duration-300 hover:shadow-lg",
                priorityStyles(prioridad)
            )}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 ring-2 ring-background/50">
                        <AvatarFallback className="bg-background/50 text-[10px] font-bold">
                            {username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        {isEditing ? (
                            <Select
                                value={editingAssignedTo}
                                onValueChange={(value) => setEditingAssignedTo?.(value)}
                            >
                                <SelectTrigger className="w-[140px] h-6 text-xs bg-transparent border-black/10 dark:border-white/10 px-1">
                                    <SelectValue placeholder="Usuario" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles?.filter(p => p.rol === 'admin').map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.nombre || "Admin sin nombre"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-xs font-semibold opacity-80">{username}</span>
                        )}
                        <span className="text-[10px] opacity-60 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateZ(updatedAt)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 -mr-2 -mt-2">
                    {onTogglePin && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={clsx(
                                "h-8 w-8 transition-all rounded-full hover:bg-black/5 dark:hover:bg-white/10",
                                isPinned ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 placeholder:opacity-40"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin();
                            }}
                        >
                            <Pin className={clsx("w-4 h-4", isPinned && "fill-current")} />
                        </Button>
                    )}

                    {!isEditing && (onEdit || onDelete) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <MoreHorizontalIcon className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {onEdit && (
                                    <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
                                )}
                                {onDelete && (
                                    <DropdownMenuItem
                                        onClick={onDelete}
                                        className="text-destructive"
                                    >
                                        Eliminar
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2 justify-between">
                    {isEditing ? (
                        <Input
                            value={editingTitulo}
                            onChange={(e) => setEditingTitulo?.(e.target.value)}
                            className="font-bold text-lg bg-transparent border-black/10 dark:border-white/10"
                            autoFocus
                            placeholder="Título"
                        />
                    ) : (
                        <h3 className="font-bold text-lg leading-tight tracking-tight">
                            {titulo}
                        </h3>
                    )}

                    {isEditing ? (
                        <Select
                            value={editingPrioridad}
                            onValueChange={(value) => setEditingPrioridad?.(value)}
                        >
                            <SelectTrigger className="w-[100px] h-8 text-xs bg-transparent border-black/10 dark:border-white/10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {prioridades.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {capitalizeFirstLetter(p)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", badgeStyles(prioridad))}>
                            {prioridad}
                        </span>
                    )}
                </div>

                <div className="text-xs opacity-70 flex items-center gap-1.5 font-medium">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {isEditing ? (
                        <Calendar22
                            value={editingFechaVencimiento}
                            onChange={setEditingFechaVencimiento ?? (() => { })}
                            isEditing={isEditing}
                            className="h-8 text-xs"
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                    ) : (
                        <span>
                            Vence:{" "}
                            {fechaVencimiento
                                ? formatShortDate(fechaVencimiento)
                                : "Sin fecha"}
                        </span>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {!isEditing ? (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-sm leading-relaxed opacity-90 whitespace-pre-line font-medium mt-1"
                        >
                            {nota}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col gap-2 w-full mt-1"
                        >
                            <Textarea
                                value={editingNota}
                                onChange={(e) => setEditingNota?.(e.target.value)}
                                className="text-sm resize-none bg-transparent border-black/10 dark:border-white/10 min-h-[100px]"
                                placeholder="Escribe tu nota..."
                            />
                            <div className="flex gap-2 justify-end mt-2">
                                <Button size="sm" variant="ghost" onClick={onCancelEdit} className="hover:bg-black/5 dark:hover:bg-white/10">
                                    Cancelar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={onSaveEdit}
                                    disabled={
                                        !!(
                                            !editingTitulo.trim() ||
                                            !editingNota.trim()
                                        )
                                    }
                                    className="bg-black/80 dark:bg-white/90 text-white dark:text-black hover:bg-black dark:hover:bg-white"
                                >
                                    Guardar
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
