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
        const lines = text.split("\n").map(l => l.trim().replace(/\s+/g, " "));
        const foundItems: ParsedItem[] = [];

        const headerKeywords = ["GRAMOS", "LISTA", "PRECIOS", "ACEITES", "FRAGANCIAS", "CODIGO", "DETALLE", "PÁGINA", "PAGE"];

        lines.forEach(line => {
            if (!line || line.length < 3) return;

            const upperLine = line.toUpperCase();
            if (headerKeywords.some(k => upperLine.includes(k))) return;
            if (/^\d+$/.test(line.replace(/\s/g, ""))) return; // Ignorar solo números

            // Regex ultra-robusto: busca bloques numéricos que parezcan precios (X.XX o X,XX)
            // Soporta: US$ 4.32, $4.32, 4.32, 4,32, 1.250,00
            const pricePattern = /(?:US\$|\$)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,3})?|\d+(?:[.,]\d{1,2})?)/g;
            const matches = [...line.matchAll(pricePattern)];

            // Filtramos las coincidencias que realmente parecen precios (tienen decimales o son números razonables)
            const validMatches = matches.filter(m => {
                const val = m[1].replace(/\./g, "").replace(/,/g, ".");
                const num = parseFloat(val);
                return !isNaN(num) && num > 0 && num < 100000; // Un precio razonable
            });

            if (validMatches.length > 0) {
                const firstMatch = validMatches[0];
                const priceIndex = line.indexOf(firstMatch[0]);

                let nombre = line.substring(0, priceIndex)
                    .replace(/[|¦!¡_:.#\-*]/g, "") // Limpiar basura
                    .trim();

                // Caso fallback: si el nombre es muy corto o vacío, intentamos buscar texto después de los precios o separarlo
                if (nombre.length < 2) {
                    const textWithoutPrices = line.replace(pricePattern, " ").trim();
                    if (textWithoutPrices.length > 2) {
                        nombre = textWithoutPrices;
                    }
                }

                if (nombre.length > 2 && !/^\d+$/.test(nombre.replace(/\s/g, ""))) {
                    const prices = validMatches.map(m => {
                        let val = m[1].replace(/\./g, "").replace(/,/g, ".");
                        const parts = val.split(".");
                        if (parts.length > 2) {
                            val = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
                        }
                        return parseFloat(val);
                    });

                    if (prices.length > 0) {
                        // En la mayoría de las listas de proveedores locales:
                        // Si hay varios precios, el último suele ser el de la unidad menor (100g)
                        // Si hay uno solo, es el de 100g.
                        const precio100g = prices.length > 1 ? prices[prices.length - 1] : prices[0];
                        const precio30g = prices.length > 1 ? prices[0] : null;

                        foundItems.push({
                            id: Math.random().toString(36).substr(2, 9),
                            nombre: nombre.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
                            precio_30g: precio30g === precio100g ? null : precio30g,
                            precio_100g: precio100g,
                            selected: true,
                            genero: upperLine.includes("FEM") || upperLine.includes("MUJER") ? "femenino" :
                                upperLine.includes("MASC") || upperLine.includes("HOMBRE") ? "masculino" : "masculino",
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

                    // Agrupamos por Y con un margen de 5px para manejar desajustes en el PDF
                    const linesGroupByY: Record<number, any[]> = {};
                    const yTolerance = 5;

                    textContent.items.forEach((item: any) => {
                        if (!item.str && item.str !== "") return;
                        const originalY = item.transform[5];

                        // Buscamos si ya existe una línea en este rango de Y
                        let foundY = Object.keys(linesGroupByY).find(y => Math.abs(Number(y) - originalY) < yTolerance);

                        if (foundY) {
                            linesGroupByY[Number(foundY)].push(item);
                        } else {
                            linesGroupByY[originalY] = [item];
                        }
                    });

                    const sortedY = Object.keys(linesGroupByY).map(Number).sort((a, b) => b - a);
                    sortedY.forEach(y => {
                        const lineItems = linesGroupByY[y].sort((a, b) => a.transform[4] - b.transform[4]);
                        const lineStr = lineItems.map(item => item.str).join(" ");
                        if (lineStr.trim().length > 0) {
                            fullText += lineStr + "\n";
                        }
                    });
                }

                const parsed = parseTextToItems(fullText);
                setItems(parsed);
                if (parsed.length === 0) toast.warning("No se encontraron esencias. Asegúrate de que el PDF tenga texto copiable.");
            }
            else if (file.type.startsWith("image/")) {
                const processedImageUrl = await preprocessImage(file);

                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => console.log(m.status === 'recognizing text' ? `Ocr: ${Math.round(m.progress * 100)}%` : m.status)
                });

                const { data } = await worker.recognize(processedImageUrl, {
                    // @ts-ignore
                    preserve_interword_spaces: '1',
                });
                await worker.terminate();

                const parsed = parseTextToItems(data.text);
                setItems(parsed);

                if (parsed.length === 0) {
                    toast.warning("No se detectaron datos en la imagen. Intenta con una captura más clara.");
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
            <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-none shadow-2xl">
                <DialogHeader className="p-8 pb-6 bg-primary/5 border-b shrink-0">
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="flex items-center gap-3 text-3xl font-black tracking-tight uppercase">
                            <div className="bg-primary text-primary-foreground p-2.5 rounded-2xl shadow-xl shadow-primary/20">
                                <FileUp className="w-7 h-7" />
                            </div>
                            Importador de Listas
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-lg ml-1">
                            Sube tu archivo y nosotros nos encargamos de extraer los datos por ti.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-8 pb-4 shrink-0 bg-background/50 backdrop-blur-sm z-10">
                        {/* Tabs Premium */}
                        <div className="flex gap-4 p-1.5 bg-muted/30 rounded-2xl mb-8 w-fit border border-primary/5">
                            <Button
                                variant={activeTab === 'file' ? 'default' : 'ghost'}
                                size="lg"
                                onClick={() => setActiveTab('file')}
                                className={`gap-3 rounded-xl px-8 font-bold transition-all ${activeTab === 'file' ? 'shadow-lg shadow-primary/30 scale-105' : 'text-muted-foreground'}`}
                            >
                                <Upload className="w-5 h-5" /> Subir Archivo
                            </Button>
                            <Button
                                variant={activeTab === 'url' ? 'default' : 'ghost'}
                                size="lg"
                                onClick={() => setActiveTab('url')}
                                className={`gap-3 rounded-xl px-8 font-bold transition-all ${activeTab === 'url' ? 'shadow-lg shadow-primary/30 scale-105' : 'text-muted-foreground'}`}
                            >
                                <Globe className="w-5 h-5" /> Desde Link
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-8 items-start mb-6">
                            {activeTab === 'file' ? (
                                <div
                                    className={`relative border-4 border-dashed rounded-[3rem] p-12 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px]
                                        ${dragActive ? 'border-primary bg-primary/10 shadow-2xl scale-[0.99]' : 'border-primary/10 hover:border-primary/40 hover:bg-primary/5'}
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
                                    <div className="bg-primary text-primary-foreground p-5 rounded-[2rem] mb-5 shadow-2xl ring-8 ring-primary/5">
                                        {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                                    </div>
                                    <h4 className="font-black text-2xl tracking-tight">
                                        {isProcessing ? 'Procesando...' : 'Haz click para subir'}
                                    </h4>
                                    <p className="text-muted-foreground mt-2 font-medium">PDF o Imágenes</p>
                                </div>
                            ) : (
                                <div className="flex gap-4 items-end bg-muted/20 p-8 rounded-[2.5rem] border border-primary/5 min-h-[220px]">
                                    <div className="grid flex-1 gap-3">
                                        <Label htmlFor="url" className="text-lg font-bold ml-2">Link del archivo</Label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/40" />
                                            <Input
                                                id="url"
                                                placeholder="https://ejemplo.com/lista.pdf"
                                                className="pl-12 h-14 rounded-2xl bg-background border-none shadow-sm text-lg font-medium"
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleUrlImport} disabled={!url || isProcessing} className="h-14 rounded-2xl px-8 font-black text-lg shadow-xl shadow-primary/20">
                                        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : 'TRAER'}
                                    </Button>
                                </div>
                            )}

                            {/* Panel de Proveedor - Limpio sin advertencia */}
                            <div className="bg-primary/5 p-8 rounded-[2.5rem] flex flex-col gap-4 border border-primary/5 min-h-[220px]">
                                <Label htmlFor="proveedor" className="text-lg font-black uppercase tracking-widest text-primary/60">Destino</Label>
                                <Select value={selectedProveedorId} onValueChange={setSelectedProveedorId}>
                                    <SelectTrigger id="proveedor" className="h-14 bg-background border-none rounded-2xl text-lg font-bold shadow-sm">
                                        <SelectValue placeholder="Elegir Proveedor" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        {proveedores.map((p) => (
                                            <SelectItem key={p.id} value={p.id} className="font-bold text-base py-3">
                                                {p.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="mt-auto flex items-center gap-3 text-primary/40 font-bold uppercase text-[10px] tracking-widest">
                                    <div className="h-[1px] flex-1 bg-primary/10"></div>
                                    Importación Directa
                                    <div className="h-[1px] flex-1 bg-primary/10"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col px-8">
                        {items.length > 0 && (
                            <div className="border rounded-[2.5rem] flex-1 flex flex-col overflow-hidden bg-muted/5 shadow-2xl mb-8 border-primary/5">
                                <div className="grid grid-cols-[80px_1fr_140px_140px_200px_80px] gap-4 p-6 bg-primary/10 border-b text-[11px] font-black uppercase tracking-[0.2em] text-primary/80">
                                    <div className="flex justify-center items-center">
                                        <Checkbox
                                            checked={items.every(i => i.selected)}
                                            onCheckedChange={(checked) => setItems(items.map(i => ({ ...i, selected: !!checked })))}
                                            className="w-6 h-6 rounded-lg border-2"
                                        />
                                    </div>
                                    <div className="flex items-center">Descripción de la Esencia</div>
                                    <div className="flex items-center justify-center">30 Gramos</div>
                                    <div className="flex items-center justify-center">100 Gramos</div>
                                    <div className="flex items-center">Familia / Género</div>
                                    <div className="text-center"></div>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="divide-y divide-primary/5">
                                        {items.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`grid grid-cols-[80px_1fr_140px_140px_200px_80px] gap-4 p-4 items-center transition-all duration-300 ${item.selected ? 'bg-background hover:bg-primary/[0.02]' : 'bg-muted/10 opacity-40'}`}
                                            >
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        checked={item.selected}
                                                        onCheckedChange={(checked) => updateItem(item.id, { selected: !!checked })}
                                                        className="w-6 h-6 rounded-lg border-2"
                                                    />
                                                </div>
                                                <Input
                                                    value={item.nombre}
                                                    onChange={(e) => updateItem(item.id, { nombre: e.target.value })}
                                                    className="h-12 text-base font-bold bg-transparent border-none focus-visible:ring-0 px-0"
                                                />
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-primary/30">$</span>
                                                    <Input
                                                        type="number"
                                                        value={item.precio_30g || ""}
                                                        onChange={(e) => updateItem(item.id, { precio_30g: parseFloat(e.target.value) || null })}
                                                        className="h-11 text-center pl-6 bg-muted/20 border-none rounded-xl font-bold"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-primary/30">$</span>
                                                    <Input
                                                        type="number"
                                                        value={item.precio_100g || ""}
                                                        onChange={(e) => updateItem(item.id, { precio_100g: parseFloat(e.target.value) || null })}
                                                        className="h-11 text-center pl-6 bg-primary/5 border-none rounded-xl font-black text-primary"
                                                    />
                                                </div>
                                                <Select
                                                    value={item.genero}
                                                    onValueChange={(val: any) => updateItem(item.id, { genero: val })}
                                                >
                                                    <SelectTrigger className="h-11 font-bold border-none bg-muted/20 rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                        <SelectItem value="masculino" className="font-bold">Masculino</SelectItem>
                                                        <SelectItem value="femenino" className="font-bold">Femenino</SelectItem>
                                                        <SelectItem value="ambiente" className="font-bold">Ambiente</SelectItem>
                                                        <SelectItem value="otro" className="font-bold">Otro (Unisex)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-2xl transition-all"
                                                    onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="p-6 bg-primary/5 border-t flex justify-between items-center shrink-0">
                                    <div className="flex gap-10">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-primary/40 uppercase font-black tracking-widest">Encontrados</span>
                                            <span className="text-2xl font-black">{items.length}</span>
                                        </div>
                                        <div className="flex flex-col border-l pl-10 border-primary/10">
                                            <span className="text-[10px] text-primary uppercase font-black tracking-widest">A Cargar</span>
                                            <span className="text-2xl font-black text-primary">{items.filter(i => i.selected).length}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all rounded-xl font-bold px-6"
                                        onClick={() => setItems([])}
                                    >
                                        Descartar Todo
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!items.length && !isProcessing && (
                            <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] p-12 bg-primary/[0.02] border-primary/10 transition-all mb-8">
                                <div className="bg-primary text-primary-foreground p-10 rounded-[2.5rem] mb-8 shadow-2xl animate-pulse ring-[12px] ring-primary/5">
                                    <FileText className="w-20 h-20" />
                                </div>
                                <h3 className="text-4xl font-black mb-4 tracking-tighter uppercase italic">Esperando Documento</h3>
                                <p className="text-muted-foreground text-center max-w-sm text-xl font-medium leading-relaxed">
                                    Sube una lista de precios en PDF o Imagen para empezar la extracción automática.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-8 gap-4 bg-background border-t shrink-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isImporting}
                        className="font-bold text-muted-foreground px-10 h-14 rounded-2xl text-lg hover:bg-muted"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || items.filter(i => i.selected).length === 0}
                        className="gap-4 px-14 h-14 rounded-2xl font-black text-xl bg-primary hover:scale-[1.03] active:scale-95 transition-all shadow-2xl shadow-primary/30"
                    >
                        {isImporting ? <Loader2 className="w-7 h-7 animate-spin" /> : <CheckCircle2 className="w-7 h-7" />}
                        {isImporting ? "IMPORTANDO..." : "FINALIZAR E IMPORTAR"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
