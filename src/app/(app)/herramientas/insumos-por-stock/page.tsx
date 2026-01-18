"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Plus,
    Trash2,
    Edit2,
    Search,
    Loader2,
    Info,
    Layers,
    X,
    ClipboardList,
    Save,
    Check,
    ChevronsUpDown
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getGlobalConfig, updateGlobalConfig } from "@/app/actions/config-actions";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

type InsumoProducto = {
    id: string;
    nombre: string;
    insumos: string[];
    genero?: string;
    categoriaId?: string;
};

export default function InsumosPorStockPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [productos, setProductos] = useState<InsumoProducto[]>([]);
    const [categories, setCategories] = useState<{ id: string; nombre: string; }[]>([]);

    // Suggestion data
    const [allInsumosOptions, setAllInsumosOptions] = useState<string[]>([]);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InsumoProducto | null>(null);
    const [nuevoNombre, setNuevoNombre] = useState("");
    const [nuevoInsumo, setNuevoInsumo] = useState("");
    const [nuevoGenero, setNuevoGenero] = useState<string>("otro");
    const [nuevoCategoria, setNuevoCategoria] = useState<string>("");
    const [insumosTemp, setInsumosTemp] = useState<string[]>([]);

    // Autocomplete state
    const [openCombobox, setOpenCombobox] = useState(false);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([loadData(), fetchSuggestions()]);
            setLoading(false);
        };
        init();
    }, []);

    const loadData = async () => {
        const data = await getGlobalConfig("insumos_por_stock_data");
        if (data) {
            try {
                setProductos(JSON.parse(data));
            } catch (e) {
                console.error("Error parsing insumos_por_stock_data", e);
                setProductos([]);
            }
        }

        // Cargar categorías reales
        const { data: catData } = await supabase.from("insumos_categorias").select("id, nombre").order("nombre");
        if (catData) setCategories(catData);
    };

    const fetchSuggestions = async () => {
        try {
            const { data: insData } = await supabase.from("insumos").select("nombre");
            const { data: escData } = await supabase.from("esencias").select("nombre");

            const combined = [
                ...(insData?.map(i => i.nombre) || []),
                ...(escData?.map(e => e.nombre) || [])
            ];

            const unique = Array.from(new Set(combined)).sort();
            setAllInsumosOptions(unique);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
        }
    };

    const handleSaveData = async (data: InsumoProducto[]) => {
        setSaving(true);
        const res = await updateGlobalConfig("insumos_por_stock_data", JSON.stringify(data));
        if (res.error) {
            toast.error(res.error);
        } else {
            setProductos(data);
        }
        setSaving(false);
    };

    const openAddDialog = () => {
        setEditingProduct(null);
        setNuevoNombre("");
        setNuevoGenero("otro");
        setNuevoCategoria("");
        setInsumosTemp([]);
        setNuevoInsumo("");
        setIsDialogOpen(true);
    };

    const openEditDialog = (producto: InsumoProducto) => {
        setEditingProduct(producto);
        setNuevoNombre(producto.nombre);
        setNuevoGenero(producto.genero || "otro");
        setNuevoCategoria(producto.categoriaId || "");
        setInsumosTemp([...producto.insumos]);
        setNuevoInsumo("");
        setIsDialogOpen(true);
    };

    const addInsumo = (valor?: string) => {
        const valueToAdd = (valor || nuevoInsumo).trim();
        if (!valueToAdd) return;

        if (insumosTemp.includes(valueToAdd)) {
            toast.info("Este insumo ya está en la lista");
            return;
        }
        setInsumosTemp([...insumosTemp, valueToAdd]);
        setNuevoInsumo("");
        setOpenCombobox(false);
    };

    const removeInsumo = (idx: number) => {
        setInsumosTemp(insumosTemp.filter((_, i) => i !== idx));
    };

    const handleConfirmSave = async () => {
        if (!nuevoNombre.trim()) {
            toast.error("El nombre del producto es obligatorio");
            return;
        }
        if (insumosTemp.length === 0) {
            toast.error("Debes agregar al menos un insumo");
            return;
        }

        let updatedProductos: InsumoProducto[];

        if (editingProduct) {
            updatedProductos = productos.map(p =>
                p.id === editingProduct.id
                    ? { ...p, nombre: nuevoNombre.trim(), insumos: insumosTemp, genero: nuevoGenero, categoriaId: nuevoCategoria }
                    : p
            );
        } else {
            const nuevo: InsumoProducto = {
                id: Math.random().toString(36).substring(2) + Date.now().toString(36),
                nombre: nuevoNombre.trim(),
                insumos: insumosTemp,
                genero: nuevoGenero,
                categoriaId: nuevoCategoria
            };
            updatedProductos = [...productos, nuevo];
        }

        await handleSaveData(updatedProductos);
        setIsDialogOpen(false);
        toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta información?")) return;
        const updated = productos.filter(p => p.id !== id);
        await handleSaveData(updated);
        toast.success("Producto eliminado");
    };

    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.insumos.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl">
            <div className="flex flex-col items-center gap-4 mb-8 text-center">
                <div className="flex flex-col items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Layers className="w-8 h-8" />
                        Insumos por Stock
                    </h1>
                    <p className="text-muted-foreground mt-1">Guía informativa de los componentes de cada producto base.</p>
                </div>
                <Button onClick={openAddDialog} className="gap-2 bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
                    <Plus className="w-4 h-4" /> Crear Producto
                </Button>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar producto o insumo..."
                    className="pl-10 h-12 bg-card"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
            ) : filteredProductos.length === 0 ? (
                <Card className="bg-muted/20 border-dashed py-16 text-center">
                    <CardContent>
                        <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground opacity-20 mb-4" />
                        <h3 className="text-lg font-medium opacity-80">No hay información guardada</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                            Aquí puedes listar qué insumos utiliza cada tipo de producto para tener una referencia rápida.
                        </p>
                        <Button variant="outline" onClick={openAddDialog}>
                            Empezar ahora
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredProductos.map((producto) => (
                            <motion.div
                                key={producto.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <Card className="h-full hover:shadow-md transition-all group overflow-hidden border-border/50">
                                    <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <CardTitle className="text-xl group-hover:text-primary transition-colors">{producto.nombre}</CardTitle>
                                                {producto.genero && producto.genero !== 'otro' && (
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground/70">
                                                        {producto.genero}
                                                    </Badge>
                                                )}
                                                {producto.categoriaId && (
                                                    <Badge variant="secondary" className="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-50 border-indigo-100">
                                                        {categories.find(c => c.id === producto.categoriaId)?.nombre || "Cat"}
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardDescription>Stock e insumos requeridos</CardDescription>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => openEditDialog(producto)}>
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(producto.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {producto.insumos.map((insumo, i) => (
                                                <Badge key={i} variant="secondary" className="bg-muted/50 font-medium px-2 py-0.5">
                                                    {insumo}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}</DialogTitle>
                        <DialogDescription>
                            Define qué insumos se utilizan para fabricar este producto base.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nombre">Nombre del Producto</Label>
                                <Input
                                    id="nombre"
                                    placeholder="Ej: Perfume Masculino 50ml"
                                    value={nuevoNombre}
                                    onChange={(e) => setNuevoNombre(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="genero">Género</Label>
                                <select
                                    id="genero"
                                    value={nuevoGenero}
                                    onChange={(e) => setNuevoGenero(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="masculino">Masculino</option>
                                    <option value="femenino">Femenino</option>
                                    <option value="unisex">Unisex</option>
                                    <option value="ambiente">Ambiente</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría Asociada</Label>
                            <select
                                id="categoria"
                                value={nuevoCategoria}
                                onChange={(e) => setNuevoCategoria(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Seleccionar categoría...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Agregar Insumos</Label>
                            <div className="flex gap-2">
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="justify-between bg-background w-full font-normal"
                                        >
                                            {nuevoInsumo || "Buscar insumo..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[384px] p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Escribe para buscar..."
                                                value={nuevoInsumo}
                                                onValueChange={setNuevoInsumo}
                                            />
                                            <CommandList className="max-h-[200px]">
                                                <CommandEmpty className="py-2 px-4 flex flex-col gap-2">
                                                    <span className="text-xs text-muted-foreground">Tu búsqueda no coincide con ningún insumo existente.</span>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="w-full text-xs h-7"
                                                        onClick={() => addInsumo()}
                                                    >
                                                        Agregar "{nuevoInsumo}" manualmente
                                                    </Button>
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {allInsumosOptions.map((option) => (
                                                        <CommandItem
                                                            key={option}
                                                            value={option}
                                                            onSelect={(currentValue) => {
                                                                addInsumo(currentValue);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    insumosTemp.includes(option) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {option}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <Button size="icon" variant="secondary" onClick={() => addInsumo()}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Lista de insumos:</Label>
                            <div className="flex flex-wrap gap-2 p-3 bg-muted/20 border rounded-lg min-h-[80px] content-start">
                                {insumosTemp.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic m-auto">No hay insumos agregados</p>
                                ) : (
                                    insumosTemp.map((insumo, idx) => (
                                        <Badge key={idx} className="gap-1 pr-1 font-medium bg-background text-foreground border-border hover:bg-muted">
                                            {insumo}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 rounded-full p-0 hover:bg-destructive hover:text-white"
                                                onClick={() => removeInsumo(idx)}
                                            >
                                                <X className="w-2 h-2" />
                                            </Button>
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-primary hover:bg-primary/90"
                            onClick={handleConfirmSave}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="mt-12 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex gap-4 items-start">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                    <Info className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-500">¿Para qué sirve esta sección?</h4>
                    <p className="text-sm text-muted-foreground">
                        Esta pestaña es **meramente informativa**. Sirve para listar la receta o componentes de cada producto base para referencia de los empleados o administradores. No afecta el stock real ni la contabilidad.
                    </p>
                </div>
            </div>
        </div>
    );
}
