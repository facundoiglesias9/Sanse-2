"use client";

import React, { useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUp, Loader2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import * as pdfjsLib from "pdfjs-dist";

// Worker configuration for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ImportPDFDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    proveedores: { id: string; nombre: string }[];
}

interface ParsedItem {
    id: string;
    nombre: string;
    precio_30g: number | null;
    precio_100g: number | null;
    selected: boolean;
    genero: "masculino" | "femenino" | "ambiente" | "otro";
}

export function ImportPDFDialog({
    open,
    onOpenChange,
    onSuccess,
    proveedores,
}: ImportPDFDialogProps) {
    const [isParsing, setIsParsing] = useState(false);
    const [items, setItems] = useState<ParsedItem[]>([]);
    const [selectedProveedorId, setSelectedProveedorId] = useState<string>("");
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Por favor selecciona un archivo PDF");
            return;
        }

        setIsParsing(true);
        setItems([]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const allItems: ParsedItem[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Agrupar items por línea (Y coordinate)
                const lines: Record<number, any[]> = {};
                textContent.items.forEach((item: any) => {
                    const y = Math.round(item.transform[5]);
                    if (!lines[y]) lines[y] = [];
                    lines[y].push(item);
                });

                // Ordenar líneas de arriba hacia abajo
                const sortedY = Object.keys(lines)
                    .map(Number)
                    .sort((a, b) => b - a);

                sortedY.forEach((y) => {
                    const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
                    const lineText = lineItems.map((item) => item.str).join(" ").trim();

                    // Heurística simple para detectar una fila de productos
                    // Buscamos algo que empiece con letras (nombre) y termine con números/precios
                    // Ejemplo: "Avenue 3.600 10.500"

                    // Regex para detectar precios (números con o sin puntos/comas)
                    const priceRegex = /(\d+[\d.,]*)/g;
                    const matches = lineText.match(priceRegex);

                    if (matches && matches.length >= 1) {
                        // El nombre suele ser todo lo que está antes del primer precio
                        const firstPriceIndex = lineText.search(priceRegex);
                        const nombre = lineText.substring(0, firstPriceIndex).replace(/[:\-]/g, "").trim();

                        if (nombre.length > 3) {
                            const prices = matches.map(m => parseFloat(m.replace(/\./g, "").replace(/,/g, ".")));

                            // Asumimos que si hay 2 precios, son 30g y 100g
                            // Si hay 1, puede ser cualquiera, pongamos 30g por defecto
                            const p30 = prices[0] || null;
                            const p100 = prices[1] || null;

                            allItems.push({
                                id: Math.random().toString(36).substr(2, 9),
                                nombre: nombre,
                                precio_30g: p30,
                                precio_100g: p100,
                                selected: true,
                                genero: "masculino", // Default
                            });
                        }
                    }
                });
            }

            setItems(allItems);
            if (allItems.length === 0) {
                toast.warning("No se detectaron productos. Es posible que el PDF no sea de texto o el formato sea incompatible.");
            } else {
                toast.success(`Se detectaron ${allItems.length} posibles productos.`);
            }
        } catch (error) {
            console.error("Error parsing PDF:", error);
            toast.error("Error al procesar el PDF");
        } finally {
            setIsParsing(false);
        }
    };

    const handleImport = async () => {
        if (!selectedProveedorId) {
            toast.error("Selecciona un proveedor para las nuevas esencias");
            return;
        }

        const selectedItems = items.filter((i) => i.selected);
        if (selectedItems.length === 0) {
            toast.error("No hay productos seleccionados");
            return;
        }

        setIsImporting(true);
        try {
            // Obtener el ID del usuario actual
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No hay sesión activa");

            const insertData = selectedItems.map((it) => ({
                nombre: it.nombre,
                precio_ars_30g: it.precio_30g,
                precio_ars_100g: it.precio_100g,
                // Por defecto usamos 30g como precio_ars y 30 como cantidad_gramos si existe
                precio_ars: it.precio_30g || it.precio_100g,
                cantidad_gramos: it.precio_30g ? 30 : 100,
                proveedor_id: selectedProveedorId,
                genero: it.genero,
                created_by: session.user.id,
                // Podríamos querer asignar una categoría por defecto si existiera
                // insumos_categorias_id: '...'
            }));

            const { error } = await supabase.from("esencias").insert(insertData);

            if (error) throw error;

            toast.success(`Se importaron ${selectedItems.length} esencias correctamente`);
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            console.error("Error importing esencias:", error);
            toast.error("Error al importar: " + error.message);
        } finally {
            setIsImporting(false);
        }
    };

    const toggleSelectAll = (checked: boolean) => {
        setItems(items.map((i) => ({ ...i, selected: checked })));
    };

    const updateItem = (id: string, updates: Partial<ParsedItem>) => {
        setItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    };

    const removeItem = (id: string) => {
        setItems(items.filter((i) => i.id !== id));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp className="w-5 h-5 text-primary" />
                        Importar Esencias desde PDF
                    </DialogTitle>
                    <DialogDescription>
                        Carga el PDF del proveedor para extraer automáticamente los productos. Podrás editarlos antes de guardarlos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col px-6">
                    <div className="flex flex-col sm:flex-row items-end gap-4 mb-6">
                        <div className="grid w-full sm:max-w-sm items-center gap-1.5">
                            <Label htmlFor="pdf-file">Archivo PDF</Label>
                            <Input
                                id="pdf-file"
                                type="file"
                                accept="application/pdf"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                disabled={isParsing}
                                className="cursor-pointer"
                            />
                        </div>

                        <div className="grid w-full sm:max-w-xs items-center gap-1.5">
                            <Label htmlFor="proveedor">Proveedor destino</Label>
                            <Select value={selectedProveedorId} onValueChange={setSelectedProveedorId}>
                                <SelectTrigger id="proveedor">
                                    <SelectValue placeholder="Seleccionar proveedor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {proveedores.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isParsing && (
                            <div className="flex items-center gap-2 text-sm text-primary mb-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Procesando...
                            </div>
                        )}
                    </div>

                    {items.length > 0 && (
                        <div className="border rounded-md flex-1 flex flex-col overflow-hidden bg-muted/30">
                            <div className="grid grid-cols-[40px_1fr_100px_100px_120px_50px] gap-2 p-3 bg-muted border-b text-xs font-bold uppercase tracking-wider">
                                <div className="flex justify-center">
                                    <Checkbox
                                        checked={items.every(i => i.selected)}
                                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                    />
                                </div>
                                <div>Nombre</div>
                                <div>Precio 30g</div>
                                <div>Precio 100g</div>
                                <div>Género</div>
                                <div className="text-center">Elim</div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-0">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`grid grid-cols-[40px_1fr_100px_100px_120px_50px] gap-2 p-2 items-center border-b last:border-0 transition-colors ${item.selected ? 'bg-background' : 'bg-muted/50 opacity-60'}`}
                                        >
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={item.selected}
                                                    onCheckedChange={(checked) => updateItem(item.id, { selected: !!checked })}
                                                />
                                            </div>
                                            <Input
                                                value={item.nombre}
                                                onChange={(e) => updateItem(item.id, { nombre: e.target.value })}
                                                className="h-8 text-sm"
                                            />
                                            <Input
                                                type="number"
                                                value={item.precio_30g || ""}
                                                onChange={(e) => updateItem(item.id, { precio_30g: parseFloat(e.target.value) || null })}
                                                className="h-8 text-sm"
                                                placeholder="Sin precio"
                                            />
                                            <Input
                                                type="number"
                                                value={item.precio_100g || ""}
                                                onChange={(e) => updateItem(item.id, { precio_100g: parseFloat(e.target.value) || null })}
                                                className="h-8 text-sm"
                                                placeholder="Sin precio"
                                            />
                                            <Select
                                                value={item.genero}
                                                onValueChange={(val: any) => updateItem(item.id, { genero: val })}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="masculino">Masculino</SelectItem>
                                                    <SelectItem value="femenino">Femenino</SelectItem>
                                                    <SelectItem value="ambiente">Ambiente</SelectItem>
                                                    <SelectItem value="otro">Otro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                onClick={() => removeItem(item.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-3 bg-muted border-t flex justify-between items-center text-sm font-medium">
                                <span>Total detectados: {items.length}</span>
                                <span className="text-primary">Seleccionados: {items.filter(i => i.selected).length}</span>
                            </div>
                        </div>
                    )}

                    {!items.length && !isParsing && (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 bg-muted/20">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <FileUp className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No hay datos procesados</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm">
                                Sube un archivo PDF de tu proveedor para comenzar la extracción de datos.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || items.filter(i => i.selected).length === 0}
                        className="gap-2"
                    >
                        {isImporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        {isImporting ? "Importando..." : "Confirmar e Importar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
