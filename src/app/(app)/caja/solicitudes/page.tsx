"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Package, Truck, Clock, RotateCcw, Trash2 } from "lucide-react";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { formatDate } from "@/app/helpers/formatDate";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { deductStockForSale, getPerfumesDetails } from "@/app/actions/inventory-actions";

type Solicitud = {
    id: string;
    created_at: string;
    cliente: string;
    detalle: string;
    items: any[];
    total: number;
    estado: 'pendiente' | 'en_preparacion' | 'preparado' | 'rechazado' | 'entregado' | 'cancelado';
    metodo_pago: string;
    motivo?: string;
};

export default function SolicitudesPage() {
    const supabase = createClient();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [proveedores, setProveedores] = useState<any[]>([]); // Lista de proveedores
    const [_loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedSolicitud, setSelectedSolicitud] = useState<{ id: string, status: 'rechazado' | 'cancelado'; } | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('rol, nombre')
                    .eq('id', session.user.id)
                    .single();

                const role = (profile?.rol || session.user.user_metadata?.rol || "revendedor").toLowerCase();

                // Resolución de nombre
                let resolvedName = profile?.nombre;
                if (!resolvedName) {
                    const meta = session.user.user_metadata;
                    resolvedName = meta?.nombre || meta?.full_name || meta?.name || session.user.email || "";
                }

                setUserRole(role);
                setUserName(resolvedName);
            } else {
                setLoading(false); // No session
            }
        };

        init();
        fetchProveedores();

        // Suscripción a cambios en tiempo real
        const channel = supabase
            .channel('solicitudes_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' }, () => {
                // Necesitamos el rol y nombre actualizados para refrescar correctamente
                // Como es closure, mejor llamar a una función que use refs o depender de deps
                // Por simplicidad, recargaremos detectando el cambio en otro efecto o forzando flag
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Efecto para cargar y recargar solicitudes cuando cambia el usuario o señal externa
    useEffect(() => {
        if (userRole) {
            fetchSolicitudes();

            // Re-bind subscription with access to current state if needed, 
            // but simpler to just listen globally and re-fetch using current state in a ref or simply re-fetch
            const channel = supabase
                .channel('solicitudes_changes_refetch')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' }, () => {
                    fetchSolicitudes();
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [userRole, userName]);

    const fetchSolicitudes = async () => {
        if (!userRole) return;

        setLoading(true);
        let query = supabase
            .from("solicitudes")
            .select("*")
            .order("created_at", { ascending: false });

        // Filtra por rol (si no es admin, ej: comprador/revendedor)
        if (userRole !== 'admin' && userName) {
            query = query.ilike('cliente', userName);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching solicitudes:", error);
            toast.error("Error al cargar solicitudes");
        } else {
            setSolicitudes(data as Solicitud[]);
        }
        setLoading(false);
    };

    const fetchProveedores = async () => {
        const { data } = await supabase.from("proveedores").select("id, nombre");
        if (data) setProveedores(data);
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        if (newStatus === 'rechazado' || newStatus === 'cancelado') {
            setSelectedSolicitud({ id, status: newStatus as any });
            setRejectionReason("");
            setIsDialogOpen(true);
            return;
        }
        await executeStatusUpdate(id, newStatus as any);
    };

    const executeStatusUpdate = async (id: string, nuevoEstado: Solicitud['estado'], motivo: string = "") => {
        // Optimistic Update
        setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: nuevoEstado, motivo } : s));

        if (nuevoEstado === "entregado") {
            await handleEntregar(id);
            return;
        }

        const updateData: any = { estado: nuevoEstado };
        if (motivo) updateData.motivo = motivo;

        const { error } = await supabase
            .from("solicitudes")
            .update(updateData)
            .eq("id", id);

        if (error) {
            console.error("Error updating status:", error);
            toast.error("Error al actualizar estado");
            fetchSolicitudes();
        } else {
            const action = nuevoEstado === 'rechazado' ? 'rechazada' : nuevoEstado === 'cancelado' ? 'cancelada' : 'actualizada';
            toast.success(`Solicitud ${action} correctamente`);
        }
    };

    const handleConfirmRejection = async () => {
        if (!selectedSolicitud) return;
        await executeStatusUpdate(selectedSolicitud.id, selectedSolicitud.status, rejectionReason);
        setIsDialogOpen(false);
    };

    const handleEntregar = async (id: string) => {
        // Fetch solicitud (items is stored in a JSON column)
        const { data: solicitudBasic, error: fetchError } = await supabase
            .from("solicitudes")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !solicitudBasic) {
            console.error("Error fetching delivery details:", fetchError);
            toast.error("Error al procesar entrega: " + (fetchError?.message || ""));
            return;
        }

        // Items are stored in JSON column
        const rawItems = Array.isArray(solicitudBasic.items) ? solicitudBasic.items : [];

        // Manual Enrich (Fetch related real-time data using IDs from the JSON)
        // Check for ID at root or nested object (defensive programming)
        const perfumeIds = rawItems.map((i: any) => i.perfume_id || i.perfume?.id).filter(Boolean);
        const catIds = rawItems.map((i: any) => i.insumos_categorias_id || i.insumos_categorias?.id).filter(Boolean);

        let perfumesMap: Record<string, any> = {};
        let providersMap: Record<string, string> = {};
        let categoriesMap: Record<string, string> = {};

        // Fetch Perfumes & Providers
        if (perfumeIds.length > 0) {
            // Use Server Action to fetch details (bypassing client-side 404/RLS issues)
            const perfumesData = await getPerfumesDetails(perfumeIds);

            if (perfumesData && perfumesData.length > 0) {
                perfumesMap = perfumesData.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
                const providerIds = perfumesData.map((p: any) => p.proveedor_id).filter(Boolean);
                if (providerIds.length > 0) {
                    const { data: provData } = await supabase.from("proveedores").select("id, nombre").in("id", providerIds);
                    if (provData) {
                        providersMap = provData.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.nombre }), {});
                    }
                }
            }
        }

        // Fetch Categories
        if (catIds.length > 0) {
            const { data: catData } = await supabase.from("insumos_categorias").select("id, nombre").in("id", catIds);
            if (catData) {
                categoriesMap = catData.reduce((acc, c) => ({ ...acc, [c.id]: c.nombre }), {});
            }
        }

        // Enrich Items merging fresh DB data with JSON data
        const enrichedItems = rawItems.map((item: any) => {
            const pId = item.perfume_id || item.perfume?.id;
            const cId = item.insumos_categorias_id || item.insumos_categorias?.id;

            const perf = pId ? perfumesMap[pId] : (item.perfume || {});
            // Fallback to what's in JSON if DB fetch fails or null, 
            // but prioritize fresh DB data structure which has 'proveedor_id'

            const pProvId = perf?.proveedor_id;
            const provName = pProvId ? providersMap[pProvId] : (item.proveedores?.nombre || "Sin proveedor");
            const catName = cId ? categoriesMap[cId] : (item.insumos_categorias?.nombre || item.categoria || null);

            return {
                ...item,
                perfume: perf,
                proveedores: { nombre: provName },
                insumos_categorias: catName ? { nombre: catName } : null,
                // Ensure helper fields exist for rule engine
                genero: perf?.genero || item.genero || "",
                nombre: perf?.nombre || item.nombre || ""
            };
        });

        const solicitud = { ...solicitudBasic, items: enrichedItems };

        // Optimistic Update
        setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: "entregado" } : s));

        // Calcular cantidad total
        const cantidadTotal = Array.isArray(solicitud.items)
            ? solicitud.items.reduce((acc: number, item: any) => acc + (item.cantidad || 0), 0)
            : 0;

        const { error: saleError } = await supabase.from("ventas").insert({
            created_at: new Date(),
            cliente: solicitud.cliente,
            cantidad_perfumes: Math.round(cantidadTotal),
            precio_total: Math.round(solicitud.total),
            perfumes: solicitud.detalle,
            is_reseller_sale: true,
            metodo_pago: solicitud.metodo_pago
        });

        if (saleError) {
            toast.error("Error al registrar venta: " + saleError.message);
            fetchSolicitudes(); // Revertir
            return;
        }

        // Deduct Stock
        if (Array.isArray(solicitud.items)) {
            toast.loading("Actualizando inventario...", { id: "stock-update" });
            const saleItems = solicitud.items.map((i: any) => {
                // Resolve Provider Name
                let provName = "Sin proveedor";
                if (i.proveedores?.nombre && i.proveedores.nombre !== '-') {
                    provName = i.proveedores.nombre;
                } else if (i.perfume?.proveedor_id) {
                    provName = proveedores.find(p => p.id === i.perfume.proveedor_id)?.nombre || "Sin proveedor";
                }

                // Resolve Category
                let category = "";
                if (i.insumos_categorias?.nombre) category = i.insumos_categorias.nombre;
                else if (i.perfume?.categoria) category = i.perfume.categoria;
                else if (i.categoria) category = i.categoria;

                // Detect Bottle Return
                let bType = i.envase || i.frascoLP || "";
                let isReturned = i.devolvio_envase === true;

                if (typeof bType === 'string' && bType.toLowerCase().includes('devolvi')) {
                    isReturned = true;
                    // Clean the string so rule matches "Botella (1L)" instead of "Botella (1L) (devolvió...)"
                    bType = bType.replace(/\s*\(devolvi.*?\)/i, '').replace(' - ', '').trim();
                }

                return {
                    perfumeName: i.perfume?.nombre || i.nombre || "Desconocido",
                    gender: i.genero || "",
                    quantity: i.cantidad || 1,
                    category: category,
                    provider: provName,
                    bottleType: bType,
                    returnedBottle: isReturned
                };
            });

            const { success, logs, message } = await deductStockForSale(saleItems);

            if (success) {
                if (logs && logs.length > 0) {
                    toast.success("Inventario actualizado", { id: "stock-update" });
                } else {
                    toast.success("Venta registrada (Sin descuentos de stock)", { id: "stock-update" });
                }
            } else {
                console.error("Inventario error:", message);
                toast.error("Venta OK, pero falló inventario: " + message, { id: "stock-update" });
            }
        };

        const { error: updateError } = await supabase
            .from("solicitudes")
            .update({ estado: "entregado" })
            .eq("id", id);

        if (updateError) {
            toast.error("Venta OK pero error al actualizar solicitud");
        } else {
            toast.success("Pedido entregado y venta registrada");
        }
    };

    // Agrupar por estado

    const pendientes = solicitudes.filter(s => s.estado === "pendiente");
    const enPreparacion = solicitudes.filter(s => s.estado === "en_preparacion");
    const preparados = solicitudes.filter(s => s.estado === "preparado");
    const entregados = solicitudes.filter(s => s.estado === "entregado");
    const rechazados = solicitudes.filter(s => s.estado === "rechazado");
    const cancelados = solicitudes.filter(s => s.estado === "cancelado");

    const RenderCard = ({ solicitud }: { solicitud: Solicitud; }) => (
        <motion.div
            layout
            layoutId={solicitud.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
        >
            <Card className="mb-4 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-bold">{solicitud.cliente}</CardTitle>
                        <Badge variant={
                            solicitud.estado === 'pendiente' ? 'secondary' :
                                solicitud.estado === 'en_preparacion' ? 'default' :
                                    solicitud.estado === 'preparado' ? 'outline' : 'secondary'
                        }>
                            {formatCurrency(solicitud.total, "ARS", 0)}
                        </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatDate(new Date(solicitud.created_at))}
                        • {solicitud.metodo_pago}
                    </div>
                </CardHeader>
                <CardContent className="pb-2">
                    <div className="space-y-2 mt-2">
                        {Array.isArray(solicitud.items) ? (
                            solicitud.items.map((item: any, idx: number) => {
                                const provName = proveedores.find(p => p.id === item.perfume?.proveedor_id)?.nombre || "Sin proveedor";
                                return (
                                    <div key={idx} className="text-sm border-l-2 pl-2 border-muted flex flex-col">
                                        <span className="font-medium text-foreground">{item.perfume?.nombre}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            {userRole === 'admin' && (
                                                <Badge variant="outline" className="text-[10px] py-0 h-4 px-1">{provName}</Badge>
                                            )}
                                            <span>x {item.cantidad}</span>
                                            <span>• {item.genero}</span>
                                            {item.frascoLP && <span>• {item.frascoLP}</span>}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm italic text-muted-foreground">{solicitud.detalle}</p>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                    {/* Botón Cancelar (Para Admin siempre, Cliente solo si pendiente/en_prep) */}
                    {(userRole === 'admin' || solicitud.estado === 'pendiente' || solicitud.estado === 'en_preparacion') && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => handleUpdateStatus(solicitud.id, userRole === 'admin' ? 'rechazado' : 'cancelado')}
                            title={userRole === 'admin' ? "Rechazar solicitud" : "Cancelar pedido"}
                        >
                            {userRole === 'admin' ? <Trash2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </Button>
                    )}

                    {/* Acciones de Admin */}
                    {userRole === 'admin' && (
                        <div className="flex gap-2 ml-auto">
                            {solicitud.estado === 'pendiente' && (
                                <Button size="sm" className="gap-2" onClick={() => handleUpdateStatus(solicitud.id, 'en_preparacion')}>
                                    <Check className="w-4 h-4" /> Aceptar
                                </Button>
                            )}
                            {solicitud.estado === 'en_preparacion' && (
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-2" onClick={() => handleUpdateStatus(solicitud.id, 'preparado')}>
                                    <Package className="w-4 h-4" />
                                    Marcar Listo
                                </Button>
                            )}
                            {solicitud.estado === 'preparado' && (
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => handleUpdateStatus(solicitud.id, 'entregado')}>
                                    <Truck className="w-4 h-4" />
                                    Entregar
                                </Button>
                            )}
                        </div>
                    )}
                </CardFooter>
            </Card>
        </motion.div>
    );

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <h1 className="text-3xl font-bold mb-8">Gestión de Solicitudes</h1>

            {userRole === 'admin' ? (
                // Diseño Admin: 3 arriba, 2 abajo
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Columna 1: Pendientes */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-amber-600">
                                <Clock className="w-5 h-5" /> Pendientes ({pendientes.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {pendientes.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">No hay solicitudes pendientes.</motion.p>
                                    )}
                                    {pendientes.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Columna 2: En Proceso */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-blue-600">
                                <Package className="w-5 h-5" /> En Preparación ({enPreparacion.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {enPreparacion.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">Nada en preparación.</motion.p>
                                    )}
                                    {enPreparacion.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Columna 3: Listos */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-green-600">
                                <Check className="w-5 h-5" /> Listos para retirar ({preparados.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {preparados.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">Nada listo aún.</motion.p>
                                    )}
                                    {preparados.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Columna 4: Rechazados */}
                        <div className="bg-muted/10 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 text-destructive flex items-center gap-2">
                                <X className="w-5 h-5" /> Rechazados (Admin)
                            </h2>
                            <div className="space-y-2">
                                <AnimatePresence mode="popLayout">
                                    {rechazados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).map(s => (
                                        <motion.div
                                            layout
                                            key={s.id}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="text-sm border-b pb-2"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{s.cliente}</span>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                                                        title="Restaurar a pendiente"
                                                        onClick={() => handleUpdateStatus(s.id, 'pendiente')}
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>
                                                    <Badge variant='destructive' className="text-[10px] px-1 py-0 h-5">
                                                        rechazado
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {s.motivo && (
                                                    <p className="mb-1 italic text-foreground/80 break-words">
                                                        "{s.motivo}"
                                                    </p>
                                                )}
                                                {formatCurrency(s.total, "ARS", 0)} • {formatDate(new Date(s.created_at))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                {rechazados.length === 0 && <p className="text-sm text-muted-foreground">Sin rechazos recientes.</p>}
                            </div>
                        </div>

                        {/* Columna 5: Cancelados por Cliente */}
                        <div className="bg-muted/30 p-4 rounded-lg border opacity-75">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                                <X className="w-5 h-5" /> Cancelados por Cliente
                            </h2>
                            <div className="space-y-4">
                                {cancelados.length === 0 && <p className="text-sm text-muted-foreground">No hay cancelaciones de clientes.</p>}
                                {cancelados.map(s => (
                                    <div key={s.id} className="text-sm border-b pb-2 opacity-60">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">{s.cliente}</span>
                                            <Badge variant='outline' className="text-[10px] px-1 py-0 h-5">
                                                cancelado
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {s.motivo && (
                                                <p className="mb-1 italic text-foreground/80 break-words">
                                                    "{s.motivo}"
                                                </p>
                                            )}
                                            {formatCurrency(s.total, "ARS", 0)} • {formatDate(new Date(s.created_at))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // Diseño Usuario Regular: Fila superior (Activos + Completados) y Fila inferior (Rechazados)
                <div className="flex flex-col gap-6">
                    {/* Fila superior: 4 Columnas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Columna 1: Pendientes */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-amber-600">
                                <Clock className="w-5 h-5" /> Pendientes ({pendientes.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {pendientes.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">No hay solicitudes pendientes.</motion.p>
                                    )}
                                    {pendientes.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Columna 2: En Proceso */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-blue-600">
                                <Package className="w-5 h-5" /> En Preparación ({enPreparacion.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {enPreparacion.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">Nada en preparación.</motion.p>
                                    )}
                                    {enPreparacion.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Columna 3: Listos */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-green-600">
                                <Check className="w-5 h-5" /> Listos para retirar ({preparados.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {preparados.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">Nada listo aún.</motion.p>
                                    )}
                                    {preparados.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Columna 4: Pedidos Completados */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h2 className="font-semibold mb-4 flex items-center gap-2 text-emerald-600">
                                <Truck className="w-5 h-5" /> Pedidos Completados ({entregados.length})
                            </h2>
                            <div className="space-y-4 min-h-[100px]">
                                <AnimatePresence mode="popLayout">
                                    {entregados.length === 0 && (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">No hay pedidos completados.</motion.p>
                                    )}
                                    {entregados.map(s => <RenderCard key={s.id} solicitud={s} />)}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Fila inferior: Rechazados */}
                    <div className="bg-muted/10 p-4 rounded-lg border w-full">
                        <h2 className="font-semibold mb-4 text-destructive flex items-center gap-2">
                            <X className="w-5 h-5" /> Rechazados
                        </h2>
                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {rechazados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).map(s => (
                                    <motion.div
                                        layout
                                        key={s.id}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="text-sm border-b pb-2"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">{s.cliente}</span>
                                            <div className="flex items-center gap-1">
                                                <Badge variant='destructive' className="text-[10px] px-1 py-0 h-5">
                                                    rechazado
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {s.motivo && (
                                                <p className="mb-1 italic text-foreground/80 break-words">
                                                    "{s.motivo}"
                                                </p>
                                            )}
                                            {formatCurrency(s.total, "ARS", 0)} • {formatDate(new Date(s.created_at))}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {rechazados.length === 0 && <p className="text-sm text-muted-foreground">Sin rechazos recientes.</p>}
                        </div>
                    </div>
                </div>
            )}
            {/* Diálogo de Motivo */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedSolicitud?.status === 'cancelado' ? 'Cancelar Pedido' : 'Rechazar Pedido'}
                        </DialogTitle>
                        <DialogDescription>
                            Por favor indica el motivo. (Opcional)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="motivo" className="mb-2 block">Motivo</Label>
                        <Textarea
                            id="motivo"
                            placeholder="Escribe la razón aquí..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Volver</Button>
                        <Button
                            variant={selectedSolicitud?.status === 'rechazado' ? "destructive" : "default"}
                            onClick={handleConfirmRejection}
                        >
                            Confirmar {selectedSolicitud?.status === 'cancelado' ? 'Cancelación' : 'Rechazo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
