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

                    // Reescalado de alta calidad para OCR
                    const scale = 2.5;
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Solo escala de grises para no perder detalles de letras finas
                    ctx.filter = "grayscale(1) contrast(1.1)";
                    ctx.drawImage(canvas, 0, 0);

                    resolve(canvas.toDataURL("image/jpeg", 0.95));
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const parseTextToItems = (text: string) => {
        const lines = text.split("\n").map(l => l.trim());
        const foundItems: ParsedItem[] = [];

        // Palabras que delatan encabezados de tabla
        const headerKeywords = ["GRAMOS", "LISTA", "PRECIOS", "ACEITES", "FRAGANCIAS", "CODIGO", "DETALLE"];

        lines.forEach(line => {
            if (!line || line.length < 4) return;

            // Ignorar encabezados obvios o líneas que solo tienen números de página/gramos
            if (headerKeywords.some(k => line.toUpperCase().includes(k))) return;
            if (/^(100|250|500|1000|2000|3000|4000|5000)$/.test(line)) return;

            // Regex mejorado: busca precios con o sin símbolo, capturando decimales opcionales
            // Identifica patrones como: US$4.32, $4.32, 4.32, 10,50
            const pricePattern = /(?:US\$|\$)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2,3})?|\d+(?:[.,]\d{2,3})?)/g;
            const matches = [...line.matchAll(pricePattern)];

            if (matches.length > 0) {
                // El nombre suele ser todo lo que está antes del primer bloque numérico que parece un precio
                const firstMatch = matches[0];
                const priceIndex = line.indexOf(firstMatch[0]);

                let nombre = line.substring(0, priceIndex)
                    .replace(/[|¦!¡_:.#\-]/g, "") // Limpiar basura de OCR
                    .trim();

                // Si no hay nombre antes del precio, intentamos ver si el nombre está "pegado" al primer precio
                if (nombre.length < 2) {
                    const textParts = line.split(/\s+/);
                    if (textParts.length > 1) {
                        // El nombre suele estar al principio
                        nombre = textParts.slice(0, textParts.length - matches.length).join(" ");
                    }
                }

                // Validación final del nombre
                if (nombre.length > 2 && !/^\d+$/.test(nombre.replace(/\s/g, ""))) {
                    const prices = matches.map(m => {
                        let val = m[1].replace(/\./g, "").replace(/,/g, ".");
                        // Manejo de errores de Tesseract con puntos extra
                        const parts = val.split(".");
                        if (parts.length > 2) {
                            val = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
                        }
                        return parseFloat(val);
                    }).filter(p => !isNaN(p) && p > 0);

                    if (prices.length > 0) {
                        foundItems.push({
                            id: Math.random().toString(36).substr(2, 9),
                            nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase(),
                            precio_30g: null,
                            // Si detecta una fila de tabla de proveedor, el primer precio suele ser 100g
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
                // Usamos la versión de unpkg que suele ser más confiable
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

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
                if (parsed.length === 0) toast.warning("No se encontraron productos. Verifica el formato del PDF.");
            }
            else if (file.type.startsWith("image/")) {
                const processedImageUrl = await preprocessImage(file);

                // Usamos Tesseract con una configuración más lenta pero exacta
                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => console.log(m.status === 'recognizing text' ? `Analizando: ${Math.round(m.progress * 100)}%` : m.status)
                });

                const { data } = await worker.recognize(processedImageUrl, {
                    // @ts-ignore
                    preserve_interword_spaces: '1',
                });
                await worker.terminate();

                const parsed = parseTextToItems(data.text);
                setItems(parsed);

                if (parsed.length === 0) {
                    toast.warning("No se detectaron datos. Intenta con una captura más nítida o un PDF.");
                }
            }
            else {
                toast.error("Formato no soportado.");
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
            <DialogContent className="max-w-[90vw] w-[1200px] h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-none shadow-2xl">
                <DialogHeader className="p-8 pb-4 bg-primary/5">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                                <div className="bg-primary text-primary-foreground p-2 rounded-lg shadow-lg">
                                    <FileUp className="w-6 h-6" />
                                </div>
                                Importar Esencias de Proveedor
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground mt-2 text-base">
                                Extrae nombres y precios automáticamente desde documentos de proveedores (PDF o Imágenes).
                            </DialogDescription>
                        </div>
                    </div>
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
                                className={`relative border-4 border-dashed rounded-[2.5rem] p-16 transition-all flex flex-col items-center justify-center text-center cursor-pointer mb-6
                   ${dragActive ? 'border-primary bg-primary/10 scale-[0.98] shadow-2xl' : 'border-primary/20 hover:border-primary/50 hover:bg-primary/5'}
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
                                <div className="bg-primary text-primary-foreground p-6 rounded-3xl mb-6 shadow-2xl ring-8 ring-primary/10">
                                    {isProcessing ? <Loader2 className="w-10 h-10 animate-spin" /> : <Upload className="w-10 h-10" />}
                                </div>
                                <h4 className="font-black text-3xl tracking-tight">
                                    {isProcessing ? 'Analizando documento...' : 'Subir Lista de Precios'}
                                </h4>
                                <p className="text-muted-foreground mt-3 text-lg max-w-sm mx-auto">
                                    {isProcessing
                                        ? 'Estamos procesando el texto para identificar nombres y precios exactos.'
                                        : 'Arrastra tu PDF o imagen aquí para una extracción automática de alta precisión.'}
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
                        <div className="border rounded-2xl flex-1 flex flex-col overflow-hidden bg-muted/5 shadow-2xl mb-6">
                            <div className="grid grid-cols-[60px_1fr_120px_120px_180px_60px] gap-4 p-4 bg-primary/5 border-b text-xs font-bold uppercase tracking-widest text-primary/70">
                                <div className="flex justify-center items-center">
                                    <Checkbox
                                        checked={items.every(i => i.selected)}
                                        onCheckedChange={(checked) => setItems(items.map(i => ({ ...i, selected: !!checked })))}
                                        className="w-5 h-5"
                                    />
                                </div>
                                <div className="flex items-center">Nombre del Producto</div>
                                <div className="flex items-center justify-center">Precio (30g)</div>
                                <div className="flex items-center justify-center">Precio (100g)</div>
                                <div className="flex items-center">Género Sugerido</div>
                                <div className="text-center"></div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="divide-y divide-primary/5">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`grid grid-cols-[60px_1fr_120px_120px_180px_60px] gap-4 p-3 items-center transition-all ${item.selected ? 'bg-background' : 'bg-muted/10 opacity-60 grayscale'}`}
                                        >
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={item.selected}
                                                    onCheckedChange={(checked) => updateItem(item.id, { selected: !!checked })}
                                                    className="w-5 h-5 border-primary/20"
                                                />
                                            </div>
                                            <Input
                                                value={item.nombre}
                                                onChange={(e) => updateItem(item.id, { nombre: e.target.value })}
                                                className="h-10 text-sm font-medium bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                            />
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary/40">$</span>
                                                <Input
                                                    type="number"
                                                    value={item.precio_30g || ""}
                                                    onChange={(e) => updateItem(item.id, { precio_30g: parseFloat(e.target.value) || null })}
                                                    className="h-10 text-sm text-center pl-6 bg-muted/30 border-none rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20"
                                                />
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary/40">$</span>
                                                <Input
                                                    type="number"
                                                    value={item.precio_100g || ""}
                                                    onChange={(e) => updateItem(item.id, { precio_100g: parseFloat(e.target.value) || null })}
                                                    className="h-10 text-sm text-center pl-6 bg-muted/30 border-none rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20"
                                                />
                                            </div>
                                            <Select
                                                value={item.genero}
                                                onValueChange={(val: any) => updateItem(item.id, { genero: val })}
                                            >
                                                <SelectTrigger className="h-10 text-sm font-medium border-none bg-muted/30 rounded-lg">
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
                                                className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                                onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-4 bg-primary/5 border-t flex justify-between items-center">
                                <div className="flex gap-8 text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Identificados</span>
                                        <span className="text-lg font-black text-primary/60">{items.length}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Para Importar</span>
                                        <span className="text-lg font-black text-primary">{items.filter(i => i.selected).length}</span>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all rounded-lg"
                                    onClick={() => setItems([])}
                                >
                                    Limpiar Resultados
                                </Button>
                            </div>
                        </div>
                    )}

                    {!items.length && !isProcessing && (
                        <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed rounded-[2rem] p-12 bg-primary/5 transition-all mb-6">
                            <div className="bg-primary/10 p-8 rounded-3xl mb-6 text-primary animate-bounce shadow-xl">
                                <FileText className="w-16 h-16" />
                            </div>
                            <h3 className="text-3xl font-black mb-3 tracking-tight">Carga tu lista de precios</h3>
                            <p className="text-muted-foreground text-center max-w-md text-lg leading-relaxed">
                                Selecciona un archivo PDF o imagen. El sistema analizará celda por celda para extraer nombres y precios exactos.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-8 gap-4 bg-background border-t">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isImporting}
                        className="font-bold text-muted-foreground px-8 rounded-xl h-12"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || items.filter(i => i.selected).length === 0}
                        className="gap-3 px-12 h-12 rounded-xl font-black text-lg bg-primary hover:scale-[1.02] transition-transform shadow-2xl shadow-primary/30"
                    >
                        {isImporting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                        {isImporting ? "Procesando Importación..." : "Finalizar e Importar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
