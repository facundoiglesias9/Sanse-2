"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Cell, PieChart, Pie
} from "recharts";
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingBag,
    Calendar, ArrowLeft, Filter, Download
} from "lucide-react";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays, startOfDay, endOfDay, format, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type Venta = {
    id: string;
    created_at: string;
    precio_total: number;
    cliente: string;
};

type Gasto = {
    id: string;
    created_at: string;
    monto: number;
    detalle: string;
};

export default function DashboardPage() {
    const supabase = createClient();
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState("30");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: vData } = await supabase.from("ventas").select("id, created_at, precio_total, cliente");
            const { data: gData } = await supabase.from("gastos").select("id, created_at, monto, detalle");

            setVentas(vData || []);
            setGastos(gData || []);
            setLoading(false);
        };
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        const days = parseInt(dateRange);
        if (isNaN(days)) return { ventas, gastos };

        const start = startOfDay(subDays(new Date(), days));
        const end = endOfDay(new Date());

        return {
            ventas: ventas.filter(v => isWithinInterval(parseISO(v.created_at), { start, end })),
            gastos: gastos.filter(g => isWithinInterval(parseISO(g.created_at), { start, end }))
        };
    }, [ventas, gastos, dateRange]);

    // Procesar datos para gráficos
    const stats = useMemo(() => {
        const totalVentas = filteredData.ventas.reduce((sum, v) => sum + v.precio_total, 0);
        const totalGastos = filteredData.gastos.reduce((sum, g) => sum + g.monto, 0);
        const profit = totalVentas - totalGastos;

        // Agrupar ventas por día
        const daysMap: Record<string, { date: string, ventas: number, gastos: number }> = {};

        filteredData.ventas.forEach(v => {
            const date = format(parseISO(v.created_at), 'dd/MM');
            if (!daysMap[date]) daysMap[date] = { date, ventas: 0, gastos: 0 };
            daysMap[date].ventas += v.precio_total;
        });

        filteredData.gastos.forEach(g => {
            const date = format(parseISO(g.created_at), 'dd/MM');
            if (!daysMap[date]) daysMap[date] = { date, ventas: 0, gastos: 0 };
            daysMap[date].gastos += g.monto;
        });

        const sortedData = Object.values(daysMap).sort((a, b) => {
            const [dayA, monthA] = a.date.split('/').map(Number);
            const [dayB, monthB] = b.date.split('/').map(Number);
            if (monthA !== monthB) return monthA - monthB;
            return dayA - dayB;
        });

        // Top clientes
        const clientMap: Record<string, number> = {};
        filteredData.ventas.forEach(v => {
            const name = v.cliente || "Anonimo";
            clientMap[name] = (clientMap[name] || 0) + v.precio_total;
        });
        const topClients = Object.entries(clientMap)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return { totalVentas, totalGastos, profit, dailyData: sortedData, topClients };
    }, [filteredData]);

    if (loading) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-7xl animate-pulse">
                <div className="h-10 w-48 bg-muted rounded mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Link href="/caja" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Volver a Caja
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard Interactivo</h1>
                    <p className="text-muted-foreground">Análisis de ventas, gastos y rendimiento de Sanse Perfumes.</p>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px] bg-background shadow-sm border-muted-foreground/20">
                            <Calendar className="w-4 h-4 mr-2 opacity-70" />
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Últimos 7 días</SelectItem>
                            <SelectItem value="15">Últimos 15 días</SelectItem>
                            <SelectItem value="30">Últimos 30 días</SelectItem>
                            <SelectItem value="90">Últimos 90 días</SelectItem>
                            <SelectItem value="365">Último año</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Widgets Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-green-500/10 via-background to-background border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                            <TrendingUp className="w-4 h-4" /> Ingresos Totales
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold">{formatCurrency(stats.totalVentas, "ARS", 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Ventas realizadas en el periodo seleccionado.</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-red-500/10 via-background to-background border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                            <TrendingDown className="w-4 h-4" /> Gastos Totales
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold">{formatCurrency(stats.totalGastos, "ARS", 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Total de egresos registrados.</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-blue-500/10 via-background to-background border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                            <DollarSign className="w-4 h-4" /> Balance Neto
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold">{formatCurrency(stats.profit, "ARS", 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Ganancia neta del periodo.</p>
                    </CardContent>
                </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-lg border-muted/20">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Ingresos vs Gastos por Día
                        </CardTitle>
                        <CardDescription>Comparativa diaria de flujo de caja</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="date" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(v: any) => [formatCurrency(Number(v) || 0, "ARS", 0), ""]}
                                />
                                <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas" />
                                <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Gastos" opacity={0.6} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-muted/20">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-amber-500" />
                            Top 5 Clientes/Revendedores
                        </CardTitle>
                        <CardDescription>Clientes con mayor volumen de compra</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={stats.topClients}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                                <XAxis type="number" fontSize={11} hide />
                                <YAxis dataKey="name" type="category" fontSize={11} width={80} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(v: any) => [formatCurrency(Number(v) || 0, "ARS", 0), "Monto Total"]}
                                />
                                <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20}>
                                    {stats.topClients.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`rgba(245, 158, 11, ${1 - index * 0.15})`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-lg border-muted/20">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Historial de Ventas Filtradas</CardTitle>
                        <CardDescription>Detalle de transacciones del periodo</CardDescription>
                    </div>
                    {/* Botón opcional de descarga aquí */}
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-muted/30 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-3 font-medium">Fecha</th>
                                    <th className="text-left p-3 font-medium">Cliente</th>
                                    <th className="text-right p-3 font-medium">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.ventas.slice(0, 10).map((v) => (
                                    <tr key={v.id} className="border-t border-muted/20 hover:bg-muted/10 transition-colors">
                                        <td className="p-3 opacity-70">{format(parseISO(v.created_at), 'dd/MM/yyyy HH:mm')}</td>
                                        <td className="p-3 font-medium">{v.cliente || "Anonimo"}</td>
                                        <td className="p-3 text-right font-bold text-green-600">{formatCurrency(v.precio_total, "ARS", 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredData.ventas.length > 10 && (
                            <div className="p-3 text-center text-xs text-muted-foreground bg-muted/5">
                                Mostrando las últimas 10 ventas de {filteredData.ventas.length} totales.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
