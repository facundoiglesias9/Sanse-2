"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Trash2 } from "lucide-react";

export type InventarioTipoRecord = {
  id: string;
  nombre: string;
};

interface TipoManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipos: InventarioTipoRecord[];
  isLoading: boolean;
  onCreate: (nombre: string) => Promise<boolean>;
  onRename: (id: string, nombre: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  fallbackTipos: string[];
  canManage: boolean;
}

export function TipoManagerDialog({
  open,
  onOpenChange,
  tipos,
  isLoading,
  onCreate,
  onRename,
  onDelete,
  fallbackTipos,
  canManage,
}: TipoManagerDialogProps) {
  const [newTipo, setNewTipo] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setEditValues(
        tipos.reduce<Record<string, string>>((acc, tipo) => {
          acc[tipo.id] = tipo.nombre;
          return acc;
        }, {}),
      );
    } else {
      setNewTipo("");
      setIsCreating(false);
      setPendingId(null);
      setEditValues({});
    }
  }, [open, tipos]);

  const sortedTipos = useMemo(
    () =>
      [...tipos].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
      ),
    [tipos],
  );

  const handleSubmitNew = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTipo.trim()) return;

    setIsCreating(true);
    const success = await onCreate(newTipo);
    if (success) {
      setNewTipo("");
    }
    setIsCreating(false);
  };

  const handleRename = async (id: string) => {
    const value = editValues[id] ?? "";
    if (!value.trim()) return;

    setPendingId(id);
    await onRename(id, value);
    setPendingId(null);
  };

  const handleDelete = async (id: string) => {
    setPendingId(id);
    const success = await onDelete(id);
    if (success) {
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setPendingId(null);
  };

  const renderTipoList = () => {
    if (isLoading) {
      return (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-10" />
            </div>
          ))}
        </div>
      );
    }

    if (sortedTipos.length === 0) {
      return (
        <div className="mt-4 text-sm text-muted-foreground">
          Todavía no configuraste tipos personalizados. Podés agregarlos usando el formulario de arriba.
        </div>
      );
    }

    return (
      <ScrollArea className="mt-4 max-h-64 pr-2">
        <div className="space-y-3">
          {sortedTipos.map((tipo) => {
            const value = editValues[tipo.id] ?? tipo.nombre;
            const trimmed = value.trim();
            const original = tipo.nombre.trim();
            const isDirty =
              trimmed.toLowerCase() !== original.toLowerCase() && trimmed.length > 0;

            return (
              <div key={tipo.id} className="flex items-center gap-2">
                <Input
                  value={value}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      [tipo.id]: event.target.value,
                    }))
                  }
                  className="flex-1"
                  disabled={pendingId === tipo.id}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleRename(tipo.id)}
                  disabled={!isDirty || pendingId === tipo.id}
                  title="Guardar cambios"
                >
                  {pendingId === tipo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(tipo.id)}
                  disabled={pendingId === tipo.id}
                  title="Eliminar tipo"
                >
                  {pendingId === tipo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-describedby={undefined}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Gestionar tipos de inventario</DialogTitle>
          <DialogDescription>
            Creá, renombrá o eliminá las categorías que usás para clasificar tu inventario.
          </DialogDescription>
        </DialogHeader>

        {canManage ? (
          <div className="space-y-4">
            <form onSubmit={handleSubmitNew} className="flex items-center gap-2">
              <Input
                placeholder="Nombre del nuevo tipo"
                value={newTipo}
                onChange={(event) => setNewTipo(event.target.value)}
                autoComplete="off"
              />
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Agregar"
                )}
              </Button>
            </form>

            {renderTipoList()}
          </div>
        ) : (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Para administrar los tipos desde la aplicación es necesario crear una tabla llamada
              <code className="mx-1 text-xs font-mono">inventario_tipos</code> en tu base de datos.
              Asegurate de que tenga columnas <code className="mx-1 text-xs font-mono">id</code> (uuid)
              y <code className="mx-1 text-xs font-mono">nombre</code> (texto).
            </p>
            <div>
              <p className="mb-2 text-sm text-foreground">Tipos detectados actualmente:</p>
              <div className="flex flex-wrap gap-2">
                {fallbackTipos.map((tipo) => (
                  <Badge key={tipo} variant="secondary">
                    {tipo}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
