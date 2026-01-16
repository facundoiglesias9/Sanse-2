"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ShoppingCart, Loader2 } from "lucide-react";
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

    // Estado del modal de agregar producto
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showZeroPrice, setShowZeroPrice] = useState(true);

    // Cargar productos al inicio
    useEffect(() => {
        // ... (existing useEffect code remains the same, I will not include it in replacement if I can help it, but replace_file_content needs contiguous block. 
        // Wait, I can use multi_replace to avoid replacing the big useEffect chunk.
        // I will switch to multi_replace for cleaner edits.)

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
                // const gramosPor = e.proveedores?.gramos_configurados ?? 1;
                // const perfumesPorCantidad = e.cantidad_gramos && gramosPor > 0 ? e.cantidad_gramos / gramosPor : 1;

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
                    cantidad_lote: i.cantidad_lote, // Nos aseguramos de mantener esto para los cálculos
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

    const calculateTotal = () => {
        return orderItems.reduce((acc, item) => {
            const price = item.costo_visual || 0;
            return acc + (price * item.cantidad);
        }, 0);
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

            // Preparar datos para la solicitud
            const detalleTexto = orderItems.map(i => `${i.nombre} x${i.cantidad}`).join(", ");
            const total = calculateTotal();

            const { error } = await supabase.from('solicitudes').insert({
                created_at: new Date(),
                cliente: clienteNombre,
                detalle: detalleTexto,
                items: orderItems,
                total: total,
                estado: 'pendiente',
                metodo_pago: 'A coordinar', // Se puede mejorar agregando un selector en la UI
            });

            if (error) throw error;
        };

        toast.promise(promise(), {
            loading: 'Enviando solicitud...',
            success: () => {
                setOrderItems([]);
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
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-primary">Pedido Mayorista</h1>
                <p className="text-muted-foreground mt-1">Arma tu pedido seleccionando productos de la lista.</p>
            </div>

            <Card className="border-none shadow-md bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Detalle del Pedido</CardTitle>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" /> Agregar Producto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full max-w-3xl sm:max-w-3xl max-h-[90vh] flex flex-col">
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

                                <div className="flex-1 overflow-y-auto border rounded-md">
                                    {loadingProducts ? (
                                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
                                    ) : filteredProducts.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">No se encontraron productos.</div>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredProducts.map(product => (
                                                <div key={product.unique_id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium">{product.nombre}</div>
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
                                                            <div className="text-[10px] text-muted-foreground">Precio</div>
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
                </CardHeader>
                <CardContent>
                    {orderItems.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                            <h3 className="text-lg font-medium">El pedido está vacío</h3>
                            <p className="text-muted-foreground">Utiliza el botón "Agregar Producto" para comenzar.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead>Presentación</TableHead>
                                        <TableHead>Categoría / Tipo</TableHead>
                                        <TableHead className="text-right">Precio</TableHead>
                                        <TableHead className="text-center w-[120px]">Cantidad</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orderItems.map((item) => (
                                        <TableRow key={item.unique_id}>
                                            <TableCell>
                                                <div className="font-medium">{item.nombre}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{item.info_extra}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={item.tipo === 'Esencia' ? 'secondary' : 'warning'} className="text-[10px]">
                                                        {item.tipo}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">{item.insumos_categorias?.nombre || "-"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(item.costo_visual, "ARS", 0)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.cantidad}
                                                    onChange={(e) => updateQuantity(item.unique_id, parseInt(e.target.value) || 1)}
                                                    className="h-8 w-20 mx-auto text-center"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                {formatCurrency(item.costo_visual * item.cantidad, "ARS", 0)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                    )}
                </CardContent>
            </Card>

            {/* Padding extra para que el contenido no quede tapado por la barra fija */}
            <div className="h-24"></div>

            {/* Barra fija inferior moderna */}
            <div className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 transition-all duration-300">
                <div className="container mx-auto max-w-6xl flex justify-between items-center">
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Total Estimado</span>
                        <span className="text-3xl font-bold text-primary tabular-nums">
                            {formatCurrency(calculateTotal(), "ARS", 0)}
                        </span>
                    </div>

                    <Button
                        size="lg"
                        onClick={handleConfirmPurchase}
                        disabled={orderItems.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-lg px-8 shadow-lg hover:shadow-emerald-500/20 transition-all rounded-full"
                    >
                        Confirmar Compra
                    </Button>
                </div>
            </div>
        </div >
    );
}
