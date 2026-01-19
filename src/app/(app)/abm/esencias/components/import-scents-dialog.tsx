"use client";

import React, { useState, useRef, useCallback } from "react";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FileUp,
    Loader2,
    Trash2,
    CheckCircle2,
    Link as LinkIcon,
    Image as ImageIcon,
    FileText,
    Upload,
    PlusCircle,
    Globe
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Worker configuration for PDF.js
const PDFJS_VERSION = "4.10.38";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

interface ImportScentsDialogProps {
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

export function ImportScentsDialog({
    open,
    onOpenChange,
    onSuccess,
    proveedores,
}: ImportScentsDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [items, setItems] = useState<ParsedItem[]>([]);
    const [selectedProveedorId, setSelectedProveedorId] = useState<string>("");
    const [isImporting, setIsImporting] = useState(false);
    const [url, setUrl] = useState("");
    const [activeTab, setActiveTab] = useState<"file" | "url">("file");
    const [dragActive, setDragActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const preprocessImage = async (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return resolve(e.target?.result as string);

                    canvas.width = img.width;
                    canvas.height = img.height;

                    // Filtros básicos para mejorar OCR
                    ctx.filter = "contrast(1.5) brightness(1.1) grayscale(1)";
                    ctx.drawImage(img, 0, 0);

                    resolve(canvas.toDataURL("image/jpeg", 0.9));
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const parseTextToItems = (text: string) => {
        // Limpieza agresiva de caracteres raros que mete el OCR
        const lines = text.split("\n").map(l => l.replace(/[|¦!¡]/g, "").trim());
        const foundItems: ParsedItem[] = [];

        lines.forEach(line => {
            if (!line || line.length < 3) return;

            // Regex para detectar precios (soporta US$, $, números con decimales)
            // Buscamos patrones como: 4.32, 10,50, $4.32, US$4.32
            const priceRegex = /(?:US\$|\$)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/g;
            const matches = [...line.matchAll(priceRegex)];

            if (matches.length >= 1) {
                // El nombre es lo que está antes del primer precio
                const firstMatchIndex = line.search(priceRegex);
                if (firstMatchIndex === -1) return;

                const nombre = line.substring(0, firstMatchIndex)
                    .replace(/[_]/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

                if (nombre.length > 2) {
                    const prices = matches.map(m => {
                        let val = m[1].replace(/\./g, "").replace(/,/g, ".");
                        // Si tiene más de un punto (ej: 4.32.00 por error), nos quedamos con el último como decimal
                        const parts = val.split(".");
                        if (parts.length > 2) {
                            const decimals = parts.pop();
                            val = parts.join("") + "." + decimals;
                        }
                        return parseFloat(val);
                    }).filter(p => !isNaN(p) && p > 0);

                    if (prices.length > 0) {
                        foundItems.push({
                            id: Math.random().toString(36).substr(2, 9),
                            nombre: nombre,
                            // En tablas de proveedores (como la de la imagen), 
                            // el primer precio suele ser 100g si no es 30g.
                            // Mapeamos inteligentemente: si el nombre es corto o parece cabecera, ignoramos.
                            precio_30g: null,
                            precio_100g: prices[0],
                            selected: true,
                            genero: "masculino",
                        });
                    }
                }
            }
        });

        return foundItems;
    };

    const processFile = async (file: File) => {
        setIsProcessing(true);
        setItems([]);

        try {
            if (file.type === "application/pdf") {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({
                    data: arrayBuffer,
                    useSystemFonts: true,
                    disableFontFace: false
                });

                const pdf = await loadingTask.promise;
                let fullText = "";

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();

                    const lines: Record<number, any[]> = {};
                    textContent.items.forEach((item: any) => {
                        if (!item.str && item.str !== "") return;
                        // PDF.js a veces separa letras, intentamos agrupar por Y y X
                        const y = Math.round(item.transform[5]);
                        if (!lines[y]) lines[y] = [];
                        lines[y].push(item);
                    });

                    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
                    sortedY.forEach(y => {
                        const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
                        fullText += lineItems.map(item => item.str).join(" ") + "\n";
                    });
                }

                const parsed = parseTextToItems(fullText);
                setItems(parsed);
            }
            else if (file.type.startsWith("image/")) {
                const processedImageUrl = await preprocessImage(file);

                // Usamos Tesseract con reconocimiento de líneas
                const { data } = await Tesseract.recognize(processedImageUrl, 'spa', {
                    logger: m => console.log(m.status, Math.round(m.progress * 100) + "%")
                });

                // Intentamos reconstruir la tabla basándonos en la estructura de bloques/líneas
                const parsed = parseTextToItems(data.text);
                setItems(parsed);

                if (parsed.length === 0) {
                    toast.warning("No se detectaron datos. Intenta con una imagen más nítida o PDF.");
                }
            }
            else {
                toast.error("Formato no soportado. Usa PDF o imágenes.");
            }
        } catch (error: any) {
            console.error("Error processing file:", error);
            toast.error(`Error al procesar: ${error.message || "Error desconocido"}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleUrlImport = async () => {
        if (!url.trim()) return;

        setIsProcessing(true);
        try {
            // Intentar descargar el contenido del link
            const response = await fetch(url);
            if (!response.ok) throw new Error("No se pudo acceder a la URL");

            const contentType = response.headers.get("content-type");
            const blob = await response.blob();
            const file = new File([blob], "downloaded_file", { type: contentType || "" });

            await processFile(file);
        } catch (error: any) {
            console.error("URL Import Error:", error);
            toast.error("Error al importar desde URL. Puede deberse a restricciones de seguridad (CORS) del sitio origen.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No hay sesión activa");

            const insertData = selectedItems.map((it) => ({
                nombre: it.nombre,
                precio_ars_30g: it.precio_30g,
                precio_ars_100g: it.precio_100g,
                precio_ars: it.precio_30g || it.precio_100g,
                cantidad_gramos: it.precio_30g ? 30 : 100,
                proveedor_id: selectedProveedorId,
                genero: it.genero,
                created_by: session.user.id,
            }));

            const { error } = await supabase.from("esencias").insert(insertData);
            if (error) throw error;

            toast.success(`Se importaron ${selectedItems.length} esencias correctamente`);
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            toast.error("Error al importar: " + error.message);
        } finally {
            setIsImporting(false);
        }
    };

    const updateItem = (id: string, updates: Partial<ParsedItem>) => {
        setItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden bg-background">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                        <FileUp className="w-6 h-6 text-primary" />
                        Importar Esencias
                    </DialogTitle>
                    <DialogDescription className="text-base">
                        Carga un PDF, una imagen o un link para extraer productos automáticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col px-6">
                    {/* Tabs Simplificadas */}
                    <div className="flex gap-2 mb-4 border-b pb-2">
                        <Button
                            variant={activeTab === 'file' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('file')}
                            className="gap-2"
                        >
                            <Upload className="w-4 h-4" /> Archivo / Imagen
                        </Button>
                        <Button
                            variant={activeTab === 'url' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('url')}
                            className="gap-2"
                        >
                            <Globe className="w-4 h-4" /> Desde Link
                        </Button>
                    </div>

                    <div className="flex flex-col gap-4 mb-6">
                        {activeTab === 'file' ? (
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer
                  ${dragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'}
                `}
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="application/pdf,image/*"
                                    className="hidden"
                                />
                                <div className="bg-primary/10 p-4 rounded-full mb-3 text-primary">
                                    {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <PlusCircle className="w-8 h-8" />}
                                </div>
                                <h4 className="font-semibold text-lg">
                                    {isProcessing ? 'Procesando contenido...' : 'Haz clic o arrastra un archivo'}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Soporta PDF, JPG, PNG y capturas de pantalla
                                </p>
                            </div>
                        ) : (
                            <div className="flex gap-2 items-end">
                                <div className="grid flex-1 gap-1.5">
                                    <Label htmlFor="url">Link directo al archivo (PDF o Imagen)</Label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="url"
                                            placeholder="https://ejemplo.com/lista.pdf"
                                            className="pl-10"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleUrlImport} disabled={!url || isProcessing}>
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Traer'}
                                </Button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="grid gap-1.5">
                                <Label htmlFor="proveedor">Asignar a Proveedor</Label>
                                <Select value={selectedProveedorId} onValueChange={setSelectedProveedorId}>
                                    <SelectTrigger id="proveedor" className="bg-muted/50 border-none shadow-none font-medium">
                                        <SelectValue placeholder="Seleccionar proveedor destino" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {proveedores.map((p) => (
                                            <SelectItem key={p.id} value={p.id} className="font-medium">
                                                {p.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg border italic">
                                Asegúrate de revisar bien los datos. El sistema intenta extraer nombres y precios, pero no es infalible.
                            </div>
                        </div>
                    </div>

                    {items.length > 0 && (
                        <div className="border rounded-xl flex-1 flex flex-col overflow-hidden bg-muted/20 shadow-inner">
                            <div className="grid grid-cols-[40px_1fr_100px_100px_130px_50px] gap-2 p-3 bg-card border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                <div className="flex justify-center">
                                    <Checkbox
                                        checked={items.every(i => i.selected)}
                                        onCheckedChange={(checked) => setItems(items.map(i => ({ ...i, selected: !!checked })))}
                                    />
                                </div>
                                <div>Producto</div>
                                <div>Precio (30g)</div>
                                <div>Precio (100g)</div>
                                <div>Género</div>
                                <div className="text-center"></div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-0">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`grid grid-cols-[40px_1fr_100px_100px_130px_50px] gap-2 p-2 items-center border-b last:border-0 transition-colors ${item.selected ? 'bg-background hover:bg-primary/[0.02]' : 'bg-muted/30 opacity-40'}`}
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
                                                className="h-8 text-sm bg-transparent border-none focus-visible:ring-1"
                                            />
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                                                <Input
                                                    type="number"
                                                    value={item.precio_30g || ""}
                                                    onChange={(e) => updateItem(item.id, { precio_30g: parseFloat(e.target.value) || null })}
                                                    className="h-8 text-sm pl-4 pr-1 bg-transparent border-none focus-visible:ring-1"
                                                />
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                                                <Input
                                                    type="number"
                                                    value={item.precio_100g || ""}
                                                    onChange={(e) => updateItem(item.id, { precio_100g: parseFloat(e.target.value) || null })}
                                                    className="h-8 text-sm pl-4 pr-1 bg-transparent border-none focus-visible:ring-1"
                                                />
                                            </div>
                                            <Select
                                                value={item.genero}
                                                onValueChange={(val: any) => updateItem(item.id, { genero: val })}
                                            >
                                                <SelectTrigger className="h-8 text-xs border-none bg-muted/50">
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
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-3 bg-card border-t flex justify-between items-center text-xs font-semibold text-muted-foreground">
                                <div className="flex gap-4">
                                    <span>Encontrados: <strong>{items.length}</strong></span>
                                    <span className="text-primary font-bold">Seleccionados: <strong>{items.filter(i => i.selected).length}</strong></span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px] uppercase font-bold text-destructive hover:bg-destructive/10"
                                    onClick={() => setItems([])}
                                >
                                    Limpiar Todo
                                </Button>
                            </div>
                        </div>
                    )}

                    {!items.length && !isProcessing && (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 bg-muted/10 transition-colors">
                            <div className="bg-primary/10 p-6 rounded-full mb-4 text-primary animate-pulse">
                                <FileText className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Esperando datos...</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm">
                                Sube un PDF, una captura de pantalla de la lista de precios o pega un link para empezar.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 gap-3 bg-card mt-auto border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isImporting} className="font-semibold">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || items.filter(i => i.selected).length === 0}
                        className="gap-2 px-8 font-bold shadow-lg shadow-primary/20"
                    >
                        {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                        {isImporting ? "Importando a la base..." : "Importar Seleccionados"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
