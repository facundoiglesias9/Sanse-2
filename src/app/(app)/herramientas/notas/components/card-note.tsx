import { Button } from "@/components/ui/button";
import { formatDateZ, formatShortDate } from "@/app/helpers/formatDate";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontalIcon, CalendarIcon } from "lucide-react";
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

const prioridades = ["alta", "normal", "baja"];

export interface CardNoteProps {
  username: string;
  titulo: string;
  updatedAt: Date;
  nota: string;
  originalNota: string;
  fechaVencimiento: Date | null;
  prioridad: string;
  isEditing?: boolean;
  editingTitulo?: string;
  editingNota?: string;
  editingPrioridad?: string;
  editingFechaVencimiento?: Date | null;
  setEditingTitulo?: (v: string) => void;
  setEditingNota?: (v: string) => void;
  setEditingPrioridad?: (v: string) => void;
  setEditingFechaVencimiento?: (v: Date | null) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}

function prioridadColor(prioridad: string) {
  switch (prioridad) {
    case "alta":
      return "bg-red-600 text-white";
    case "normal":
      return "bg-secondary text-foreground";
    case "baja":
      return "bg-amber-950 text-white";
    default:
      return "bg-secondary text-foreground";
  }
}

export default function CardNote({
  username,
  titulo,
  updatedAt,
  nota,
  originalNota,
  fechaVencimiento,
  prioridad,
  isEditing = false,
  editingTitulo = "",
  editingNota = "",
  editingPrioridad = "normal",
  editingFechaVencimiento = null,
  setEditingTitulo,
  setEditingNota,
  setEditingPrioridad,
  setEditingFechaVencimiento,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
}: CardNoteProps) {
  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <h6 className="text-sm leading-none font-medium">{username}</h6>
            <span className="text-xs text-muted-foreground">
              Última modificación: {formatDateZ(updatedAt)}
            </span>
          </div>
        </div>
        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontalIcon />
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
      </CardHeader>
      <CardContent className="p-0">
        <div className="pt-3 pb-4 px-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            {isEditing ? (
              <Input
                value={editingTitulo}
                onChange={(e) => setEditingTitulo?.(e.target.value)}
                className="font-semibold text-lg flex-1"
                autoFocus
              />
            ) : (
              <h2 className="font-semibold text-lg flex-1 truncate">
                {titulo}
              </h2>
            )}
            {isEditing ? (
              <Select
                value={editingPrioridad}
                onValueChange={(value) => setEditingPrioridad?.(value)}
              >
                <SelectTrigger>
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
              <Badge className={prioridadColor(prioridad)}>
                {capitalizeFirstLetter(prioridad)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <CalendarIcon className="w-4 h-4" />
            {isEditing ? (
              <Calendar22
                value={editingFechaVencimiento}
                onChange={setEditingFechaVencimiento ?? (() => {})}
                isEditing={isEditing}
              />
            ) : (
              <span>
                Vence:{" "}
                {fechaVencimiento
                  ? formatShortDate(fechaVencimiento)
                  : "sin fecha"}
              </span>
            )}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {!isEditing ? (
              <motion.p
                key="note-content"
                className="mt-1 text-sm text-muted-foreground whitespace-pre-line"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.14 }}
              >
                {nota}
              </motion.p>
            ) : (
              <motion.div
                key="editing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.14 }}
                className="flex flex-col gap-2"
              >
                <Textarea
                  value={editingNota}
                  onChange={(e) => setEditingNota?.(e.target.value)}
                  className="mt-1 text-sm resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={onSaveEdit}
                    disabled={
                      !!(
                        !editingTitulo.trim() ||
                        !editingNota.trim() ||
                        (editingTitulo === titulo &&
                          editingNota === originalNota &&
                          editingPrioridad === prioridad &&
                          ((fechaVencimiento === null &&
                            editingFechaVencimiento === null) ||
                            (fechaVencimiento &&
                              editingFechaVencimiento &&
                              formatShortDate(fechaVencimiento) ===
                                formatShortDate(editingFechaVencimiento))))
                      )
                    }
                  >
                    Guardar
                  </Button>
                  <Button size="sm" onClick={onCancelEdit} variant="ghost">
                    Cancelar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
