"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { getGlobalConfig, updateGlobalConfig } from "@/app/actions/config-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Save, Loader2, Info, X, Check, ChevronsUpDown, ChevronDown, ChevronRight, Edit2, Search, GripVertical, Settings } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RuleCard, type DeductionRule, type InventoryItem } from "@/components/rule-card";
import { FieldsConfigDialog } from "@/components/fields-config-dialog";
import { DEFAULT_FIELD_DEFINITIONS, FieldDefinition } from "@/app/types/rules";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";



import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const SortableRuleItem = ({ rule, ...props }: { rule: DeductionRule; } & any) => {
  const controls = useDragControls();
  return (
    <Reorder.Item value={rule} dragListener={false} dragControls={controls} className="mb-4 list-none">
      <RuleCard
        {...props}
        rule={rule}
        dragHandle={
          <div onPointerDown={(e) => controls.start(e)}>
            <GripVertical className="w-5 h-5 opacity-40 hover:opacity-100" />
          </div>
        }
      />
    </Reorder.Item>
  );
};

export default function CombosPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<DeductionRule[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [providers, setProviders] = useState<{ id: string, nombre: string; }[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [bottleTypes, setBottleTypes] = useState<string[]>([]);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFieldsConfig, setShowFieldsConfig] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);
  const [fieldDefinitions, setFieldDefinitions] = useState(DEFAULT_FIELD_DEFINITIONS);
  const filteredRules = rules.filter(rule => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      rule.name?.toLowerCase().includes(term) ||
      rule.conditions.some(c => String(c.value).toLowerCase().includes(term));

    return matchesSearch;
  });

  console.log("DEBUG: CombosPage fieldDefinitions:", fieldDefinitions);

  const handleSaveFields = async (newFields: FieldDefinition[]) => {
    setFieldDefinitions(newFields);
    setConfigVersion(v => v + 1);
    const res = await updateGlobalConfig("rules_fields_config", JSON.stringify(newFields));
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Campos actualizados correctamente");
    }
  };

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      // 1. Load data parallelly
      const [
        { data: inventoryData, error: invError },
        { data: providerData, error: provError },
        { data: categoryData, error: catError },
      ] = await Promise.all([
        supabase.from('inventario').select('id, nombre, tipo').order('nombre'),
        supabase.from('proveedores').select('id, nombre').order('nombre'),
        supabase.from('insumos_categorias').select('nombre').order('nombre') // Assuming distinct names or similar table
      ]);

      if (invError) throw invError;
      setInventory(inventoryData || []);

      if (providerData) setProviders(providerData);

      if (categoryData && categoryData.length > 0) {
        setCategories(categoryData.map(c => c.nombre));
        // Also extract genres if possible, or hardcode common ones
        setGenres(['Masculino', 'Femenino', 'Unisex', 'Ambiente', 'Otro']);
      } else {
        // Fallback
        console.error("Error loading categories:", catError);
        setCategories([]);
      }

      // Load inventory types from 'insumos'
      const { data: insumosData } = await supabase
        .from('insumos')
        .select('nombre')
        .order('nombre');

      if (insumosData) {
        // Filter items that look like containers based on common keywords
        const frascos = insumosData
          .map(t => t.nombre)
          .filter(n => /frasco|envase|botella|bid[oó]n|roll[- ]on/i.test(n));

        setBottleTypes(frascos);
      }

      // Load config
      const configStr = await getGlobalConfig("sales_deduction_rules");
      if (configStr) {
        try {
          setRules(JSON.parse(configStr));
        } catch (e) {
          console.error("Error parsing rules", e);
        }
      }

      // Load fields config
      const fieldsConfigStr = await getGlobalConfig("rules_fields_config");
      if (fieldsConfigStr) {
        try {
          setFieldDefinitions(JSON.parse(fieldsConfigStr));
        } catch (e) {
          console.error("Error parsing fields config", e);
        }
      }

    } catch (err) {
      console.error("Error loading combos config:", err);
      toast.error("Error cargando configuración. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await updateGlobalConfig("sales_deduction_rules", JSON.stringify(rules));
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Reglas guardadas correctamente");
    }
    setSaving(false);
  };

  const addRule = () => {
    setRules([
      ...rules,
      {
        id: generateId(),
        name: "Nueva Regla",
        conditions: [{ field: "genero", operator: "eq", value: "" }],
        deductions: []
      }
    ]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<DeductionRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addCondition = (ruleId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      return { ...r, conditions: [...r.conditions, { field: "genero", operator: "eq", value: "" }] };
    }));
  };

  const updateCondition = (ruleId: string, idx: number, field: string, value: any) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const newConditions = [...r.conditions];
      newConditions[idx] = { ...newConditions[idx], [field]: value };
      return { ...r, conditions: newConditions };
    }));
  };

  const removeCondition = (ruleId: string, idx: number) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      if (r.conditions.length <= 1) return r;
      const newConditions = [...r.conditions];
      newConditions.splice(idx, 1);
      return { ...r, conditions: newConditions };
    }));
  };

  const addDeduction = (ruleId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      return { ...r, deductions: [...r.deductions, { type: "fixed", quantity: 1 }] };
    }));
  };

  const updateDeduction = (ruleId: string, idx: number, field: string, value: any) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const newDeductions = [...r.deductions];
      newDeductions[idx] = { ...newDeductions[idx], [field]: value };
      return { ...r, deductions: newDeductions };
    }));
  };

  const removeDeduction = (ruleId: string, idx: number) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const newDeductions = [...r.deductions];
      newDeductions.splice(idx, 1);
      return { ...r, deductions: newDeductions };
    }));
  };

  const duplicateRule = (id: string) => {
    const original = rules.find(r => r.id === id);
    if (!original) return;

    setRules([
      ...rules,
      {
        ...original,
        id: generateId(),
        name: `${original.name} duplicado`,
      }
    ]);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
<<<<<<< HEAD
      <div className="flex flex-col items-center mb-8 gap-4">
        <div className="flex items-center justify-center gap-2 group">
          <h1 className="text-3xl font-bold text-center">Configuración de Combos</h1>
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" onClick={() => setShowFieldsConfig(true)} title="Configurar Campos" className="h-8 w-8 hover:bg-muted">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted">
=======
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Configuración de Combos</h1>
            <Button variant="ghost" size="icon" onClick={() => setShowFieldsConfig(true)} title="Configurar Campos">
              <Settings className="w-6 h-6 text-muted-foreground hover:text-foreground cursor-pointer" />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
>>>>>>> 691132e2d938874488506d3085094b5708e80dd0
                  <Info className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Cómo funcionan los combos?</DialogTitle>
                  <DialogDescription>
                    Esta herramienta te permite automatizar el descuento de insumos (frascos, esencias, etiquetas, etc.) cada vez que realizas una venta.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm pt-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Funcionamiento:</h4>
                    <p className="text-muted-foreground">
                      Cuando vendes un producto, el sistema busca reglas que coincidan con sus características (Nombre, Categoría, Género, Proveedor). Si encuentra una coincidencia, descuenta del inventario los ítems especificados en la regla.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Para tener en cuenta:</h4>
                    <ul className="list-disc list-inside space-y-4 text-muted-foreground">
                      <li>
                        <span>Si un producto coincide con varias reglas a la vez, se aplicarán los descuentos de todas ellas de forma inteligente (sin duplicar insumos).</span>
                        <span className="block pl-5 mt-1 text-xs italic">
                          Ejemplo: Si una regla descuenta &quot;1 Envase&quot; y otra &quot;1 Envase + 1 Moño&quot;, el sistema descontará solo 1 Envase y 1 Moño en total.
                        </span>
                      </li>
                      <li>
                        <span>Si un producto no coincide con ninguna regla, no se descontará nada del inventario.</span>
                        <span className="block pl-5 mt-1 text-xs italic">
                          El dinero de la venta ingresará a la Caja correctamente, solo que no se registrará consumo de stock.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
<<<<<<< HEAD
        <Button variant="outline" onClick={addRule} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva regla
        </Button>
=======
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRule}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva regla
          </Button>
        </div>
>>>>>>> 691132e2d938874488506d3085094b5708e80dd0
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o valor..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {rules.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Info className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay reglas definidas</h3>
              <p className="text-muted-foreground mb-4">Crea una regla para automatizar el descuento de stock.</p>
              <Button onClick={addRule}>Crear primera regla</Button>
            </CardContent>
          </Card>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-lg font-medium text-muted-foreground">No se encontraron reglas</h3>
            <p className="text-muted-foreground/50">Intenta con otros términos de búsqueda.</p>
          </div>
        ) : searchTerm ? (
          <div className="space-y-4">
            {filteredRules.map((rule) => (
              <RuleCard
                key={rule.id}
                fieldDefinitions={fieldDefinitions}
                rule={rule}
                inventory={inventory}
                providers={providers}
                genres={genres}
                categories={categories}
                bottleTypes={bottleTypes}
                isExpanded={expandedRuleId === rule.id}
                onToggle={() => setExpandedRuleId(prev => prev === rule.id ? null : rule.id)}
                onSave={handleSave}
                onDuplicate={() => duplicateRule(rule.id)}
                onDelete={() => removeRule(rule.id)}
                onUpdateName={(val) => updateRule(rule.id, { name: val })}
                onAddCondition={() => addCondition(rule.id)}
                onUpdateCondition={(idx, field, val) => updateCondition(rule.id, idx, field as any, val)}
                onRemoveCondition={(idx) => removeCondition(rule.id, idx)}
                onAddDeduction={() => addDeduction(rule.id)}
                onUpdateDeduction={(idx, field, val) => updateDeduction(rule.id, idx, field as any, val)}
                onRemoveDeduction={(idx) => removeDeduction(rule.id, idx)}
              />
            ))}
          </div>
        ) : (
          <Reorder.Group axis="y" values={rules} onReorder={setRules} className="space-y-0">
            {rules.map((rule) => (
              <SortableRuleItem
                key={`${rule.id}-${configVersion}`}
                fieldDefinitions={fieldDefinitions}
                rule={rule}
                inventory={inventory}
                providers={providers}
                genres={genres}
                categories={categories}
                bottleTypes={bottleTypes}
                isExpanded={expandedRuleId === rule.id}
                onToggle={() => setExpandedRuleId(prev => prev === rule.id ? null : rule.id)}
                onSave={handleSave}
                onDuplicate={() => duplicateRule(rule.id)}
                onDelete={() => removeRule(rule.id)}
                onUpdateName={(val: string) => updateRule(rule.id, { name: val })}
                onAddCondition={() => addCondition(rule.id)}
                onUpdateCondition={(idx: number, field: string, val: any) => updateCondition(rule.id, idx, field as any, val)}
                onRemoveCondition={(idx: number) => removeCondition(rule.id, idx)}
                onAddDeduction={() => addDeduction(rule.id)}
                onUpdateDeduction={(idx: number, field: string, val: any) => updateDeduction(rule.id, idx, field as any, val)}
                onRemoveDeduction={(idx: number) => removeDeduction(rule.id, idx)}
              />
            ))}
          </Reorder.Group>
        )}
      </div>


      <FieldsConfigDialog
        open={showFieldsConfig}
        onOpenChange={setShowFieldsConfig}
        currentFields={fieldDefinitions}
        onSave={handleSaveFields}
      />
    </div>
  );
}




