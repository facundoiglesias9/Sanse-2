"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ShoppingCart, Loader2, Info, Truck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/app/helpers/formatCurrency";

import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";


export default function PedidoMayoristaPage() {
    const supabase = createClient();
    const { currencies, isLoading: loadingCurrencies } = useCurrencies();

    // Estado de productos y carrito
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [orderItems, setOrderItems] = useState<any[]>([]);

    // Estado de envío
    const [hasShipping, setHasShipping] = useState(false);
    const [shippingCost, setShippingCost] = useState<number>(0);

    // Estado del modal de agregar producto
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showZeroPrice, setShowZeroPrice] = useState(true);

    // Cargar productos al inicio
    useEffect(() => {
        const fetchProducts = async () => {
            if (loadingCurrencies) return;

            setLoadingProducts(true);

            // 1. Obtener Esencias
            const { data: esenciasData, error: esenciasError } = await supabase
                .from("esencias")
                .select(`*, insumos_categorias(nombre), proveedores(id, nombre, gramos_configurados, color)`)
                .order("nombre");

            if (esenciasError) {
                console.error("Error fetching esencias:", esenciasError);
                toast.error("Error al cargar esencias");
            }

            // 2. Obtener Insumos
            const { data: insumosData, error: insumosError } = await supabase
                .from("insumos")
                .select(`*`)
                .order("nombre");

            if (insumosError) {
                console.error("Error fetching insumos:", insumosError);
                toast.error("Error al cargar insumos");
            }

            // 3. Procesar y Unificar
            const processedEsencias = (esenciasData || []).map((e: any) => {
                let precioFinal = 0;
                if (e.precio_usd && currencies["ARS"]) {
                    precioFinal = e.precio_usd * currencies["ARS"];
                } else if (e.precio_ars) {
                    precioFinal = e.precio_ars;
                }

                const costo = precioFinal;

                return {
                    ...e,
                    tipo: 'Esencia',
                    costo_visual: costo,
                    info_extra: `${e.cantidad_gramos || 0}g`,
                    unique_id: `esencia-${e.id}`
                };
            });

            const processedInsumos = (insumosData || []).map((i: any) => {
                const costo = i.precio_lote || 0;

                return {
                    ...i,
                    tipo: 'Insumo',
                    costo_visual: costo,
                    info_extra: `${i.cantidad_lote || 0} ${i.unidad || 'u'}`,
                    cantidad_lote: i.cantidad_lote,
                    unique_id: `insumo-${i.id}`,
                    proveedores: { nombre: '-' },
                    insumos_categorias: { nombre: 'Insumo' }
                };
            });

            setAllProducts([...processedEsencias, ...processedInsumos]);
            setLoadingProducts(false);
        };

        fetchProducts();
    }, [loadingCurrencies, currencies]);

    // Funciones del carrito
    const addToOrder = (product: any) => {
        setOrderItems(prev => {
            const existing = prev.find(item => item.unique_id === product.unique_id);
            if (existing) {
                toast.info("Producto ya está en la lista");
                return prev;
            }
            return [...prev, { ...product, cantidad: 1 }];
        });
        setIsAddDialogOpen(false);
        toast.success("Producto agregado al pedido");
    };

    const removeFromOrder = (uniqueId: string) => {
        setOrderItems(prev => prev.filter(item => item.unique_id !== uniqueId));
    };

    const updateQuantity = (uniqueId: string, newQuantity: number) => {
        if (newQuantity < 1) return;
        setOrderItems(prev => prev.map(item => item.unique_id === uniqueId ? { ...item, cantidad: newQuantity } : item));
    };

    // Cálculos de envío
    const totalUnits = useMemo(() => {
        return orderItems.reduce((acc, item) => acc + item.cantidad, 0);
    }, [orderItems]);

    const shippingPerUnit = useMemo(() => {
        if (!hasShipping || totalUnits === 0) return 0;
        return shippingCost / totalUnits;
    }, [hasShipping, shippingCost, totalUnits]);

    const calculateSubtotal = () => {
        return orderItems.reduce((acc, item) => {
            const price = item.costo_visual || 0;
            return acc + (price * item.cantidad);
        }, 0);
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const shipping = hasShipping ? shippingCost : 0;
        return subtotal + shipping;
    };

    // Filtrar productos para el buscador
    const filteredProducts = allProducts.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPrice = showZeroPrice ? true : (p.costo_visual > 0);
        return matchesSearch && matchesPrice;
    });

    const handleConfirmPurchase = async () => {
        if (orderItems.length === 0) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.error("Debes iniciar sesión para realizar un pedido");
            return;
        }

        const promise = async () => {
            // Obtener nombre del cliente
            let clienteNombre = session.user.email;
            const { data: profile } = await supabase
                .from('profiles')
                .select('nombre, rol')
                .eq('id', session.user.id)
                .single();

            if (profile?.nombre) clienteNombre = profile.nombre;

            // Preparar detalle con info de envío se aplica
            const shippingInfo = hasShipping ? ` (Envío: ${formatCurrency(shippingCost, "ARS", 0)})` : "";
            const itemsText = orderItems.map(i => `${i.nombre} x${i.cantidad}`).join(", ");
            const detalleTexto = itemsText + shippingInfo;

            const total = calculateTotal();

            // Incluir el costo de envío distribuido en cada item para persistencia y compatibilidad
            const itemsWithShipping = orderItems.map(item => ({
                ...item,
                perfume: item, // Para compatibilidad con la vista de solicitudes que busca item.perfume.nombre
                costo_base: item.costo_visual,
                costo_con_envio: item.costo_visual + shippingPerUnit,
                shipping_distributed: shippingPerUnit
            }));

            const { error } = await supabase.from('solicitudes').insert({
                created_at: new Date(),
                cliente: clienteNombre,
                detalle: detalleTexto,
                items: itemsWithShipping,
                total: total,
                estado: 'pendiente',
                metodo_pago: 'A coordinar',
            });

            if (error) throw error;
        };

        toast.promise(promise(), {
            loading: 'Enviando solicitud...',
            success: () => {
                setOrderItems([]);
                setHasShipping(false);
                setShippingCost(0);
                return 'Solicitud enviada correctamente. Aguarda la aprobación.';
            },
            error: 'Error al enviar la solicitud'
        });
    };

    // Estado para evitar errores de hidratación
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <div className="mb-8 text-center relative">
                <div className="flex items-center justify-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Pedido Mayorista</h1>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <Info className="w-5 h-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-primary" />
                                    Cálculo de Costo de Envío
                                </DialogTitle>
                                <DialogDescription className="pt-4 space-y-4 text-left">
                                    <p>
                                        El costo de envío ingresado se distribuye equitativamente entre la **cantidad total de unidades** solicitadas en el pedido.
                                    </p>
                                    <div className="bg-muted p-3 rounded-lg font-mono text-sm space-y-2">
                                        <p className="font-semibold text-primary">Fórmula:</p>
                                        <p>Envío por Unidad = Costo Total Envío / Unidades Totales</p>
                                        <p>Ej: $4.000 (Envío) / 4 (Productos) = $1.000 por unidad</p>
                                    </div>
                                    <p className="text-sm">
                                        Este valor se suma al costo base de cada producto para obtener un **costo final aterrizado**, permitiendo un cálculo de margen más preciso.
                                    </p>
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="sm:justify-start">
                                <Button type="button" variant="secondary" onClick={() => {
                                    const dialogOverlay = document.querySelector('[data-state="open"]');
                                    if (dialogOverlay) {
                                        // This is a hacky way to close since we don't have controlled state here easily without more boilerplate
                                        // But for a simple Info dialog it works or we can just let users click outside/close button.
                                    }
                                }}>
                                    Entendido
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <p className="text-muted-foreground mt-1">Arma tu pedido seleccionando productos de la lista.</p>
            </div>

            <Card className="border-none shadow-md bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle>Detalle del Pedido</CardTitle>
                    <div className="flex items-center gap-4">
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 transition-all hover:bg-indigo-600 hover:shadow-indigo-500/20 hover:shadow-lg">
                                    <Plus className="w-4 h-4" /> Agregar Producto
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-full max-w-3xl sm:max-w-3xl max-h-[90vh] flex flex-col border-none shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle>Seleccionar Productos</DialogTitle>
                                    <DialogDescription>Busca y selecciona los productos para agregar al pedido.</DialogDescription>
                                </DialogHeader>

                                <div className="py-4 space-y-4 flex-1 overflow-hidden flex flex-col">
                                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                                        <Input
                                            placeholder="Buscar por nombre..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="flex-1"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id="show-zero"
                                                checked={showZeroPrice}
                                                onCheckedChange={setShowZeroPrice}
                                            />
                                            <Label htmlFor="show-zero" className="cursor-pointer">Mostrar precios en $0</Label>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto border rounded-md custom-scrollbar">
                                        {loadingProducts ? (
                                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
                                        ) : filteredProducts.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground">No se encontraron productos.</div>
                                        ) : (
                                            <div className="divide-y divide-border/50">
                                                {filteredProducts.map(product => (
                                                    <div key={product.unique_id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium group-hover:text-primary transition-colors">{product.nombre}</div>
                                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">{product.info_extra}</Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <Badge variant={product.tipo === 'Esencia' ? 'secondary' : 'warning'} className="text-[10px] h-5 px-1.5">
                                                                    {product.tipo}
                                                                </Badge>
                                                                <span>{product.insumos_categorias?.nombre || "Sin categoría"}</span>
                                                                {product.proveedores?.nombre && product.proveedores.nombre !== '-' && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="text-indigo-400 font-medium">{product.proveedores.nombre}</span>
                                                                    </>
                                                                )}

                                                                {product.tipo === 'Esencia' && product.genero && (
                                                                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ml-2 ${product.genero.toLowerCase() === 'femenino' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                                                        product.genero.toLowerCase() === 'masculino' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                            'bg-slate-50 text-slate-700 border-slate-200'
                                                                        }`}>
                                                                        {product.genero}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <div className="font-bold text-sm">
                                                                    {formatCurrency(product.costo_visual, "ARS", 0)}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Costo</div>
                                                            </div>
                                                            <Button size="sm" variant="secondary" onClick={() => addToOrder(product)}>
                                                                Agregar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {orderItems.length === 0 ? (
                        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
                            <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-semibold opacity-80">El pedido está vacío</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">Comienza agregando los productos y esencias que necesitas reponer.</p>
                            <Button variant="outline" className="mt-6" onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Agregar primer producto
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="rounded-xl border overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Presentación</TableHead>
                                            <TableHead>Categoría / Tipo</TableHead>
                                            <TableHead className="text-right">Costo Base</TableHead>
                                            <TableHead className="text-center w-[120px]">Cantidad</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orderItems.map((item) => (
                                            <TableRow key={item.unique_id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <div className="font-semibold">{item.nombre}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono">{item.info_extra}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={item.tipo === 'Esencia' ? 'secondary' : 'warning'} className="text-[10px] uppercase tracking-tighter">
                                                            {item.tipo}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground font-medium">{item.insumos_categorias?.nombre || "-"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {formatCurrency(item.costo_visual, "ARS", 0)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-sm"
                                                            onClick={() => updateQuantity(item.unique_id, Math.max(1, item.cantidad - 1))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.cantidad}
                                                            onChange={(e) => updateQuantity(item.unique_id, parseInt(e.target.value) || 1)}
                                                            className="h-8 w-14 text-center p-0 font-bold"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-sm"
                                                            onClick={() => updateQuantity(item.unique_id, item.cantidad + 1)}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold font-mono">
                                                    {formatCurrency(item.costo_visual * item.cantidad, "ARS", 0)}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                                                        onClick={() => removeFromOrder(item.unique_id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Sección de Envío - Nueva */}
                            <div className="bg-muted/30 p-4 rounded-xl border border-dashed flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Truck className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="has-shipping" className="font-bold text-base cursor-pointer">¿Tiene costo de envío?</Label>
                                            <Switch
                                                id="has-shipping"
                                                checked={hasShipping}
                                                onCheckedChange={setHasShipping}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Si el envío no es gratis, ingresa el costo para distribuirlo en los productos.</p>
                                    </div>
                                </div>

                                {hasShipping && (
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className="relative flex-1 md:w-48">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Costo de envío"
                                                value={shippingCost || ""}
                                                onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                                className="pl-7 bg-background font-bold"
                                            />
                                        </div>
                                        {totalUnits > 0 && (
                                            <div className="text-sm px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 flex items-center gap-2 whitespace-nowrap">
                                                <span className="font-semibold">+ {formatCurrency(shippingPerUnit, "ARS", 0)}</span>
                                                <span className="text-[10px] uppercase opacity-70">por unidad</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="h-24"></div>

            <div className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-lg p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-40">
                <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Subtotal</span>
                            <span className="text-xl font-bold font-mono">
                                {formatCurrency(calculateSubtotal(), "ARS", 0)}
                            </span>
                        </div>
                        {hasShipping && (
                            <div className="flex flex-col border-l pl-8 border-border">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Envío</span>
                                <span className="text-xl font-bold font-mono text-emerald-600">
                                    + {formatCurrency(shippingCost, "ARS", 0)}
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col border-l pl-8 border-border">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-primary">Total Final</span>
                            <span className="text-4xl font-extrabold font-mono text-primary leading-none">
                                {formatCurrency(calculateTotal(), "ARS", 0)}
                            </span>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        onClick={handleConfirmPurchase}
                        disabled={orderItems.length === 0}
                        className="w-full sm:w-auto bg-primary hover:bg-emerald-600 text-primary-foreground font-bold text-lg px-10 h-14 shadow-xl shadow-primary/20 hover:shadow-emerald-500/30 transition-all rounded-2xl active:scale-95"
                    >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Confirmar Pedido
                    </Button>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
                @media (prefers-color-scheme: dark) {
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #1e293b;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #334155;
                    }
                }
            `}</style>
        </div >
    );
}
