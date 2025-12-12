"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, User } from "lucide-react";

interface ResellerSale {
    id: string;
    created_at: string;
    cliente: string;
    cantidad_perfumes: number;
    precio_total: number;
    perfumes: any[];
}

interface ResellerStats {
    username: string;
    totalSales: number;
    totalAmount: number;
    sales: ResellerSale[];
}

export default function VentasRevendedoresPage() {
    const [resellerStats, setResellerStats] = useState<ResellerStats[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchResellerSales();
    }, []);

    const fetchResellerSales = async () => {
        setLoading(true);

        // Fetch all reseller sales
        const { data: sales, error } = await supabase
            .from("ventas")
            .select("*")
            .eq("is_reseller_sale", true)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching reseller sales:", error);
            setLoading(false);
            return;
        }

        // Group sales by cliente (username)
        const grouped = (sales || []).reduce((acc, sale) => {
            const username = sale.cliente;
            if (!acc[username]) {
                acc[username] = {
                    username,
                    totalSales: 0,
                    totalAmount: 0,
                    sales: [],
                };
            }
            acc[username].totalSales += 1;
            acc[username].totalAmount += sale.precio_total || 0;
            acc[username].sales.push(sale);
            return acc;
        }, {} as Record<string, ResellerStats>);

        setResellerStats(Object.values(grouped));
        setLoading(false);
    };

    const totalGlobal = resellerStats.reduce((sum, r) => sum + r.totalAmount, 0);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Ventas Revendedores</h1>
                <Badge variant="default" className="text-lg px-4 py-2">
                    Total: {formatCurrency(totalGlobal, "ARS", 0)}
                </Badge>
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                    Cargando ventas...
                </div>
            ) : resellerStats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No hay ventas de revendedores aún.
                </div>
            ) : (
                <div className="grid gap-6">
                    {resellerStats.map((reseller) => (
                        <Card key={reseller.username}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="h-5 w-5" />
                                        {reseller.username}
                                    </CardTitle>
                                    <div className="flex items-center gap-4">
                                        <Badge variant="secondary">
                                            {reseller.totalSales} venta{reseller.totalSales !== 1 ? "s" : ""}
                                        </Badge>
                                        <Badge variant="default" className="flex items-center gap-1">
                                            <TrendingUp className="h-4 w-4" />
                                            {formatCurrency(reseller.totalAmount, "ARS", 0)}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-center">Cant.</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reseller.sales.map((sale) => (
                                            <TableRow key={sale.id}>
                                                <TableCell className="text-xs">
                                                    {new Date(sale.created_at).toLocaleDateString("es-AR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </TableCell>
                                                <TableCell>{sale.cliente || "-"}</TableCell>
                                                <TableCell className="text-center">
                                                    {sale.cantidad_perfumes}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(sale.precio_total, "ARS", 0)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
