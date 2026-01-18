"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { FieldDefinition } from "@/app/types/rules";
import { Reorder, useDragControls } from "framer-motion";

interface FieldsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFields: FieldDefinition[];
  onSave: (newFields: FieldDefinition[]) => void;
}

export function FieldsConfigDialog({ open, onOpenChange, currentFields, onSave }: FieldsConfigDialogProps) {
  const [fields, setFields] = useState<FieldDefinition[]>([]);

  useEffect(() => {
    if (open) {
      setFields(JSON.parse(JSON.stringify(currentFields)));
    }
  }, [open, currentFields]);

  const addField = () => {
    setFields([
      ...fields,
      { key: "", label: "", type: "text" }
    ]);
  };

  const removeField = (index: number) => {
    const newFields = [...fields];
    newFields.splice(index, 1);
    setFields(newFields);
  };

  const updateField = (index: number, key: keyof FieldDefinition, value: any) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const handleSave = () => {
    // Validate
    const validFields = fields.filter(f => f.key.trim() !== "" && f.label.trim() !== "");
    onSave(validFields);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] w-full max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Configurar Campos Disponibles</DialogTitle>
          <DialogDescription>
            Define las variables que el sistema reconocerá para crear reglas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[25%] pl-4">Nombre Visible</TableHead>
                  <TableHead className="w-[20%]">ID Interno</TableHead>
                  <TableHead className="w-[20%]">Tipo de Dato</TableHead>
                  <TableHead className="w-[30%]">Opciones / Fuente</TableHead>
                  <TableHead className="w-[5%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/5">
                    <TableCell className="pl-4 align-top py-3">
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(idx, "label", e.target.value)}
                        placeholder="Ej: Método Pago"
                        className="font-medium"
                      />
                    </TableCell>
                    <TableCell className="align-top py-3">
                      <Input
                        value={field.key}
                        onChange={(e) => updateField(idx, "key", e.target.value)}
                        placeholder="clave_interna"
                        className="font-mono text-xs bg-muted/30"
                      />
                    </TableCell>
                    <TableCell className="align-top py-3">
                      <Select
                        value={field.type}
                        onValueChange={(v) => updateField(idx, "type", v as any)}
                      >
                        <SelectTrigger className="w-full text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto Libre</SelectItem>
                          <SelectItem value="number">Numérico</SelectItem>
                          <SelectItem value="boolean">Sí / No</SelectItem>
                          <SelectItem value="select">Lista Opciones</SelectItem>
                          <SelectItem value="dynamic_select">Desde Base de Datos</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top py-3">
                      {field.type === 'dynamic_select' ? (
                        <Select
                          value={field.source}
                          onValueChange={(v) => updateField(idx, "source", v)}
                        >
                          <SelectTrigger className="w-full text-xs h-9"><SelectValue placeholder="Seleccionar Fuente..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="categories">Categorías</SelectItem>
                            <SelectItem value="providers">Proveedores</SelectItem>
                            <SelectItem value="bottleTypes">Tipos de Frasco</SelectItem>
                            <SelectItem value="genres">Géneros</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : field.type === 'select' ? (
                        <Input
                          placeholder="Opción 1, Opción 2..."
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => updateField(idx, "options", e.target.value.split(',').map(s => s.trim()))}
                          className="text-xs h-9"
                        />
                      ) : (
                        <div className="h-9 flex items-center text-muted-foreground/30 text-xs px-2 select-none">
                          —
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top py-3 text-right pr-4">
                      <Button variant="ghost" size="icon" onClick={() => removeField(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {fields.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No hay campos definidos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Button variant="outline" onClick={addField} className="w-full mt-4 border-dashed border-2 hover:bg-accent hover:text-accent-foreground">
            <Plus className="w-4 h-4 mr-2" /> Añadir Nueva Variable
          </Button>
        </div>

        <div className="p-6 border-t bg-muted/10 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Guardar Cambios</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
