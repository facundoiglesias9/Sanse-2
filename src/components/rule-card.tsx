"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Info, X, ChevronDown, Check, ChevronsUpDown, Save, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DEFAULT_FIELD_DEFINITIONS, FieldDefinition } from "@/app/types/rules";

export type InventoryItem = {
  id: string;
  nombre: string;
  tipo: string;
};

export type DeductionRule = {
  id: string; // generated
  name: string; // e.g. "Perfume Femenino Standard"
  conditions: {
    field: string; // e.g. "genero", "categoria"
    operator: "eq" | "contains";
    value: string;
  }[];
  deductions: {
    type: "fixed" | "dynamic_essence" | "dynamic_label";
    inventario_id?: string; // If fixed
    quantity: number;
  }[];
};

interface RuleCardProps {
  rule: DeductionRule;
  inventory: InventoryItem[];
  providers: { id: string; nombre: string; }[];
  genres: string[];
  categories: string[];
  bottleTypes: string[];
  fieldDefinitions?: FieldDefinition[];
  isExpanded?: boolean;
  onToggle?: () => void;
  onSave?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUpdateName: (name: string) => void;
  onAddCondition: () => void;
  onUpdateCondition: (idx: number, field: string, value: any) => void;
  onRemoveCondition: (idx: number) => void;
  onAddDeduction: () => void;
  onUpdateDeduction: (idx: number, field: string, value: any) => void;
  onRemoveDeduction: (idx: number) => void;
  dragHandle?: React.ReactNode;
}

export function RuleCard({
  rule,
  inventory,
  providers,
  genres,
  categories,
  bottleTypes,
  fieldDefinitions,
  isExpanded = false,
  onToggle,
  onSave,
  onDuplicate,
  onDelete,
  onUpdateName,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  onAddDeduction,
  onUpdateDeduction,
  onRemoveDeduction,
  dragHandle
}: RuleCardProps) {

  const definitions = (fieldDefinitions && fieldDefinitions.length > 0)
    ? fieldDefinitions
    : DEFAULT_FIELD_DEFINITIONS;

  return (
    <Card className={cn(
      "transition-all duration-200 border-l-4",
      isExpanded ? "border-l-primary ring-1 ring-primary/20 shadow-md" : "border-l-muted-foreground/20 hover:border-l-primary/50"
    )}>
      {/* Minimalist Header */}
      <div
        className="flex items-center justify-between py-2 px-4 cursor-pointer hover:bg-accent/5 transition-colors h-14"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {dragHandle && (
            <div onClick={(e) => e.stopPropagation()} className="cursor-grab touch-none opacity-50 hover:opacity-100 transition-opacity">
              {dragHandle}
            </div>
          )}
          <div className={cn("transition-transform duration-200 text-muted-foreground", isExpanded && "rotate-180")}>
            <ChevronDown className="w-4 h-4" />
          </div>

          <div className="flex flex-col justify-center">
            <h3 className="font-medium text-sm select-none leading-none mb-1">{rule.name || "Nueva Regla (Sin nombre)"}</h3>
            {!isExpanded && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground leading-none">
                <span className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{rule.conditions.length}</span> cond
                </span>
                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{rule.deductions.length}</span> acc
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider>
            {isExpanded ? (
              <>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate?.();
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicar regla</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() => {
                        onSave?.();
                        onToggle?.();
                      }}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Guardar y cerrar</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={onDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eliminar regla</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <div className="flex items-center opacity-0 hover:opacity-100 transition-opacity">
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate?.();
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicar</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eliminar</TooltipContent>
                </Tooltip>
              </div>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* Expanded Editor */}
      {
        isExpanded && (
          <div className="border-t bg-muted/5 animate-in slide-in-from-top-2 duration-200">
            <CardContent className="pt-6 grid md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <Input
                  value={rule.name}
                  onChange={(e) => onUpdateName(e.target.value)}
                  placeholder="Nombre de la regla (ej: Perfume Femenino)"
                  className="font-medium text-lg bg-background"
                />
              </div>

              {/* CONDITIONS */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Condiciones</h4>
                  <Button variant="ghost" size="sm" onClick={onAddCondition} className="h-6 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2 bg-background/50 p-3 rounded-lg border">
                  {rule.conditions.map((cond, idx) => {
                    const currentDef = definitions.find(d => d.key === cond.field);

                    return (
                      <div key={idx} className="grid grid-cols-[125px_105px_1fr_auto] gap-2 items-center p-2 bg-card border rounded-lg shadow-sm">
                        <Select value={cond.field} onValueChange={(v) => {
                          onUpdateCondition(idx, "field", v);
                          onUpdateCondition(idx, "value", "");
                          // Auto-set operator for strict types
                          const newDef = definitions.find(d => d.key === v);
                          if (newDef?.type === 'boolean' || newDef?.type === 'select' || newDef?.type === 'dynamic_select') {
                            onUpdateCondition(idx, "operator", "eq");
                          }
                        }}>
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {definitions.map(def => (
                              <SelectItem key={def.key} value={def.key}>{def.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={cond.operator} onValueChange={(v) => onUpdateCondition(idx, "operator", v)}>
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eq">Igual a</SelectItem>
                            {/* Hide 'contains' for select/boolean types */}
                            {(!currentDef || currentDef.type === 'text') && (
                              <SelectItem value="contains">Contiene</SelectItem>
                            )}
                          </SelectContent>
                        </Select>

                        <div className="min-w-0">
                          {(() => {
                            if (currentDef?.type === 'boolean') {
                              return (
                                <Select value={cond.value} onValueChange={(v) => onUpdateCondition(idx, "value", v)}>
                                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Si">Sí</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              );
                            }
                            if (currentDef?.type === 'select') {
                              return (
                                <Select value={cond.value} onValueChange={(v) => onUpdateCondition(idx, "value", v)}>
                                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                  <SelectContent>
                                    {currentDef.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            if (currentDef?.type === 'dynamic_select') {
                              let options: string[] = [];
                              if (currentDef.source === 'categories') options = categories;
                              else if (currentDef.source === 'genres') options = genres;
                              else if (currentDef.source === 'bottleTypes') options = bottleTypes;
                              else if (currentDef.source === 'providers') options = providers.map(p => p.nombre);

                              return (
                                <Select value={cond.value} onValueChange={(v) => onUpdateCondition(idx, "value", v)}>
                                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                  <SelectContent>
                                    {options.length > 0 ? options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>) : <div className="p-2 text-xs text-muted-foreground">Sin datos</div>}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            // Default Text Input
                            return (
                              <Input
                                value={cond.value}
                                onChange={(e) => onUpdateCondition(idx, "value", e.target.value)}
                                placeholder="Valor..."
                                className="w-full h-8 text-sm"
                              />
                            );
                          })()}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveCondition(idx)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DEDUCTIONS */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Acciones</h4>
                  <Button variant="ghost" size="sm" onClick={onAddDeduction} className="h-6 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Agregar
                  </Button>
                </div>
                <div className="space-y-2 bg-background/50 p-3 rounded-lg border">
                  {rule.deductions.map((ded, idx) => (
                    <div key={idx} className="flex flex-col p-3 bg-card border rounded-lg shadow-sm mb-2 hover:border-primary/20 transition-colors">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <Select value={ded.type} onValueChange={(v) => onUpdateDeduction(idx, "type", v)}>
                          <SelectTrigger className="w-[190px] h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Item Fijo</SelectItem>
                            <SelectItem value="dynamic_essence">Esencia coincidente</SelectItem>
                            <SelectItem value="dynamic_label">Etiqueta coincidente</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <span className="text-xs uppercase font-medium text-muted-foreground mr-1 cursor-help">Cant</span>
                              </TooltipTrigger>
                              <TooltipContent>Unidades a descontar</TooltipContent>
                            </Tooltip>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <Input
                                  type="number"
                                  value={ded.quantity || ""}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    onUpdateDeduction(idx, "quantity", isNaN(val) ? 0 : val);
                                  }}
                                  className="w-16 h-9 text-center bg-background"
                                  min={0}
                                />
                              </TooltipTrigger>
                              <TooltipContent>Cantidad en la unidad de medida de su inventario (gr, ml, unidades)</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="icon" onClick={() => onRemoveDeduction(idx)} className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="w-full">
                        {ded.type === 'fixed' ? (
                          <InventorySelect
                            items={inventory}
                            value={ded.inventario_id}
                            onSelect={(v) => onUpdateDeduction(idx, "inventario_id", v)}
                          />
                        ) : (
                          <div className="flex items-center justify-start px-3 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-md h-9 w-full select-none italic">
                            <span className="opacity-70">(Se usará el {ded.type === 'dynamic_essence' ? 'nombre de la esencia' : 'nombre de la etiqueta'})</span>
                          </div>
                        )}
                      </div>

                      {ded.type !== 'fixed' && (
                        <div className="flex items-center gap-2 px-1">
                          <Info className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            Buscará en inventario: {ded.type === 'dynamic_essence' ? '"Esencia [Nombre]"' : '"Etiqueta [Nombre]"'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {rule.deductions.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Sin acciones</p>}
                </div>
              </div>

            </CardContent>
          </div>
        )
      }
    </Card >
  );
}

function InventorySelect({
  items,
  value,
  onSelect
}: {
  items: InventoryItem[];
  value?: string;
  onSelect: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal h-9 text-xs"
        >
          {selectedItem
            ? selectedItem.nombre
            : "Seleccionar item..."}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar item..." />
          <CommandList>
            <CommandEmpty>No encontrado.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.nombre} ${item.tipo} ${item.id}`} // hack to ensure unique value matching 
                  onSelect={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.nombre} <span className="ml-2 text-xs text-muted-foreground">({item.tipo})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
