"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Sparkles, Car, Droplets, Trash2, Calculator, Package, Check, ChevronsUpDown, Search, FlaskConical, Filter, User, TrendingUp, Wallet, ArrowRight, DollarSign } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Schema modificado: se eliminan precios y cantidad
const formSchema = z.object({
    nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
    genero: z.enum(["masculino", "femenino", "ambiente", "otro"]),
    proveedor_id: z.string().min(1, { message: "Selecciona un proveedor." }),
    insumos_categorias_id: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AgregarProductoPage() {
    const [activeTab, setActiveTab] = useState("perfumeria");
    const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
    const [insumos, setInsumos] = useState<any[]>([]);
    const [esencias, setEsencias] = useState<any[]>([]);
    const [categories, setCategories] = useState<{ id: string; nombre: string }[]>([]);

    // Add Category State
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [creatingCategory, setCreatingCategory] = useState(false);

    const [dollarRate, setDollarRate] = useState<number>(0);

    // Calculator State
    const [itemType, setItemType] = useState<"insumo" | "esencia">("insumo");
    const [openCombobox, setOpenCombobox] = useState(false);

    // Filters for Esencias
    const [filterGenero, setFilterGenero] = useState<string>("todos");
    const [filterProveedor, setFilterProveedor] = useState<string>("todos");

    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    // Estados para "Insumos a utilizar"
    const [selectedInsumos, setSelectedInsumos] = useState<{
        id: string;
        nombre: string;
        cantidad: number;
        costoOriginal: number; // Costo total en la moneda original
        moneda: "USD" | "ARS";
        type: "insumo" | "esencia";
        unidad: string;
    }[]>([]);
    const [currentInsumoId, setCurrentInsumoId] = useState("");
    const [currentCantidad, setCurrentCantidad] = useState("");
    const [currentUnidad, setCurrentUnidad] = useState("un"); // Default unit

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            nombre: "",
            genero: "otro",
            proveedor_id: "",
            insumos_categorias_id: null,
        },
    });

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch Categories
                const { data: cats } = await supabase.from("insumos_categorias").select("id, nombre").order("nombre");
                if (cats) setCategories(cats);

                // Fetch Suppliers
                const { data: provs } = await supabase.from("proveedores").select("id, nombre").order("nombre");
                if (provs) setProveedores(provs);

                // Fetch Insumos
                const { data: insData } = await supabase.from("insumos").select("*").order("nombre");
                if (insData) setInsumos(insData);

                // Fetch Esencias
                const { data: esenciasData } = await supabase
                    .from("esencias")
                    .select(`
                        id, 
                        nombre, 
                        genero,
                        proveedor_id,
                        precio_usd, 
                        precio_ars,
                        cantidad_gramos, 
                        proveedores (
                            id,
                            nombre,
                            gramos_configurados
                        )
                    `)
                    .order("nombre");
                if (esenciasData) setEsencias(esenciasData);

                // Fetch Dollar Rate
                const res = await fetch("/api/exchange-rate");
                const rates = await res.json();
                if (rates && rates.ARS) setDollarRate(rates.ARS);

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        }
        fetchData();
    }, []);

    // Helper para determinar estilo de la pestaña según el nombre de la categoría
    const getCategoryStyle = (nombre: string) => {
        const n = nombre.toLowerCase();
        if (n.includes("perfume") || n.includes("fina")) return { icon: Sparkles, color: "text-purple-500", label: "Perfumería Fina" };
        if (n.includes("auto") || n.includes("aromatizante")) return { icon: Car, color: "text-blue-500", label: "Auto (Aromatizante)" };
        if (n.includes("limpia pisos") && n.includes("1l")) return { icon: Droplets, color: "text-cyan-500", label: "Limpia Pisos 1L" };
        if (n.includes("limpia pisos") && n.includes("5l")) return { icon: Droplets, color: "text-teal-600", label: "Limpia Pisos 5L" };
        if (n.includes("difusor")) return { icon: Package, color: "text-orange-500", label: "Difusor" };
        return { icon: Package, color: "text-gray-500", label: nombre };
    };

    useEffect(() => {
        if (categories.length > 0 && !activeTab) {
            // Default to first category if none selected
            setActiveTab(categories[0].id);
        }
    }, [categories, activeTab]);

    useEffect(() => {
        // Logic to set gender based on selected category
        const currentCat = categories.find(c => c.id === activeTab);
        if (currentCat) {
            const name = currentCat.nombre.toLowerCase();
            if (name.includes("perfum")) {
                form.setValue("genero", "femenino");
            } else if (name.includes("auto") || name.includes("aromatizante") || name.includes("ambiente")) {
                form.setValue("genero", "ambiente");
            } else {
                form.setValue("genero", "otro");
            }
        }
    }, [activeTab, categories, form]);

    const handleAddItem = () => {
        if (!currentInsumoId || !currentCantidad) return;
        const cantidad = parseFloat(currentCantidad);
        if (isNaN(cantidad) || cantidad <= 0) return;

        let newItem = null;

        if (itemType === "insumo") {
            const insumo = insumos.find(i => i.id === currentInsumoId);
            if (!insumo) return;

            let conversionFactor = 1;
            if (currentUnidad === "lt" || currentUnidad === "kg") {
                conversionFactor = 1000;
            }

            const costoUnitario = insumo.cantidad_lote > 0 ? (insumo.precio_lote / insumo.cantidad_lote) : 0;
            const costoTotal = costoUnitario * cantidad * conversionFactor;

            newItem = {
                id: insumo.id,
                nombre: insumo.nombre,
                cantidad: cantidad,
                costoOriginal: costoTotal,
                moneda: "ARS" as const,
                type: "insumo" as const,
                unidad: currentUnidad
            };
        } else {
            const esencia = esencias.find(e => e.id === currentInsumoId);
            if (!esencia) return;

            let precioBase = 0;
            let moneda: "USD" | "ARS" = "ARS";

            if (esencia.precio_usd) {
                precioBase = esencia.precio_usd;
                moneda = "USD";
            } else if (esencia.precio_ars) {
                precioBase = esencia.precio_ars;
                moneda = "ARS";
            }

            // @ts-ignore
            const cantidadBase = esencia.cantidad_gramos > 0 ? esencia.cantidad_gramos : 1;
            const costoTotal = (precioBase / cantidadBase) * cantidad;

            newItem = {
                id: esencia.id,
                nombre: esencia.nombre,
                cantidad: cantidad,
                costoOriginal: costoTotal,
                moneda: moneda,
                type: "esencia" as const,
                unidad: "gr"
            };
        }

        if (newItem) {
            setSelectedInsumos([...selectedInsumos, newItem]);
            setCurrentInsumoId("");
            setCurrentCantidad("");
            setOpenCombobox(false);

            if (itemType === "esencia") {
                const esencia = esencias.find(e => e.id === newItem.id);
                if (esencia) {
                    if (esencia.proveedor_id) {
                        form.setValue("proveedor_id", esencia.proveedor_id);
                    }
                    if (esencia.genero) {
                        const validGeneros = ["masculino", "femenino", "ambiente", "otro", "unisex"];
                        if (validGeneros.includes(esencia.genero)) {
                            // @ts-ignore
                            form.setValue("genero", esencia.genero);
                        }
                    }
                }
            }
        }
    };

    const handleRemoveInsumo = (index: number) => {
        const newInsumos = [...selectedInsumos];
        newInsumos.splice(index, 1);
        setSelectedInsumos(newInsumos);
    }

    async function onSubmit(data: FormValues) {
        setLoading(true);
        try {
            // activeTab now holds the ID directly
            const categoryId = activeTab;

            const custom_insumos = selectedInsumos.map(item => ({
                id: item.id,
                nombre: item.nombre,
                cantidad: item.type === "insumo" && (item.unidad === "lt" || item.unidad === "kg")
                    ? item.cantidad * 1000
                    : item.cantidad,
                cantidad_necesaria: item.type === "insumo" && (item.unidad === "lt" || item.unidad === "kg") ? item.cantidad * 1000 : item.cantidad,
                is_general: false,
            })).filter(i => i.id !== "virtual-esencia");

            const { error } = await supabase.from("esencias").insert({
                nombre: data.nombre,
                genero: data.genero,
                proveedor_id: data.proveedor_id,
                insumos_categorias_id: categoryId,
                custom_insumos: custom_insumos,
                precio_usd: null,
                precio_ars: null,
                cantidad_gramos: null,
                is_consultar: false,
                created_by: (await supabase.auth.getUser()).data.user?.id,
            });

            if (error) throw error;

            toast.success("Producto agregado correctamente");
            form.reset({
                nombre: "",
                genero: "otro",
                proveedor_id: "",
                insumos_categorias_id: null,
            });
            setSelectedInsumos([]);
            // Keep on current tab
            router.push("/");
        } catch (error: any) {
            console.error(error);
            toast.error("Error al agregar producto: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setCreatingCategory(true);
        try {
            const { data, error } = await supabase.from("insumos_categorias").insert({
                nombre: newCategoryName,
                created_by: (await supabase.auth.getUser()).data.user?.id
            }).select().single();

            if (error) throw error;

            setCategories([...categories, data]);
            setIsAddCategoryOpen(false);
            setNewCategoryName("");
            setActiveTab(data.id); // Switch to new category
            toast.success("Categoría creada exitosamente");
        } catch (error: any) {
            toast.error("Error al crear categoría: " + error.message);
        } finally {
            setCreatingCategory(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="container mx-auto py-10 px-4 max-w-4xl"
        >
            <div className="flex flex-col space-y-2 mb-8 text-center md:text-left">
                <h1 className="text-4xl font-extrabold tracking-tight text-primary">Agregar nuevo producto</h1>
                <p className="text-muted-foreground text-lg">
                    Selecciona la categoría y completa los detalles para añadir un nuevo ítem a la lista de precios.
                </p>
            </div>

            <Tabs defaultValue={categories.length > 0 ? categories[0].id : undefined} value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-5 h-auto p-1 bg-muted/50 rounded-xl mb-8 gap-2">
                    {categories.filter(cat => cat.nombre.toLowerCase() !== 'otro').map((cat) => {
                        const style = getCategoryStyle(cat.nombre);
                        const Icon = style.icon;
                        return (
                            <TabsTrigger
                                key={cat.id}
                                value={cat.id}
                                className="rounded-lg py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300"
                            >
                                <Icon className={`w-5 h-5 mr-2 ${style.color}`} />
                                <span className="font-semibold">{style.label}</span>
                            </TabsTrigger>
                        );
                    })}

                    <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="rounded-lg py-3 h-auto border-2 border-dashed border-muted hover:border-primary hover:text-primary transition-all">
                                <Plus className="h-5 w-5 mr-2" />
                                <span className="font-semibold">Agregar</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Agregar nueva categoría</DialogTitle>
                                <DialogDescription>
                                    Crea una nueva pestaña para tus productos.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="catName" className="mb-2 block">Nombre</Label>
                                <Input
                                    id="catName"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Ej: Jabón líquido..."
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancelar</Button>
                                <Button onClick={handleAddCategory} disabled={creatingCategory}>
                                    {creatingCategory ? <Loader2 className="animate-spin h-4 w-4" /> : "Crear"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsList>

                <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            Nuevo Producto
                        </CardTitle>
                        <CardDescription>
                            Completa la información requerida. Los campos con * son obligatorios.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <FormField
                                        control={form.control}
                                        name="nombre"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>Nombre del producto *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: Invictus, Lavanda..." {...field} className="bg-background/80" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="genero"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>Género</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background/80">
                                                            <SelectValue placeholder="Selecciona género" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="masculino">Masculino</SelectItem>
                                                        <SelectItem value="femenino">Femenino</SelectItem>
                                                        <SelectItem value="unisex">Unisex</SelectItem>
                                                        <SelectItem value="ambiente">Ambiente</SelectItem>
                                                        <SelectItem value="otro">Otro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <FormField
                                        control={form.control}
                                        name="proveedor_id"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>Proveedor *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background/80">
                                                            <SelectValue placeholder="Selecciona un proveedor" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {proveedores.map((prov) => (
                                                            <SelectItem key={prov.id} value={prov.id}>
                                                                {prov.nombre}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Campo Categoría (Etiqueta) */}
                                    {/* Campo Categoría (Etiqueta) - Eliminado, se define por Tab */}
                                </div>

                                <Separator />

                                <div className="space-y-6 pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                                <Calculator className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold tracking-tight">Calculadora de Costos</h3>
                                                <p className="text-sm text-muted-foreground">Estima el costo de producción agregando insumos.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-card/60 border rounded-xl shadow-sm space-y-4 backdrop-blur-sm">

                                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => { setItemType("insumo"); setCurrentInsumoId(""); }}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                        itemType === "insumo"
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                    )}
                                                >
                                                    <Package className="w-4 h-4" /> Insumo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setItemType("esencia"); setCurrentInsumoId(""); }}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                        itemType === "esencia"
                                                            ? "bg-purple-600 text-white shadow-md"
                                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                    )}
                                                >
                                                    <FlaskConical className="w-4 h-4" /> Esencia
                                                </button>
                                            </div>

                                            {itemType === "esencia" && (
                                                <div className="flex gap-3 w-full md:w-auto animate-in fade-in slide-in-from-right-4 duration-300">
                                                    <Select value={filterGenero} onValueChange={setFilterGenero}>
                                                        <SelectTrigger className="h-9 w-[190px] bg-background/50 text-xs">
                                                            <div className="flex items-center truncate">
                                                                <Filter className="w-3 h-3 mr-2 text-muted-foreground" />
                                                                <span className="text-muted-foreground mr-1">Género:</span>
                                                                <span className="font-medium text-foreground capitalize truncate">
                                                                    {filterGenero === "todos" ? "Todos" : filterGenero}
                                                                </span>
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="todos">Todos</SelectItem>
                                                            <SelectItem value="femenino">Femenino</SelectItem>
                                                            <SelectItem value="masculino">Masculino</SelectItem>
                                                            <SelectItem value="unisex">Unisex</SelectItem>
                                                            <SelectItem value="ambiente">Ambiente</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Select value={filterProveedor} onValueChange={setFilterProveedor}>
                                                        <SelectTrigger className="h-9 w-[150px] bg-background/50 text-xs">
                                                            <div className="flex items-center truncate">
                                                                <User className="w-3 h-3 mr-2 text-muted-foreground" />
                                                                <span className="text-muted-foreground mr-1">Prov:</span>
                                                                <span className="font-medium text-foreground truncate block max-w-[80px]">
                                                                    {filterProveedor === "todos" ? "Todos" : proveedores.find(p => p.id === filterProveedor)?.nombre}
                                                                </span>
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="todos">Todos</SelectItem>
                                                            {proveedores.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                            <div className="md:col-span-5 space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                                                    {itemType === "insumo" ? "Insumo" : "Buscar Esencia"}
                                                </Label>

                                                {itemType === "insumo" ? (
                                                    <Select value={currentInsumoId} onValueChange={setCurrentInsumoId}>
                                                        <SelectTrigger className="w-full h-11 bg-background/50 focus:bg-background transition-all duration-200 border-muted-foreground/20">
                                                            <SelectValue placeholder="Seleccionar insumo..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {insumos.map((ins) => (
                                                                <SelectItem key={ins.id} value={ins.id}>{ins.nombre}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={openCombobox}
                                                                className="w-full h-11 justify-between bg-background/50 border-muted-foreground/20 font-normal hover:bg-background/80"
                                                            >
                                                                {currentInsumoId
                                                                    ? esencias.find((e) => e.id === currentInsumoId)?.nombre
                                                                    : "Buscar esencia..."}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[400px] p-0" align="start">
                                                            <Command>
                                                                <CommandInput placeholder="Escribe para buscar esencia..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No se encontró la esencia.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {esencias.filter(esencia => {
                                                                            if (filterGenero !== "todos" && esencia.genero !== filterGenero) return false;
                                                                            if (filterProveedor !== "todos" && esencia.proveedor_id !== filterProveedor) return false;
                                                                            return true;
                                                                        }).map((esencia) => (
                                                                            <CommandItem
                                                                                key={esencia.id}
                                                                                value={`${esencia.nombre}-${esencia.id}`} // Unique value for cmdk
                                                                                onSelect={() => {
                                                                                    setCurrentInsumoId(esencia.id);
                                                                                    setOpenCombobox(false);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        currentInsumoId === esencia.id ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                <div className="flex flex-col">
                                                                                    <span>{esencia.nombre}</span>
                                                                                    <span className="text-[10px] text-muted-foreground">
                                                                                        {esencia.genero} • {esencia.proveedores?.nombre}
                                                                                    </span>
                                                                                </div>
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>
                                            <div className="md:col-span-5 space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                                                    {itemType === "insumo" ? "Cantidad" : "Gramos a usar"}
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        value={currentCantidad}
                                                        onChange={(e) => setCurrentCantidad(e.target.value)}
                                                        className="h-11 bg-background/50 focus:bg-background transition-all duration-200 border-muted-foreground/20 flex-1"
                                                    />
                                                    {itemType === "insumo" ? (
                                                        <Select value={currentUnidad} onValueChange={setCurrentUnidad}>
                                                            <SelectTrigger className="w-[70px] h-11 bg-background/50 border-muted-foreground/20">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="un">un</SelectItem>
                                                                <SelectItem value="ml">ml</SelectItem>
                                                                <SelectItem value="lt">lt</SelectItem>
                                                                <SelectItem value="gr">gr</SelectItem>
                                                                <SelectItem value="kg">kg</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <div className="flex items-center justify-center bg-muted/20 border border-muted-foreground/20 rounded-md px-3 h-11 min-w-[50px]">
                                                            <span className="text-sm font-medium text-muted-foreground">gr</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <Button
                                                    type="button"
                                                    onClick={handleAddItem}
                                                    disabled={!currentInsumoId || !currentCantidad}
                                                    className={cn(
                                                        "w-full h-11 font-semibold shadow-sm transition-all active:scale-95",
                                                        itemType === "esencia" && "bg-purple-600 hover:bg-purple-700"
                                                    )}
                                                >
                                                    <Plus className="w-4 h-4 mr-1" /> Agregar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedInsumos.length > 0 ? (
                                        <div className="rounded-xl border bg-card/40 overflow-hidden shadow-sm animate-in fade-in-50 slide-in-from-bottom-2">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow className="hover:bg-transparent border-b border-muted/60">
                                                        <TableHead className="w-[40%] py-4">Insumo</TableHead>
                                                        <TableHead className="text-right py-4">Utilizado</TableHead>
                                                        <TableHead className="text-right py-4">Costo USD</TableHead>
                                                        <TableHead className="text-right py-4">Costo ARS</TableHead>
                                                        <TableHead className="w-[50px] py-4"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedInsumos.map((item, idx) => {
                                                        const costoARS = item.moneda === "USD"
                                                            ? item.costoOriginal * dollarRate
                                                            : item.costoOriginal;

                                                        const hasZeroCost = costoARS === 0;

                                                        return (
                                                            <TableRow key={idx} className="group transition-colors hover:bg-muted/20 border-b border-muted/40">
                                                                <TableCell className="font-medium text-foreground py-4">
                                                                    <div className="flex flex-col">
                                                                        <span>{item.nombre}</span>
                                                                        {item.moneda === "USD" && !hasZeroCost && (
                                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Cotizado en Dólar</span>
                                                                        )}
                                                                        {hasZeroCost && (
                                                                            <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                                                                                ⚠️ Precio no configurado
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-muted-foreground py-4">
                                                                    {item.cantidad} <span className="text-xs">{item.unidad}</span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-muted-foreground py-4">
                                                                    {item.moneda === "USD" && !hasZeroCost ? (
                                                                        <span className="text-blue-600 font-semibold">
                                                                            ${item.costoOriginal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground/30">-</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold py-4">
                                                                    {hasZeroCost ? (
                                                                        <span className="text-amber-500">Sin Precio</span>
                                                                    ) : (
                                                                        <span className="text-emerald-600 dark:text-emerald-400">
                                                                            ${costoARS.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="py-4">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                                                        onClick={() => handleRemoveInsumo(idx)}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>

                                            <div className="p-6 border-t bg-muted/5">
                                                <div className="flex justify-end items-center">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Wallet className="w-4 h-5 text-muted-foreground" />
                                                            <span className="text-xs uppercase tracking-wider font-semibold">Costo Total</span>
                                                        </div>
                                                        <span className="text-3xl font-extrabold text-foreground">
                                                            ${selectedInsumos.reduce((acc, curr) => {
                                                                const val = curr.moneda === "USD" ? curr.costoOriginal * dollarRate : curr.costoOriginal;
                                                                return acc + val;
                                                            }, 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/5">
                                            <div className="p-4 bg-muted/30 rounded-full mb-4">
                                                <Package className="w-8 h-8 text-muted-foreground/50" />
                                            </div>
                                            <h3 className="text-lg font-medium text-foreground">No hay insumos agregados</h3>
                                            <p className="text-sm text-muted-foreground max-w-sm mt-1">Usa la calculadora arriba para agregar insumos o esencias.</p>
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 text-lg tracking-wide rounded-xl shadow-lg mt-8" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar producto"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </Tabs>
        </motion.div>
    );
}
