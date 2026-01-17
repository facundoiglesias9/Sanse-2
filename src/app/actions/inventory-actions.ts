"use server";

import { createClient } from "@/utils/supabase/server";
import { getGlobalConfig } from "./config-actions";

export async function getPerfumesDetails(ids: string[]) {
  const supabase = await createClient();

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("esencias")
    .select(`
      id, 
      nombre, 
      genero,
      proveedor_id,
      insumos_categorias:insumos_categorias_id (nombre)
    `)
    .in("id", ids);

  if (error) {
    console.error("Error fetching perfumes (esencias) on server:", error);
    return [];
  }

  // Flatten structure to match expected output
  return (data || []).map((item: any) => ({
    id: item.id,
    nombre: item.nombre,
    genero: item.genero,
    proveedor_id: item.proveedor_id,
    categoria: item.insumos_categorias?.nombre || ""
  }));
}

type SaleItem = {
  perfumeName: string;
  gender: string;
  quantity: number;
  category?: string;
  provider?: string;
  bottleType?: string;
  returnedBottle?: boolean;
  [key: string]: any;
};

type DeductionRule = {
  id: string;
  name: string;
  conditions: {
    field: string;
    operator: "eq" | "contains";
    value: string;
  }[];
  deductions: {
    type: "fixed" | "dynamic_essence" | "dynamic_label";
    inventario_id?: string;
    quantity: number;
  }[];
};

export async function deductStockForSale(items: SaleItem[]) {
  const supabase = await createClient();

  // 1. Get Rules
  const configStr = await getGlobalConfig("sales_deduction_rules");
  if (!configStr) return { success: true, message: "No rules defined" };

  let rules: DeductionRule[] = [];
  try {
    rules = JSON.parse(configStr);
  } catch (e) {
    console.error("Error parsing rules", e);
    return { error: "Invalid rules configuration" };
  }

  if (rules.length === 0) return { success: true, message: "No active rules" };

  // 2. Calculate total deductions needed
  // Map: InventoryID -> Total Quantity to Deduct
  const deductionMap = new Map<string, number>();
  const logs: string[] = [];

  // Pre-fetch inventory for dynamic matching if needed
  // We'll fetch all essences and labels if we have dynamic rules
  // To optimize, we could fetch only relevant ones, but fetching all "Esencia" and "Etiqueta" types is probably fine for now.
  const hasDynamic = rules.some(r => r.deductions.some(d => d.type.startsWith("dynamic")));
  let dynamicInventory: any[] = [];

  if (hasDynamic) {
    const { data } = await supabase
      .from("inventario")
      .select("id, nombre, tipo, cantidad")
      .in("tipo", ["Esencia", "Etiqueta"]); // Adjust types as needed
    dynamicInventory = data || [];
  }

  for (const item of items) {
    const deductedIds = new Set<string>(); // Prevent duplicate deductions for the same item

    for (const rule of rules) {
      // Check conditions
      const match = rule.conditions.every(cond => {
        let itemValue: any = "";

        // Legacy mapping priority
        if (cond.field === "genero") itemValue = item.gender;
        else if (cond.field === "nombre") itemValue = item.perfumeName;
        else if (cond.field === "categoria") itemValue = item.category;
        else if (cond.field === "proveedor") itemValue = item.provider;
        else if (cond.field === "botella") itemValue = item.bottleType;
        else if (cond.field === "devolvio_envase") itemValue = item.returnedBottle ? "Si" : "No";
        else {
          // Dynamic access
          itemValue = item[cond.field];
        }

        const valString = String(itemValue || "").toLowerCase();
        const condVal = String(cond.value || "").toLowerCase();

        if (cond.operator === "eq") return valString === condVal;
        if (cond.operator === "contains") return valString.includes(condVal);
        return false;
      });

      if (match) {
        logs.push(`Rule "${rule.name}" matched for ${item.perfumeName}`);

        for (const ded of rule.deductions) {
          let targetId: string | null = null;
          let amount = ded.quantity * item.quantity;

          if (ded.type === "fixed" && ded.inventario_id) {
            targetId = ded.inventario_id;
          } else if (ded.type === "dynamic_essence") {
            // Find essence with similar name
            const found = dynamicInventory.find(i =>
              i.tipo === "Esencia" &&
              i.nombre.toLowerCase().includes(item.perfumeName.toLowerCase())
            );
            if (found) targetId = found.id;
            else logs.push(`Warning: Could not find Essence for ${item.perfumeName}`);
          } else if (ded.type === "dynamic_label") {
            // Find label with similar name
            const found = dynamicInventory.find(i =>
              i.tipo === "Etiqueta" &&
              i.nombre.toLowerCase().includes(item.perfumeName.toLowerCase())
            );
            if (found) targetId = found.id;
            else logs.push(`Warning: Could not find Label for ${item.perfumeName}`);
          }

          if (targetId) {
            if (deductedIds.has(targetId)) {
              logs.push(`Skipping deduction of ${targetId} (Already deducted by another rule for this item)`);
            } else {
              const current = deductionMap.get(targetId) || 0;
              deductionMap.set(targetId, current + amount);
              deductedIds.add(targetId);
            }
          }
        }
      }
    }
  }

  // 3. Apply Deductions using RPC or Loop?
  // Supabase doesn't have a bulk update with different values easily without RPC.
  // We will loop. It's not atomic but acceptable for this scale.
  // Check if we can find current stock to avoid negative? Or just decrement.
  // Better to fetch current stock again or rely on decrement.
  // If we use `rpc` to decrement safely it's better. But standard update is `stock - qty`.

  for (const [id, qty] of deductionMap.entries()) {
    // Fetch current to ensure atomic-ish update or use RPC if exists.
    // Simple approach: get, subtract, update.
    const { data: currentItem } = await supabase.from("inventario").select("cantidad, nombre").eq("id", id).single();
    if (currentItem) {
      const newQty = (currentItem.cantidad || 0) - qty;
      const { error } = await supabase
        .from("inventario")
        .update({ cantidad: newQty })
        .eq("id", id);

      if (error) {
        logs.push(`Error updating ${currentItem.nombre}: ${error.message}`);
        console.error(`Error updating stock for ${id}`, error);
      } else {
        logs.push(`Deducted ${qty} from ${currentItem.nombre}. New Stock: ${newQty}`);
      }
    }
  }

  return { success: true, logs };
}
