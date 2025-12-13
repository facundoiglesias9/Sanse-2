"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    User,
    Trophy,
    Calendar,
    DollarSign,
    Users,
    ArrowRight,
    ShoppingBag,
    Gift
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { startOfMonth, subMonths, isAfter, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ResellerSale {
    id: string;
    created_at: string;
    cliente: string;
    cantidad_perfumes: number;
    precio_total: number;
    perfumes: any[];
    metodo_pago?: string;
}

interface ResellerStats {
    username: string;
    totalSales: number;
    totalAmount: number;
    lastSaleDate: Date | null;
    sales: ResellerSale[];
}

interface Prize {
    id: string;
    revendedor_nombre: string;
    premio: string;
    estado: 'pendiente' | 'entregado';
    created_at: string;
}

type DateRangeOption = "all" | "this_month" | "last_month" | "today";

export default function VentasRevendedoresPage() {
    const [stats, setStats] = useState<ResellerStats[]>([]);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRangeOption>("this_month");

    // Estado de Premiación
    const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
    const [selectedPrize, setSelectedPrize] = useState<string>("");
    const [isAwarding, setIsAwarding] = useState(false);

    const supabase = createClient();


    useEffect(() => {
        fetchResellerSales();
    }, [dateRange]);

    const fetchResellerSales = async () => {
        setLoading(true);

        // 1. Obtener Perfiles de Revendedores
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("nombre")
            .eq("rol", "revendedor");

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
        }

        const resellerNames = (profiles || []).map((p: any) => p.nombre);

        // 2. Obtener Premios
        const { data: prizesData } = await supabase
            .from("premios")
            .select("*")
            .eq("estado", "pendiente");

        if (prizesData) {
            setPrizes(prizesData as Prize[]);
        }

        // Inicializar mapa con todos los revendedores
        const initialStats: Record<string, ResellerStats> = {};
        resellerNames.forEach((name: string) => {
            initialStats[name] = {
                username: name,
                totalSales: 0,
                totalAmount: 0,
                lastSaleDate: null,
                sales: [],
            };
        });

        // 2. Obtener TODAS las Ventas
        const { data: sales, error } = await supabase
            .from("ventas")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching sales:", error);
            setLoading(false);
            return;
        }

        // Filtrar Ventas basado en Rango de Fechas
        const now = new Date();
        const filteredSales = (sales || []).filter((sale) => {
            const saleDate = new Date(sale.created_at);
            if (dateRange === "all") return true;
            if (dateRange === "this_month") {
                return isAfter(saleDate, startOfMonth(now));
            }
            if (dateRange === "last_month") {
                const startLastMonth = startOfMonth(subMonths(now, 1));
                const endLastMonth = startOfMonth(now);
                return isAfter(saleDate, startLastMonth) && saleDate < endLastMonth;
            }
            if (dateRange === "today") {
                return isAfter(saleDate, startOfDay(now));
            }
            return true;
        });

        // 3. Agrupar ventas con Coincidencia Difusa en Tiempo de Ejecución
        const grouped = filteredSales.reduce((acc, sale) => {
            const clientName = (sale.cliente || "").toLowerCase();

            // Encontrar a qué revendedor pertenece esta venta
            const matchedResellerName = resellerNames.find((rName: string) =>
                clientName.includes(rName.toLowerCase())
            );

            if (matchedResellerName) {
                // ¡Coincide con un revendedor!
                acc[matchedResellerName].totalSales += 1;
                acc[matchedResellerName].totalAmount += sale.precio_total || 0;

                const saleDate = new Date(sale.created_at);
                if (!acc[matchedResellerName].lastSaleDate || saleDate > acc[matchedResellerName].lastSaleDate!) {
                    acc[matchedResellerName].lastSaleDate = saleDate;
                }

                acc[matchedResellerName].sales.push(sale);
            }

            return acc;
        }, initialStats);

        // Convertir a array y ordenar por monto descendente
        const sortedStats = (Object.values(grouped) as ResellerStats[]).sort((a, b) => b.totalAmount - a.totalAmount);

        setStats(sortedStats);
        setLoading(false);
    };

    const handleAwardPrize = async () => {
        const topReseller = stats.length > 0 ? stats[0] : null;
        if (!topReseller) return;
        if (!selectedPrize) {
            toast.error("Por favor selecciona un premio.");
            return;
        }

        setIsAwarding(true);
        const { error } = await supabase.from("premios").insert({
            revendedor_nombre: topReseller.username,
            premio: selectedPrize,
            estado: 'pendiente'
        });

        setIsAwarding(false);

        if (error) {
            toast.error("Error al asignar el premio.");
            console.error(error);
        } else {
            toast.success(`Premio asignado a ${topReseller.username}`);
            setIsAwardDialogOpen(false);
            fetchResellerSales(); // Actualizar para mostrar premio pendiente
        }
    };

    const handleDeliverPrize = async (prizeId: string) => {
        const { error } = await supabase.from("premios").update({
            estado: 'entregado'
        }).eq('id', prizeId);

        if (error) {
            toast.error("Error al marcar como entregado.");
        } else {
            toast.success("Premio marcado como entregado.");
            fetchResellerSales();
        }
    };

    const totalGlobalAmount = stats.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalGlobalCount = stats.reduce((sum, r) => sum + r.totalSales, 0);
    const topReseller = stats.length > 0 ? stats[0] : null;
    const maxRevenue = topReseller ? topReseller.totalAmount : 0;

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
            {/* Sección de Encabezado */}
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                <div className="hidden md:block"></div>
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Panel de Revendedores</h1>
                    <p className="text-muted-foreground">Visión general del rendimiento y ventas.</p>
                </div>
                <div className="flex items-center justify-center md:justify-end gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateRangeOption)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hoy</SelectItem>
                            <SelectItem value="this_month">Este Mes</SelectItem>
                            <SelectItem value="last_month">Mes Pasado</SelectItem>
                            <SelectItem value="all">Todo el Historial</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tarjetas de Métricas Clave */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalGlobalAmount, "ARS", 0)}</div>
                        <p className="text-xs text-muted-foreground">en el periodo seleccionado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalGlobalCount}</div>
                        <p className="text-xs text-muted-foreground">operaciones realizadas</p>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Revendedor Top</CardTitle>
                        <Trophy className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">{topReseller ? topReseller.username : "-"}</div>
                        <p className="text-xs text-muted-foreground mb-3">
                            {topReseller ? formatCurrency(topReseller.totalAmount, "ARS", 0) : "$ 0"}
                        </p>
                        {topReseller && (
                            <Button
                                size="sm"
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => setIsAwardDialogOpen(true)}
                            >
                                <Gift className="w-4 h-4 mr-2" />
                                Premiar Revendedor
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground animate-pulse">Cargando datos...</p>
                </div>
            ) : stats.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/10">
                    <p className="text-muted-foreground">No hay ventas registradas en este periodo.</p>
                </div>
            ) : (
                <>
                    {/* Vista Comparativa */}
                    <Card className="border-none shadow-none bg-transparent md:bg-card md:border md:shadow-sm">
                        <CardHeader className="px-0 md:px-6">
                            <CardTitle>Ranking de Ventas</CardTitle>
                            <CardDescription>Comparativa de ingresos por revendedor</CardDescription>
                        </CardHeader>
                        <CardContent className="px-0 md:px-6">
                            <div className="space-y-4">
                                {stats.map((reseller, index) => (
                                    <div key={reseller.username} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 font-medium">
                                                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${index === 0 ? 'bg-amber-100 text-amber-700' :
                                                    index === 1 ? 'bg-slate-100 text-slate-700' :
                                                        index === 2 ? 'bg-orange-100 text-orange-800' :
                                                            'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                                {reseller.username}
                                            </div>
                                            <div className="text-muted-foreground">
                                                {formatCurrency(reseller.totalAmount, "ARS", 0)}
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${index === 0 ? 'bg-emerald-500' : 'bg-primary/80'
                                                    }`}
                                                style={{ width: `${maxRevenue > 0 ? (reseller.totalAmount / maxRevenue) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Grilla de Revendedores */}
                    <div>
                        <h2 className="text-xl font-bold mb-4">Detalle por Revendedor</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stats.map((reseller) => {
                                const pendingPrize = prizes.find(p => p.revendedor_nombre === reseller.username && p.estado === 'pendiente');

                                return (
                                    <Card key={reseller.username} className="flex flex-col h-full hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-3 border-b bg-muted/20">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        {reseller.username}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs mt-1">
                                                        Última venta: {reseller.lastSaleDate ? new Date(reseller.lastSaleDate).toLocaleDateString() : '-'}
                                                    </CardDescription>
                                                </div>
                                                <Badge variant="outline" className="bg-background">
                                                    {reseller.totalSales} ventas
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-4 flex-1">
                                            <div className="mb-4">
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Generado</p>
                                                <p className="text-2xl font-bold text-primary">
                                                    {formatCurrency(reseller.totalAmount, "ARS", 0)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Ticket promedio: {formatCurrency(reseller.totalSales > 0 ? reseller.totalAmount / reseller.totalSales : 0, "ARS", 0)}
                                                </p>
                                            </div>

                                            {/* Alerta de Premio Pendiente */}
                                            {pendingPrize && (
                                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg animate-pulse">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Gift className="w-4 h-4 text-amber-600" />
                                                        <span className="font-semibold text-sm text-amber-800">¡Premio Pendiente!</span>
                                                    </div>
                                                    <p className="text-sm text-amber-900 font-medium mb-3">{pendingPrize.premio}</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 bg-white"
                                                        onClick={() => handleDeliverPrize(pendingPrize.id)}
                                                    >
                                                        Marcar como Entregado
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="mt-4">
                                                <p className="text-xs font-medium mb-2 text-muted-foreground">Últimas transacciones</p>
                                                <div className="space-y-2">
                                                    {reseller.sales.slice(0, 3).map(sale => (
                                                        <div key={sale.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-secondary/50">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {new Date(sale.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </span>
                                                                {sale.metodo_pago && (
                                                                    <span className="text-[10px] text-muted-foreground/80 font-medium uppercase tracking-wide">
                                                                        {sale.metodo_pago}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="font-mono font-medium">
                                                                {formatCurrency(sale.precio_total, "ARS", 0)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {reseller.sales.length > 3 && (
                                                    <p className="text-center text-xs text-muted-foreground mt-2">
                                                        + {reseller.sales.length - 3} ventas más
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}

            <Dialog open={isAwardDialogOpen} onOpenChange={setIsAwardDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Premiar a {topReseller?.username}</DialogTitle>
                        <DialogDescription>
                            Selecciona un premio para otorgarle al revendedor top de este mes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="prize">Premio</Label>
                            <Select onValueChange={setSelectedPrize} value={selectedPrize}>
                                <SelectTrigger id="prize">
                                    <SelectValue placeholder="Seleccionar premio" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Ganaste un perfume a elección gratis">Perfume a elección gratis</SelectItem>
                                    <SelectItem value="Cupón de 50% de descuento">Cupón de 50% de descuento</SelectItem>
                                    <SelectItem value="Envío gratis en tu próximo pedido">Envío gratis próximo pedido</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAwardDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAwardPrize} disabled={isAwarding || !selectedPrize}>
                            {isAwarding ? "Asignando..." : "Confirmar Premio"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
