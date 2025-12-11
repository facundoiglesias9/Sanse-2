"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { formatDate } from "@/app/helpers/formatDate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Gasto = {
    id: string;
    detalle: string;
    monto: number;
    pagador_id: string | null;
    created_at: Date;
};

type Deuda = {
    id: string;
    detalle: string;
    monto: number;
    acreedor_id: string;
    created_at: Date;
    updated_at: Date;
};

type Venta = {
    id: string;
    precio_total: number;
    created_at: Date;
};

type Profile = {
    id: string;
    nombre: string;
};

type UnifiedExpense = {
    id: string;
    detalle: string;
    monto: number;
    pagador: string;
    tipo: "Gasto" | "Deuda Activa";
    created_at: Date;
    source: "gasto" | "deuda";
};

export default function Caja2Page() {
    const supabase = createClient();

    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [deudas, setDeudas] = useState<Deuda[]>([]);
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [profiles, setProfiles] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [detalle, setDetalle] = useState("");
    const [monto, setMonto] = useState<number>(0);
    const [pagadorId, setPagadorId] = useState<string>("sanse");

    // Settlement dialog state
    const [saldarDialogOpen, setSaldarDialogOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<UnifiedExpense | null>(null);
    const [montoSaldar, setMontoSaldar] = useState<number>(0);

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [gastoToDelete, setGastoToDelete] = useState<string | null>(null);

    // Pagination state
    const [visibleSalesCount, setVisibleSalesCount] = useState(10);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch profiles
        const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, nombre");

        const profilesMap: Record<string, string> = {};
        (profilesData || []).forEach((p: Profile) => {
            profilesMap[p.id] = p.nombre;
        });
        setProfiles(profilesMap);

        // Fetch gastos
        const { data: gastosData } = await supabase
            .from("gastos")
            .select("*")
            .order("created_at", { ascending: false });
        setGastos(gastosData || []);

        // Fetch deudas
        const { data: deudasData } = await supabase
            .from("deudas")
            .select("*")
            .order("created_at", { ascending: false });
        setDeudas(deudasData || []);

        // Fetch ventas
        const { data: ventasData } = await supabase
            .from("ventas")
            .select("*")
            .order("created_at", { ascending: false });
        setVentas(ventasData || []);

        setLoading(false);
    };

    const handleAddGasto = async () => {
        if (!detalle.trim() || monto <= 0) {
            toast.error("Completá todos los campos");
            return;
        }

        const { error } = await supabase.from("gastos").insert({
            detalle,
            monto,
            pagador_id: pagadorId === "sanse" ? null : pagadorId,
            created_at: new Date(),
        });

        if (error) {
            toast.error("Error al agregar gasto");
            return;
        }

        toast.success("Gasto agregado correctamente");
        setDialogOpen(false);
        setDetalle("");
        setMonto(0);
        setPagadorId("sanse");
        fetchData();
    };

    const handleDeleteGasto = (id: string) => {
        setGastoToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteGasto = async () => {
        if (!gastoToDelete) return;

        const { error } = await supabase.from("gastos").delete().eq("id", gastoToDelete);
        if (error) {
            toast.error("Error al eliminar gasto");
            return;
        }
        toast.success("Gasto eliminado");
        setDeleteDialogOpen(false);
        setGastoToDelete(null);
        fetchData();
    };

    const handleSaldar = (expense: UnifiedExpense) => {
        setSelectedExpense(expense);
        setMontoSaldar(expense.monto);
        setSaldarDialogOpen(true);
    };

    const handleConfirmSaldar = async () => {
        if (!selectedExpense || montoSaldar <= 0) {
            toast.error("Monto inválido");
            return;
        }

        console.log("💰 Intentando saldar:", {
            detalle: selectedExpense.detalle,
            pagador: selectedExpense.pagador,
            monto: montoSaldar,
            montoType: typeof montoSaldar
        });

        console.log("👥 Profiles disponibles:", profiles);

        // Find the acreedor ID based on the pagador name
        const acreedorId = Object.entries(profiles).find(
            ([id, nombre]) => nombre.toLowerCase().includes(selectedExpense.pagador.toLowerCase())
        )?.[0];

        console.log("🔍 Acreedor encontrado:", acreedorId);

        if (!acreedorId) {
            console.error("❌ No se encontró acreedor para:", selectedExpense.pagador);
            toast.error(`No se pudo encontrar el inversor: ${selectedExpense.pagador}`);
            return;
        }

        // Create TWO expenses:
        // 1. Positive expense paid by Sanse (money going out)
        const { error: error1 } = await supabase.from("gastos").insert({
            detalle: `pago deuda a: ${selectedExpense.pagador}`,
            monto: montoSaldar,
            pagador_id: null, // Sanse (common fund)
            created_at: new Date().toISOString(),
        });

        if (error1) {
            console.error("❌ Error al crear gasto de Sanse:", error1);
            toast.error(`Error al saldar: ${error1.message}`);
            return;
        }

        // 2. Negative expense for the acreedor to reduce their investment
        const { error: error2 } = await supabase.from("gastos").insert({
            detalle: `cobro deuda desde Sanse`,
            monto: -montoSaldar, // NEGATIVE to reduce their balance
            pagador_id: acreedorId,
            created_at: new Date().toISOString(),
        });

        if (error2) {
            console.error("❌ Error al crear gasto negativo:", error2);
            toast.error(`Error al descontar inversión: ${error2.message}`);
            return;
        }

        toast.success("Saldado correctamente desde caja Sanse");
        setSaldarDialogOpen(false);
        setSelectedExpense(null);
        setMontoSaldar(0);
        fetchData();
    };

    // Unify gastos and deudas
    const unifiedExpenses: UnifiedExpense[] = [
        ...gastos.map((g) => ({
            id: g.id,
            detalle: g.detalle,
            monto: g.monto,
            pagador: g.pagador_id ? profiles[g.pagador_id] || "?" : "Sanse",
            tipo: "Gasto" as const,
            created_at: g.created_at,
            source: "gasto" as const,
        })),
        ...deudas.map((d) => ({
            id: d.id,
            detalle: d.detalle,
            monto: d.monto,
            pagador: profiles[d.acreedor_id] || "?",
            tipo: "Deuda Activa" as const,
            created_at: d.created_at,
            source: "deuda" as const,
        })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calculate widgets
    const profileIds = Object.keys(profiles);
    const facundoId = profileIds.find((id) => profiles[id].toLowerCase().includes("facundo"));
    const lukasId = profileIds.find((id) => profiles[id].toLowerCase().includes("lukas"));

    console.log("🔍 Debug - Profiles:", profiles);
    console.log("🔍 Debug - Facundo ID:", facundoId);
    console.log("🔍 Debug - Lukas ID:", lukasId);

    // Facundo: gastos que pagó + deudas donde él es acreedor
    const totalFacundo =
        gastos.filter((g) => g.pagador_id === facundoId).reduce((sum, g) => sum + g.monto, 0) +
        deudas.filter((d) => d.acreedor_id === facundoId).reduce((sum, d) => sum + d.monto, 0);

    // Lukas: gastos que pagó + deudas donde él es acreedor
    const totalLukas =
        gastos.filter((g) => g.pagador_id === lukasId).reduce((sum, g) => sum + g.monto, 0) +
        deudas.filter((d) => d.acreedor_id === lukasId).reduce((sum, d) => sum + d.monto, 0);

    const gastosSanse = gastos
        .filter((g) => !g.pagador_id)
        .reduce((sum, g) => sum + g.monto, 0);

    const totalVentas = ventas.reduce((sum, v) => sum + v.precio_total, 0);
    const cajaSanse = totalVentas - gastosSanse;

    console.log("💰 Debug - Total Facundo:", totalFacundo);
    console.log("💰 Debug - Total Lukas:", totalLukas);
    console.log("💰 Debug - Caja Sanse:", cajaSanse);

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <h1 className="text-3xl font-bold mb-8">Caja Unificada</h1>

            {/* Widgets Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            Facundo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(totalFacundo, "ARS", 2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">Total invertido</p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setSelectedExpense({
                                    id: 'facundo-settlement',
                                    detalle: 'Inversión de Facundo',
                                    monto: totalFacundo,
                                    pagador: 'Facundo',
                                    tipo: 'Gasto',
                                    created_at: new Date(),
                                    source: 'gasto'
                                });
                                setMontoSaldar(totalFacundo);
                                setSaldarDialogOpen(true);
                            }}
                        >
                            Saldar
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            Lukas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {formatCurrency(totalLukas, "ARS", 2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">Total invertido</p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setSelectedExpense({
                                    id: 'lukas-settlement',
                                    detalle: 'Inversión de Lukas',
                                    monto: totalLukas,
                                    pagador: 'Lukas',
                                    tipo: 'Gasto',
                                    created_at: new Date(),
                                    source: 'gasto'
                                });
                                setMontoSaldar(totalLukas);
                                setSaldarDialogOpen(true);
                            }}
                        >
                            Saldar
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-green-500" />
                            Sanse (Caja Común)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${cajaSanse >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(cajaSanse, "ARS", 2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Saldo neto</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ganancias */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            Ganancias (Ventas)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <div className="text-3xl font-bold text-green-600">
                                {formatCurrency(totalVentas, "ARS", 0)}
                            </div>
                            <p className="text-sm text-muted-foreground">Total de ventas</p>
                        </div>
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
                                {ventas.slice(0, visibleSalesCount).map((venta) => (
                                    <TableRow key={venta.id}>
                                        <TableCell className="text-xs">
                                            {formatDate(new Date(venta.created_at))}
                                        </TableCell>
                                        <TableCell>{(venta as any).cliente || "-"}</TableCell>
                                        <TableCell className="text-center">
                                            {(venta as any).cantidad_perfumes || "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCurrency(venta.precio_total, "ARS", 0)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {ventas.length > visibleSalesCount && (
                            <div className="mt-4 text-center">
                                <p className="text-xs text-muted-foreground mb-2">
                                    Mostrando {Math.min(visibleSalesCount, ventas.length)} de {ventas.length} ventas
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setVisibleSalesCount(prev => prev + 10)}
                                    className="text-xs text-primary hover:underline hover:bg-transparent"
                                >
                                    Cargar más →
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Gastos (Unified Table) */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-red-500" />
                            Gastos y Deudas
                        </CardTitle>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Agregar Gasto
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Agregar Gasto</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <label className="text-sm font-medium">Detalle</label>
                                        <Input
                                            value={detalle}
                                            onChange={(e) => setDetalle(e.target.value)}
                                            placeholder="Descripción del gasto"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Monto</label>
                                        <NumberInput
                                            value={monto}
                                            onValueChange={(v) => setMonto(v ?? 0)}
                                            placeholder="0,00"
                                            decimalScale={2}
                                            thousandSeparator="."
                                            decimalSeparator=","
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Pagador</label>
                                        <Select value={pagadorId} onValueChange={setPagadorId}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sanse">Sanse (Caja Común)</SelectItem>
                                                {Object.entries(profiles).map(([id, nombre]) => (
                                                    <SelectItem key={id} value={id}>
                                                        {nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                                            Cancelar
                                        </Button>
                                        <Button onClick={handleAddGasto}>Agregar</Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Detalle</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Pagador</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {unifiedExpenses.slice(0, 10).map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.detalle}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCurrency(item.monto, "ARS", 2)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`
                                                    ${item.pagador.toLowerCase().includes('facundo') ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                    ${item.pagador.toLowerCase().includes('lukas') ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                                                    ${item.pagador.toLowerCase() === 'sanse' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                `}
                                            >
                                                {item.pagador}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {item.source === "gasto" && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteGasto(item.id)}
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {unifiedExpenses.length > 10 && (
                            <p className="text-xs text-muted-foreground mt-4 text-center">
                                Mostrando los últimos 10 items
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Settlement Dialog */}
            <Dialog open={saldarDialogOpen} onOpenChange={setSaldarDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Saldar Gasto/Deuda</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">
                                Gasto: <span className="font-semibold">{selectedExpense?.detalle}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Pagó: <span className="font-semibold">{selectedExpense?.pagador}</span>
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Monto a devolver</label>
                            <NumberInput
                                value={montoSaldar}
                                onValueChange={(v) => setMontoSaldar(v ?? 0)}
                                placeholder="0,00"
                                decimalScale={2}
                                thousandSeparator="."
                                decimalSeparator=","
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                La caja de Sanse pagará este monto
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setSaldarDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmSaldar}>Confirmar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El gasto será eliminado permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteGasto}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
