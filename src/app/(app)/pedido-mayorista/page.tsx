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
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label"; // Check if Label is used, lint said unused. Will remove if confirmed.


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

    // Cargar productos al inicio
    useEffect(() => {
        const fetchProducts = async () => {
            if (loadingCurrencies) return;

            setLoadingProducts(true);

            // 1. Fetch Esencias
            const { data: esenciasData, error: esenciasError } = await supabase
                .from("esencias")
                .select(`*, insumos_categorias(nombre), proveedores(id, nombre, gramos_configurados, color)`)
                .order("nombre");

            if (esenciasError) {
                console.error("Error fetching esencias:", esenciasError);
                toast.error("Error al cargar esencias");
            }

            // 2. Fetch Insumos
            const { data: insumosData, error: insumosError } = await supabase
                .from("insumos")
                .select(`*`)
                .order("nombre");

            if (insumosError) {
                console.error("Error fetching insumos:", insumosError);
                toast.error("Error al cargar insumos");
            }

            // 3. Process and Merge
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
                    cantidad_lote: i.cantidad_lote, // Ensure we keep this for calculations
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
    const filteredProducts = allProducts.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirmPurchase = async () => {
        if (orderItems.length === 0) return;

        const promise = async () => {
            for (const item of orderItems) {
                // 1. Update Esencias (Stock logic)
                if (item.tipo === 'Esencia') {
                    const gramosConfigurados = item.proveedores?.gramos_configurados || 1;
                    const gramosTotales = item.cantidad * gramosConfigurados;

                    // Increment in esencias table
                    const { data: currentEsencia } = await supabase
                        .from('esencias')
                        .select('cantidad_gramos')
                        .eq('id', item.id)
                        .single();

                    if (currentEsencia) {
                        await supabase
                            .from('esencias')
                            .update({ cantidad_gramos: (currentEsencia.cantidad_gramos || 0) + gramosTotales })
                            .eq('id', item.id);
                    }

                    // 2. Update/Insert in Inventario (Esencia)
                    const { data: invItem } = await supabase
                        .from('inventario')
                        .select('*')
                        .eq('tipo', 'Esencia')
                        .ilike('nombre', item.nombre)
                        .maybeSingle();

                    if (invItem) {
                        await supabase.from('inventario').update({
                            cantidad: (Number(invItem.cantidad) || 0) + gramosTotales,
                            updated_at: new Date().toISOString()
                        }).eq('id', invItem.id);
                    } else {
                        await supabase.from('inventario').insert({
                            nombre: item.nombre,
                            tipo: 'Esencia',
                            cantidad: gramosTotales,
                            genero: item.genero || 'unisex',
                            updated_at: new Date().toISOString()
                        });
                    }
                }
                else if (item.tipo === 'Insumo') {
                    // Update/Insert in Inventario (Insumo)
                    // Logic: 'cantidad' here is number of lots. We multiply by 'cantidad_lote' to get total units/liters.
                    const cantidadTotal = item.cantidad * (item.cantidad_lote || 1);

                    const { data: invItem } = await supabase
                        .from('inventario')
                        .select('*')
                        .eq('tipo', 'Insumo')
                        .ilike('nombre', item.nombre)
                        .maybeSingle();

                    if (invItem) {
                        await supabase.from('inventario').update({
                            cantidad: (Number(invItem.cantidad) || 0) + cantidadTotal,
                            updated_at: new Date().toISOString()
                        }).eq('id', invItem.id);
                    } else {
                        await supabase.from('inventario').insert({
                            nombre: item.nombre,
                            tipo: 'Insumo',
                            cantidad: cantidadTotal,
                            genero: 'unisex',
                            updated_at: new Date().toISOString()
                        });
                    }
                }
            }
        };

        toast.promise(promise(), {
            loading: 'Procesando compra...',
            success: () => {
                setOrderItems([]);
                return 'Compra registrada y stock actualizado';
            },
            error: 'Error al procesar la compra'
        });
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Pedido Mayorista</h1>
                    <p className="text-muted-foreground mt-1">Arma tu pedido seleccionando productos de la lista.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Card className="p-3 bg-muted/50 border-dashed flex items-center gap-4">
                        <div>
                            <div className="text-sm font-medium text-muted-foreground">Total Estimado</div>
                            <div className="text-2xl font-bold text-primary">
                                {formatCurrency(calculateTotal(), "ARS", 0)}
                            </div>
                        </div>
                        <Button onClick={handleConfirmPurchase} disabled={orderItems.length === 0}>
                            Confirmar Compra
                        </Button>
                    </Card>
                </div>
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
                        <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Seleccionar Productos</DialogTitle>
                                <DialogDescription>Busca y selecciona los productos para agregar al pedido.</DialogDescription>
                            </DialogHeader>

                            <div className="py-4 space-y-4 flex-1 overflow-hidden flex flex-col">
                                <Input
                                    placeholder="Buscar por nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />

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
                                    <AnimatePresence>
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
                                    </AnimatePresence>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div >
    );
}
