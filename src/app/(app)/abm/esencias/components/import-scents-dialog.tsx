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
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Worker configuration for PDF.js
const PDFJS_VERSION = "4.10.38";
// Configuración global movida dentro de la función para mayor robustez

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
    isSmartMatched?: boolean;
    alreadyExists?: boolean;
    needsUpdate?: boolean;
    existingPrice?: number | null;
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
    const [existingEsencias, setExistingEsencias] = useState<any[]>([]);
    const [detectedCurrency, setDetectedCurrency] = useState<'USD' | 'ARS'>('ARS');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const { currencies } = useCurrencies();
    const arsRate = currencies["ARS"] || 1;

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

    // Cargar esencias existentes para validación
    React.useEffect(() => {
        if (open) {
            const fetchExisting = async () => {
                const { data } = await supabase.from("esencias").select("nombre, precio_usd, precio_ars_100g");
                if (data) {
                    setExistingEsencias(data);
                }
            };
            fetchExisting();
        }
    }, [open, supabase]);

    // Función de normalización para Fuzzy Match
    const normalizeName = (name: string) => {
        return name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
            .replace(/[|¦!¡_:.#\-*]/g, "")
            .replace(/\s+/g, "")
            .trim();
    };

    const parseTextToItems = (text: string) => {
        // Normalizar texto para evitar problemas con espacios de OCR
        const lines = text.split("\n").map(l => l.trim().replace(/\s+/g, " "));
        const foundItems: ParsedItem[] = [];

        console.log("Analizando texto extraído (primeras 5 líneas):", lines.slice(0, 5));

        // --- DETECCIÓN DINÁMICA DE COLUMNAS (MEJORADA) ---
        let index30 = -1;
        let index100 = 0; // Por defecto el primer precio es 100g

        // Buscamos la línea que contiene los encabezados de peso
        const headerLine = lines.find(l => {
            const up = l.toUpperCase();
            return up.includes("GRAMOS") || up.includes("GRS") || (up.includes("100") && up.includes("250"));
        });

        if (headerLine) {
            const upHeader = headerLine.toUpperCase();
            // Solo buscamos números aislados que representen pesos
            const weights = [...upHeader.matchAll(/\b(30|100|250|500|1000)\b/g)]
                .map(m => ({ val: m[1], pos: m.index }));

            // Ordenamos por posición en la línea
            weights.sort((a, b) => a.pos - b.pos);

            weights.forEach((w, idx) => {
                if (w.val === "30") index30 = idx;
                if (w.val === "100") index100 = idx;
            });

            console.log("Encabezado detectado en línea:", headerLine);
        } else {
            console.log("No se detectó línea de encabezado de pesos. Usando default.");
        }

        // --- DETECCIÓN DE MONEDA ---
        const textUp = text.toUpperCase();
        const hasUSDSymbol = textUp.includes("US$") || textUp.includes("U$S") || textUp.includes("USD");
        const currentCurrency = hasUSDSymbol ? 'USD' : 'ARS';
        setDetectedCurrency(currentCurrency);
        console.log(`Moneda detectada: ${currentCurrency}`);

        const headerKeywords = ["GRAMOS", "LISTA", "PRECIOS", "ACEITES", "FRAGANCIAS", "CODIGO", "DETALLE", "PÁGINA", "PAGE", "PROVEEDOR"];

        const MASCULINO_KEYWORDS = ["MASC", "HOMBRE", "MAN", "MEN", "MALE", "HOMME", "HIM", "BOY", "KING", "PRINCE", "POUR HOMME", "INVICTUS", "SAUVAGE", "POLO", "AVENTUS", "BAD BOY", "CH MEN", "FANTASY MASC", "212 VIP"];
        const FEMENINO_KEYWORDS = ["FEM", "MUJER", "WOMAN", "WOMEN", "FEMALE", "FEMME", "HER", "GIRL", "QUEEN", "PRINCESS", "LADY", "POUR FEMME", "LA VIE EST BELLE", "GOOD GIRL", "OLYMPEA", "IDOLE", "CHANEL", "MISS DIOR", "FANTASY FEM", "SCANDAL"];
        const AMBIENTE_KEYWORDS = ["AMBIENTE", "TEXTIL", "HOME", "SCENT", "DIFFUSER", "SPRAY", "ROOM", "SPA", "VARILLAS", "DIFUSOR", "AUTO", "CAR", "AROMATIZANTE"];

        lines.forEach(line => {
            if (!line || line.length < 5) return;

            const upperLine = line.toUpperCase();
            if (headerKeywords.some(k => upperLine.includes(k))) return;

            // Regex de precios más permisiva para errores de OCR ($ o S o 5 a veces)
            const pricePattern = /(?:US\$|\$|S\/|5)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,3})?|\d+(?:[.,]\d{1,2})?)/g;
            const matches = [...line.matchAll(pricePattern)];

            const validMatches = matches.filter(m => {
                let val = m[1];
                // Si tiene una coma y un punto, o múltiples puntos, es un formato de miles.
                // Si solo tiene un punto/coma y 2 decimales, es un decimal.
                if (val.includes(",") && val.includes(".")) {
                    val = val.replace(/\./g, "").replace(",", ".");
                } else if (val.includes(",") && val.split(",")[1].length <= 2) {
                    val = val.replace(",", ".");
                }

                const num = parseFloat(val);
                return !isNaN(num) && num > 0 && num < 100000 && num !== 2024 && num !== 2025;
            });

            if (validMatches.length > 0) {
                const firstMatch = validMatches[0];
                const priceIndex = line.indexOf(firstMatch[0]);

                let nombre = line.substring(0, priceIndex)
                    .replace(/[|¦!¡_:.#\-*]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                // Fallback: si el nombre es corto, buscamos lo que no sea precio
                if (nombre.length < 3) {
                    const textWithoutPrices = line.replace(pricePattern, "").replace(/[|¦!¡_:.#\-*]/g, " ").trim();
                    if (textWithoutPrices.length > 3) nombre = textWithoutPrices;
                }

                if (nombre.length > 3 && !/^\d+$/.test(nombre.replace(/\s/g, ""))) {
                    const prices = validMatches.map(m => {
                        let val = m[1];
                        if (val.includes(",") && val.includes(".")) {
                            val = val.replace(/\./g, "").replace(",", ".");
                        } else if (val.includes(",") && val.split(",")[1].length <= 2) {
                            val = val.replace(",", ".");
                        } else if (val.includes(".") && val.split(".")[1].length > 2 && !val.includes(",")) {
                            val = val.replace(/\./g, "");
                        }
                        return parseFloat(val);
                    });

                    if (prices.length > 0) {
                        // Mapeo inteligente basado en la detección de cabeceras
                        const precio100g = prices[index100] !== undefined ? prices[index100] : prices[0];
                        const precio30g = index30 !== -1 && prices[index30] !== undefined ? prices[index30] : null;

                        let genero: "masculino" | "femenino" | "ambiente" | "otro" = "otro";
                        let isSmartMatched = false;

                        if (AMBIENTE_KEYWORDS.some(k => upperLine.includes(k))) {
                            genero = "ambiente";
                            isSmartMatched = true;
                        } else if (FEMENINO_KEYWORDS.some(k => upperLine.includes(k))) {
                            genero = "femenino";
                            isSmartMatched = true;
                        } else if (MASCULINO_KEYWORDS.some(k => upperLine.includes(k))) {
                            genero = "masculino";
                            isSmartMatched = true;
                        }

                        const normNombre = normalizeName(nombre);
                        const existing = existingEsencias.find(e => normalizeName(e.nombre) === normNombre);

                        const isUSD = currentCurrency === 'USD';
                        // PRECIO ACTUAL: Si existe en su moneda, lo usamos. Si no, lo convertimos para poder comparar.
                        let dbPriceInCurrentCurrency = null;
                        if (existing) {
                            if (isUSD) {
                                dbPriceInCurrentCurrency = existing.precio_usd || (existing.precio_ars_100g ? existing.precio_ars_100g / arsRate : null);
                            } else {
                                dbPriceInCurrentCurrency = existing.precio_ars_100g || (existing.precio_usd ? existing.precio_usd * arsRate : null);
                            }
                        }

                        // Solo marcar para actualizar si el precio es DIFERENTE y no nulo
                        const needsUpdate = existing && dbPriceInCurrentCurrency !== null && Math.abs((dbPriceInCurrentCurrency || 0) - (precio100g || 0)) > 0.05;
                        const alreadyExists = !!existing;

                        foundItems.push({
                            id: Math.random().toString(36).substr(2, 9),
                            nombre: nombre.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
                            precio_30g: precio30g,
                            precio_100g: precio100g,
                            selected: !alreadyExists || needsUpdate,
                            genero,
                            isSmartMatched,
                            alreadyExists,
                            needsUpdate,
                            existingPrice: dbPriceInCurrentCurrency
                        });
                    }
                }
            }
        });

        console.log(`Extracción finalizada: ${foundItems.length} ítems encontrados.`);
        return foundItems;
    };

    const processFile = async (file: File) => {
        setIsProcessing(true);
        setItems([]);

        try {
            if (file.type === "application/pdf") {
                const arrayBuffer = await file.arrayBuffer();
                // Usamos unpkg que suele ser más compatible con Next.js que cdnjs para workers
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

                    const linesGroupByY: Record<number, any[]> = {};
                    const yTolerance = 5;

                    textContent.items.forEach((item: any) => {
                        if (!item.str && item.str !== "") return;
                        const originalY = item.transform[5];
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
                        if (lineStr.trim().length > 0) fullText += lineStr + "\n";
                    });
                }

                const parsed = parseTextToItems(fullText);
                setItems(parsed);
                if (parsed.length === 0) toast.warning("No se detectaron esencias. Verifica que el PDF tenga texto copiable.");
            }
            else if (file.type.startsWith("image/")) {
                const processedImageUrl = await preprocessImage(file);

                // Configuración más robusta para Tesseract
                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => console.log(m.status === 'recognizing text' ? `OCR: ${Math.round(m.progress * 100)}%` : m.status)
                });

                const { data } = await worker.recognize(processedImageUrl);
                await worker.terminate();

                const parsed = parseTextToItems(data.text);
                setItems(parsed);

                if (parsed.length === 0) {
                    toast.warning("No se detectaron datos claros. Intenta con una captura más nítida o PDF.");
                }
            }
            else {
                toast.error("Formato no soportado.");
            }
        } catch (error: any) {
            console.error("Error al procesar:", error);
            const msg = error.message || "Error desconocido";
            toast.error(`Error al procesar: ${msg.includes("Worker") ? "Error de libreria (PDF Worker)" : msg}`);
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
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], "file", { type: blob.type });
            await processFile(file);
        } catch (error) {
            toast.error("Error en link");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

    const handleImport = async () => {
        if (!selectedProveedorId) return toast.error("Selecciona un proveedor");
        const selectedItems = items.filter(i => i.selected);
        if (selectedItems.length === 0) return toast.error("Nada seleccionado");

        setIsImporting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const insertData = selectedItems.filter(it => !it.alreadyExists).map(it => {
                const isUSD = detectedCurrency === 'USD';
                const finalPriceArs = isUSD && it.precio_100g ? (it.precio_100g * arsRate) : it.precio_100g;

                return {
                    nombre: it.nombre,
                    precio_usd: isUSD ? it.precio_100g : null,
                    precio_ars_100g: finalPriceArs,
                    precio_ars_30g: it.precio_30g,
                    precio_ars: finalPriceArs,
                    cantidad_gramos: 100,
                    proveedor_id: selectedProveedorId,
                    genero: it.genero,
                    created_by: session?.user.id,
                    is_consultar: false
                };
            });

            // Lógica de Actualización para los que ya existen
            const updateItems = selectedItems.filter(it => it.alreadyExists && it.needsUpdate);
            for (const it of updateItems) {
                const isUSD = detectedCurrency === 'USD';
                const finalPriceArs = isUSD && it.precio_100g ? (it.precio_100g * arsRate) : it.precio_100g;

                // Buscamos el nombre real en la DB para el update exacto
                const dbEntry = existingEsencias.find(e => normalizeName(e.nombre) === normalizeName(it.nombre));
                if (dbEntry) {
                    await supabase.from("esencias")
                        .update({
                            precio_usd: isUSD ? it.precio_100g : dbEntry.precio_usd,
                            precio_ars_100g: finalPriceArs,
                            precio_ars: finalPriceArs,
                            precio_ars_30g: it.precio_30g
                        })
                        .eq("nombre", dbEntry.nombre);
                }
            }

            if (insertData.length > 0) {
                const { error } = await supabase.from("esencias").insert(insertData);
                if (error) throw error;
            }
            toast.success("Importado!");
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsImporting(false);
        }
    };

    const updateItem = (id: string, updates: Partial<ParsedItem>) => {
        setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] w-[95vw] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border shadow-2xl rounded-xl">
                <DialogHeader className="px-5 py-4 border-b bg-muted/10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-primary/10 text-primary p-1.5 rounded-lg">
                                <FileUp className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold tracking-tight">Importación Inteligente</DialogTitle>
                                <DialogDescription className="text-[11px] leading-none">PDF • Imagen • URL</DialogDescription>
                            </div>
                        </div>
                        {isProcessing && (
                            <div className="flex items-center gap-2 text-primary animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Analizando...</span>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
                    <div className="p-5 flex flex-col gap-5 flex-1 min-h-0">
                        {/* Seccion superior fija */}
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 shrink-0">
                            <div className="space-y-3">
                                <div className="flex gap-1.5 p-1 bg-muted/50 rounded-lg w-fit">
                                    <Button size="sm" variant={activeTab === 'file' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('file')} className="text-[10px] font-bold uppercase px-3 h-7">Archivo</Button>
                                    <Button size="sm" variant={activeTab === 'url' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('url')} className="text-[10px] font-bold uppercase px-3 h-7">Desde Link</Button>
                                </div>

                                {activeTab === 'file' ? (
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-5 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[100px] ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/40'}`}
                                        onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,image/*" className="hidden" />
                                        <Upload className="w-5 h-5 text-muted-foreground/50 mb-1" />
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{isProcessing ? 'Procesando...' : 'Cargar Lista'}</p>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">URL del Documento</Label>
                                            <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 text-xs" />
                                        </div>
                                        <Button size="sm" onClick={handleUrlImport} disabled={!url || isProcessing} className="h-9 px-4 font-bold text-xs">TRAER</Button>
                                    </div>
                                )}
                            </div>

                            <div className="bg-muted/30 p-4 rounded-xl border border-muted-foreground/5 flex flex-col gap-2">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor Destino</Label>
                                    {items.length > 0 && (
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant={detectedCurrency === 'ARS' ? 'default' : 'outline'}
                                                onClick={() => setDetectedCurrency('ARS')}
                                                className="h-5 text-[8px] font-bold px-1.5"
                                            >ARS</Button>
                                            <Button
                                                size="sm"
                                                variant={detectedCurrency === 'USD' ? 'default' : 'outline'}
                                                onClick={() => setDetectedCurrency('USD')}
                                                className="h-5 text-[8px] font-bold px-1.5"
                                            >USD</Button>
                                        </div>
                                    )}
                                </div>
                                <Select value={selectedProveedorId} onValueChange={setSelectedProveedorId}>
                                    <SelectTrigger className="bg-background border-none shadow-sm font-bold text-xs h-9">
                                        <SelectValue placeholder="Elegir..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {proveedores.map(p => <SelectItem key={p.id} value={p.id} className="text-xs font-semibold">{p.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <div className="mt-auto flex items-center justify-between opacity-30 grayscale pt-2 border-t border-muted-foreground/10">
                                    <span className="text-[9px] font-black uppercase tracking-widest">AI Extraction</span>
                                    <CheckCircle2 className="w-3 h-3" />
                                </div>
                            </div>
                        </div>

                        {/* Contenedor de tabla flexible con scroll interno propio */}
                        <div className="flex-1 flex flex-col border rounded-xl bg-muted/5 overflow-hidden shadow-sm min-h-0">
                            {items.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-[40px_1fr_80px_80px_130px_40px] gap-2 p-2.5 bg-muted/40 border-b text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground items-center shrink-0">
                                        <div className="flex justify-center"><Checkbox checked={items.length > 0 && items.every(i => i.selected)} onCheckedChange={(checked) => setItems(items.map(i => ({ ...i, selected: !!checked })))} className="w-3.5 h-3.5" /></div>
                                        <div>Esencia</div>
                                        <div className="text-center">30g (opc)</div>
                                        <div className="text-center font-bold text-primary/70">100g ({detectedCurrency})</div>
                                        <div className="px-1 flex justify-center">
                                            <Select onValueChange={(val: any) => setItems(items.map(i => i.selected ? { ...i, genero: val } : i))}>
                                                <SelectTrigger className="h-6 text-[8px] border bg-background text-primary font-black px-2 uppercase tracking-tight hover:bg-muted transition-colors flex gap-1">
                                                    <SelectValue placeholder="GÉNERO MASIVO" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="masculino">TODOS MASCULINO</SelectItem>
                                                    <SelectItem value="femenino">TODOS FEMENINO</SelectItem>
                                                    <SelectItem value="ambiente">TODOS AMBIENTE</SelectItem>
                                                    <SelectItem value="otro">TODOS OTRO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div></div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto divide-y bg-background/30 scrollbar-thin scrollbar-thumb-muted">
                                        {items.map(item => (
                                            <div key={item.id} className={`grid grid-cols-[40px_1fr_80px_80px_130px_40px] gap-2 p-1.5 items-center transition-all ${item.selected ? 'hover:bg-muted/10' : 'opacity-40 grayscale'} ${item.needsUpdate ? 'bg-blue-500/5' : item.alreadyExists ? 'bg-amber-500/5' : ''}`}>
                                                <div className="flex justify-center"><Checkbox checked={item.selected} onCheckedChange={(checked) => updateItem(item.id, { selected: !!checked })} className="w-3.5 h-3.5" /></div>
                                                <div className="flex flex-col min-w-0">
                                                    <Input value={item.nombre} onChange={(e) => updateItem(item.id, { nombre: e.target.value })} className="h-7 text-xs font-bold border-none bg-transparent focus-visible:ring-0 px-0 truncate" />
                                                    {item.needsUpdate ? (
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[8px] font-black text-blue-500 uppercase leading-none">Actualizar Precio:</span>
                                                            <span className="text-[8px] font-bold text-muted-foreground line-through decoration-blue-500/30">${item.existingPrice?.toFixed(2)}</span>
                                                            <span className="text-[8px] font-black text-blue-600">→ ${item.precio_100g?.toFixed(2)}</span>
                                                        </div>
                                                    ) : item.alreadyExists ? (
                                                        <span className="text-[8px] font-black text-amber-500 uppercase leading-none mt-0.5">Sin cambios (ya existe)</span>
                                                    ) : (
                                                        <span className="text-[8px] font-black text-emerald-500 uppercase leading-none mt-0.5 tracking-tighter">Nueva Esencia</span>
                                                    )}
                                                </div>
                                                <Input type="number" placeholder="-" value={item.precio_30g || ""} onChange={(e) => updateItem(item.id, { precio_30g: parseFloat(e.target.value) || null })} className="h-7 text-[10px] text-center bg-muted/20 border-none rounded" />
                                                <Input type="number" value={item.precio_100g || ""} step="0.01" onChange={(e) => updateItem(item.id, { precio_100g: parseFloat(e.target.value) || null })} className="h-7 text-[10px] text-center bg-primary/5 font-black border-none rounded text-primary" />
                                                <Select value={item.genero} onValueChange={(val: any) => updateItem(item.id, { genero: val })}>
                                                    <SelectTrigger className="h-7 text-[9px] font-bold border-none bg-muted/40 px-2 uppercase tracking-tighter"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="masculino">MASCULINO</SelectItem>
                                                        <SelectItem value="femenino">FEMENINO</SelectItem>
                                                        <SelectItem value="ambiente">AMBIENTE</SelectItem>
                                                        <SelectItem value="otro">OTRO (UNISEX)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button size="icon" variant="ghost" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="h-7 w-7 text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-2.5 bg-muted/20 border-t flex justify-between items-center text-[10px] shrink-0">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-muted-foreground uppercase tracking-widest">Encontrados: <b className="text-foreground">{items.length}</b></span>
                                            <span className="font-bold text-primary uppercase tracking-widest">Seleccionados: <b>{items.filter(i => i.selected).length}</b></span>
                                        </div>
                                        <div className="flex gap-2">
                                            {items.some(i => i.alreadyExists && !i.needsUpdate) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setItems(items.filter(i => !i.alreadyExists || i.needsUpdate))}
                                                    className="h-6 text-[9px] font-black text-amber-600 border-amber-200 uppercase tracking-widest hover:bg-amber-50 px-2"
                                                >
                                                    Ocultar {items.filter(i => i.alreadyExists && !i.needsUpdate).length} sin cambios
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => setItems([])} className="h-6 text-[9px] font-black text-destructive uppercase tracking-widest hover:bg-destructive/10 px-2">Borrar Todo</Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 opacity-30 text-center">
                                    <FileText className="w-10 h-10 mb-2" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em]">Esperando Datos...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-5 py-3 border-t bg-muted/5 shrink-0 flex gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isImporting} className="font-black text-[10px] uppercase px-4 h-9 tracking-widest">Cancelar</Button>
                    <Button onClick={handleImport} disabled={isImporting || items.filter(i => i.selected).length === 0} className="font-black text-xs px-6 h-9 gap-2 shadow-lg shadow-primary/20 tracking-widest">
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {isImporting ? "PROCESANDO..." : "IMPORTAR AHORA"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
