"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
    AreaChart, Area,
    PieChart, Pie
} from "recharts";
import {
    ArrowLeft, Calendar, Package, Users, Layers, TrendingUp, ChevronRight, AlertCircle, Sparkles, Filter
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
import {
    startOfDay, endOfDay, isWithinInterval, parseISO,
    startOfYear, endOfYear, startOfMonth, endOfMonth, subDays
} from "date-fns";

type Venta = {
    id: string;
    created_at: string;
    cliente: string;
    precio_total: number;
    perfumes: string;
    cantidad_perfumes: number;
};

type MetricType = "productos" | "revendedores" | "categorias";

export default function BusinessDashboard() {
    const supabase = createClient();
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [resellers, setResellers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros de Fecha: Año y Mes por separado para máxima flexibilidad
    // Por defecto año actual y mes "todos"
    const currentYear = new Date().getFullYear().toString();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState("all"); // "all" o "0" (Enero) a "11" (Diciembre)

    const [activeMetric, setActiveMetric] = useState<MetricType>("productos");
    const [selectedGender, setSelectedGender] = useState<string>("all");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // 1. Obtener Ventas
            const { data: ventasData } = await supabase
                .from("ventas")
                .select("*")
                .order('created_at', { ascending: false });

            // 2. Obtener Revendedores Oficiales
            const { data: profilesData } = await supabase
                .from("profiles")
                .select("nombre")
                .eq("rol", "revendedor");

            setVentas(ventasData as Venta[] || []);
            // Aseguramos que no haya nulos y mapeamos solo nombres
            setResellers((profilesData || [])
                .map((p: any) => p.nombre)
                .filter((n: any) => typeof n === 'string' && n.length > 0));

            setLoading(false);
        };
        fetchData();
    }, []);

    const cleanName = (name: string) => {
        if (!name) return "Consumidor Final";
        // Si el nombre coincide parcialmente con un revendedor oficial, usamos el nombre del revendedor
        const officialReseller = resellers.find(r => name.toLowerCase().includes(r.toLowerCase()));
        if (officialReseller) return officialReseller;

        return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    // Parser inteligente para extraer solo el nombre del producto y su cantidad
    const parseProductItem = (itemStr: string) => {
        let name = itemStr.trim();
        let quantity = 1;

        const qtyMatch = name.match(/\s+x\s+(\d+)/i);
        if (qtyMatch) {
            quantity = parseInt(qtyMatch[1]);
            name = name.replace(qtyMatch[0], "");
        }

        name = name.replace(/\[\$.*?\]/g, "");
        name = name.replace(/\s+-\s+(femenino|masculino|unisex)/i, "");
        name = name.trim();

        if (!name) name = itemStr.split(' x ')[0] || itemStr;

        return { name, quantity };
    };

    const dashboardData = useMemo(() => {
        let start: Date;
        let end: Date;

        const year = parseInt(selectedYear);

        if (selectedMonth === "all") {
            // Año completo
            start = startOfYear(new Date(year, 0, 1));
            end = endOfYear(new Date(year, 11, 31));
        } else {
            // Mes específico del año seleccionado
            const month = parseInt(selectedMonth);
            start = startOfMonth(new Date(year, month, 1));
            end = endOfMonth(new Date(year, month, 1));
        }

        const filtered = ventas.filter(v => {
            const dateObj = parseISO(v.created_at);
            const dateMatch = isWithinInterval(dateObj, { start, end });
            const notTest = !v.cliente?.toLowerCase().includes("prueba") && !v.cliente?.toLowerCase().includes("test");
            return dateMatch && notTest;
        });

        const productMap: Record<string, { name: string, quantity: number, revenue: number }> = {};
        const resellerMap: Record<string, { name: string, revenue: number, count: number }> = {};
        const categoryMap: Record<string, { name: string, quantity: number, revenue: number }> = {};

        filtered.forEach(v => {
            const clientNameRaw = v.cliente || "";
            // Verificar si es un revendedor oficial
            const isOfficialReseller = resellers.some(r => clientNameRaw.toLowerCase().includes(r.toLowerCase()));

            // Solo agregar al mapa de revendedores SI ES un revendedor oficial
            if (isOfficialReseller) {
                const client = cleanName(clientNameRaw);
                if (!resellerMap[client]) resellerMap[client] = { name: client, revenue: 0, count: 0 };
                resellerMap[client].revenue += v.precio_total;
                resellerMap[client].count += 1;
            }

            if (v.perfumes) {
                const itemsRaw = v.perfumes.includes(';') ? v.perfumes.split(';') : v.perfumes.split(',');
                const items = itemsRaw.map(i => i.trim()).filter(Boolean);
                const avgPricePerUnit = items.length > 0 ? (v.precio_total / v.cantidad_perfumes) : 0; // Usar cantidad total para el promedio

                items.forEach(itemStr => {
                    const { name, quantity } = parseProductItem(itemStr);

                    if (selectedGender !== "all") {
                        const lowItem = itemStr.toLowerCase();
                        if (selectedGender === "H" && !lowItem.includes(" hombre") && !lowItem.includes(" (h)") && !lowItem.includes(" masculin")) return;
                        if (selectedGender === "M" && !lowItem.includes(" mujer") && !lowItem.includes(" (m)") && !lowItem.includes(" femeni")) return;
                        if (selectedGender === "U" && !lowItem.includes(" unisex") && !lowItem.includes(" (u)")) return;
                    }

                    if (!productMap[name]) productMap[name] = { name: name, quantity: 0, revenue: 0 };
                    productMap[name].quantity += quantity;
                    productMap[name].revenue += (avgPricePerUnit * quantity);

                    let cat = "Perfumería Fina";
                    const low = name.toLowerCase();
                    if (low.includes("limpia pisos") || low.includes("pisos")) cat = "Limpia Pisos";
                    else if (low.includes("aromatizante") || low.includes("aroma")) cat = "Aromatizantes";
                    else if (low.includes("textil")) cat = "Textiles";

                    if (!categoryMap[cat]) categoryMap[cat] = { name: cat, revenue: 0, quantity: 0 };
                    categoryMap[cat].revenue += (avgPricePerUnit * quantity);
                    categoryMap[cat].quantity += quantity;
                });
            }
        });

        return {
            topProducts: Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
            topResellers: Object.values(resellerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
            topCategories: Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue),
            totalRevenue: filtered.reduce((acc, v) => acc + v.precio_total, 0),
            totalSales: filtered.reduce((acc, v) => acc + v.cantidad_perfumes, 0)
        };
    }, [ventas, selectedYear, selectedMonth, selectedGender, resellers]);

    if (loading) {
        return (
            <div className="container mx-auto py-12 px-6 max-w-7xl animate-pulse">
                <Skeleton className="h-16 w-1/3 rounded-2xl mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-3xl" />)}
                </div>
                <Skeleton className="h-[500px] w-full rounded-[2.5rem]" />
            </div>
        );
    }

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 transition-colors duration-500">
            <div className="container mx-auto py-12 px-6 max-w-7xl space-y-12">

                {/* Header Centered */}
                <div className="flex flex-col items-center justify-center gap-6 text-center">
                    <div className="w-full flex justify-start">
                        <Link href="/caja" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Volver a Caja
                        </Link>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-6xl font-black tracking-tighter capitalize">
                            Dashboard
                        </h1>
                        <p className="text-slate-400 font-medium">Análisis basado en volumen y facturación real.</p>
                    </div>

                    <div className="flex flex-wrap gap-3 bg-white dark:bg-zinc-900 p-2 rounded-3xl shadow-xl border dark:border-zinc-800">
                        <Select value={selectedGender} onValueChange={setSelectedGender}>
                            <SelectTrigger className="w-[140px] border-none focus:ring-0 font-bold text-sm">
                                <Filter className="w-4 h-4 mr-2 text-indigo-500" />
                                <SelectValue placeholder="Género" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="M">Mujer</SelectItem>
                                <SelectItem value="H">Hombre</SelectItem>
                                <SelectItem value="U">Unisex</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[140px] border-none focus:ring-0 font-bold text-sm">
                                <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl h-[300px]">
                                <SelectItem value="all">Todo el Año</SelectItem>
                                <SelectItem value="0">Enero</SelectItem>
                                <SelectItem value="1">Febrero</SelectItem>
                                <SelectItem value="2">Marzo</SelectItem>
                                <SelectItem value="3">Abril</SelectItem>
                                <SelectItem value="4">Mayo</SelectItem>
                                <SelectItem value="5">Junio</SelectItem>
                                <SelectItem value="6">Julio</SelectItem>
                                <SelectItem value="7">Agosto</SelectItem>
                                <SelectItem value="8">Septiembre</SelectItem>
                                <SelectItem value="9">Octubre</SelectItem>
                                <SelectItem value="10">Noviembre</SelectItem>
                                <SelectItem value="11">Diciembre</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px] border-none focus:ring-0 font-bold text-sm">
                                <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Widgets */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border-none shadow-2xl bg-white dark:bg-zinc-900/40 rounded-[2rem] p-8 space-y-2 group hover:scale-[1.02] transition-transform">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Facturación Total</p>
                        <h3 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {formatCurrency(dashboardData.totalRevenue, "ARS", 0)}
                        </h3>
                    </Card>
                    <Card className="border-none shadow-2xl bg-white dark:bg-zinc-900/40 rounded-[2rem] p-8 space-y-2 hover:scale-[1.02] transition-transform">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Items Vendidos</p>
                        <h3 className="text-4xl font-black font-mono">{dashboardData.totalSales}</h3>
                    </Card>
                    <Card className="border-none shadow-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-[2rem] p-8 space-y-2 overflow-hidden relative">
                        <Users className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">Top Revendedor</p>
                        <h3 className="text-xl font-black truncate">{dashboardData.topResellers[0]?.name || "N/A"}</h3>
                    </Card>
                    <Card className="border-none shadow-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-[2rem] p-8 space-y-2 overflow-hidden relative">
                        <Sparkles className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">Best Seller</p>
                        <h3 className="text-xl font-black truncate">{dashboardData.topProducts[0]?.name || "N/A"}</h3>
                    </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900/50 p-3 rounded-[2.5rem] border dark:border-zinc-800 shadow-2xl flex flex-col gap-2">
                            {(["productos", "revendedores", "categorias"] as MetricType[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setActiveMetric(m)}
                                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] transition-all ${activeMetric === m
                                        ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-500/20 scale-[1.03]"
                                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                                        }`}
                                >
                                    <div className="flex items-center gap-4 font-black capitalize text-lg">
                                        {m === "productos" && <Package className="w-6 h-6" />}
                                        {m === "revendedores" && <Users className="w-6 h-6" />}
                                        {m === "categorias" && <Layers className="w-6 h-6" />}
                                        {m}
                                    </div>
                                    <ChevronRight className={`w-5 h-5 transition-transform ${activeMetric === m ? "rotate-90" : ""}`} />
                                </button>
                            ))}
                        </div>

                        <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border dark:border-zinc-800 shadow-2xl space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ranking por {activeMetric === "productos" ? "Volumen" : "Facturación"}</h4>
                            <div className="space-y-5">
                                {(activeMetric === "productos" ? dashboardData.topProducts :
                                    activeMetric === "revendedores" ? dashboardData.topResellers :
                                        dashboardData.topCategories).map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                    <span className="font-bold text-sm truncate max-w-[160px]">{item.name}</span>
                                                </div>
                                                <span className="text-[10px] font-black opacity-30 group-hover:opacity-100 transition-opacity">
                                                    {activeMetric === "productos" ? `${(item as any).quantity} u.` : formatCurrency(item.revenue, "ARS", 0)}
                                                </span>
                                            </div>
                                        ))}
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-2">
                        <Card className="h-full border-none shadow-2xl bg-white dark:bg-zinc-900/50 rounded-[3rem] p-12 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none">
                                <TrendingUp className="w-[30rem] h-[30rem]" />
                            </div>

                            <div className="relative z-10 h-full flex flex-col">
                                <div className="mb-12">
                                    <h2 className="text-4xl font-black capitalize">
                                        {activeMetric === "productos" ? "Ranking de Volumen" : `Impacto de ${activeMetric}`}
                                    </h2>
                                    <p className="text-slate-400 font-medium whitespace-pre-wrap">
                                        {activeMetric === "productos"
                                            ? "Top 10 perfumes más vendidos por cantidad de unidades."
                                            : `Distribución de ingresos reales por ${activeMetric}.`}
                                    </p>
                                </div>

                                <div className="flex-1 min-h-[500px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {activeMetric === "productos" ? (
                                            <BarChart data={dashboardData.topProducts} layout="vertical" margin={{ left: 20 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" fontSize={11} width={180} tick={{ fontWeight: 800 }} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload?.[0]) {
                                                            return (
                                                                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-2xl border dark:border-zinc-700">
                                                                    <p className="font-black text-indigo-500 text-lg">{payload[0].value} unidades</p>
                                                                    <p className="text-[10px] font-bold opacity-30 italic">Nombre: {payload[0].payload.name}</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="quantity" radius={[0, 15, 15, 0]} barSize={34}>
                                                    {dashboardData.topProducts.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        ) : activeMetric === "revendedores" ? (
                                            <AreaChart data={dashboardData.topResellers} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                                <defs>
                                                    <linearGradient id="gradientRev" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 800 }} interval={0} angle={-15} textAnchor="end" />
                                                <YAxis hide />
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload?.[0]) {
                                                            return (
                                                                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-2xl border dark:border-zinc-700">
                                                                    <p className="font-black text-indigo-500 text-lg">{formatCurrency(payload[0].value as number, "ARS", 0)}</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={6} fillOpacity={1} fill="url(#gradientRev)" />
                                            </AreaChart>
                                        ) : (
                                            <PieChart>
                                                <Pie
                                                    data={dashboardData.topCategories}
                                                    innerRadius={130}
                                                    outerRadius={180}
                                                    paddingAngle={12}
                                                    dataKey="revenue"
                                                    nameKey="name"
                                                    stroke="none"
                                                >
                                                    {dashboardData.topCategories.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload?.[0]) {
                                                            return (
                                                                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-2xl border dark:border-zinc-700">
                                                                    <p className="font-black text-indigo-500 text-lg">{formatCurrency(payload[0].value as number, "ARS", 0)}</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontWeight: 900, fontSize: '13px', paddingTop: '40px' }} />
                                            </PieChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>

                                {dashboardData.totalRevenue === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-md rounded-[3rem] z-20">
                                        <AlertCircle className="w-16 h-16 text-slate-400 mb-4" />
                                        <p className="font-black text-2xl text-slate-500 text-center uppercase tracking-tighter">Sin datos</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}


