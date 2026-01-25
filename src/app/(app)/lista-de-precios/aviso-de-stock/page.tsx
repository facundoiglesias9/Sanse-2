import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { StockList } from "./stock-list";

export const dynamic = 'force-dynamic';

export default async function AvisoStockPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    const role = profile?.rol || user.user_metadata?.rol || "";

    if (role.toLowerCase() !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h1 className="text-2xl font-bold text-destructive">Acceso Denegado</h1>
                <p className="text-muted-foreground">Esta sección es solo para administradores.</p>
            </div>
        );
    }

    // Fetch data
    const { data: esencias } = await supabase
        .from("esencias")
        .select(`
          id, 
          nombre, 
          genero,
          familia_olfativa,
          stock_al_momento, 
          proveedores(nombre),
          insumos_categorias:insumos_categorias_id(nombre)
      `)
        .order("nombre", { ascending: true });

    const formattedData = (esencias || []).map((e: any) => ({
        id: e.id,
        nombre: e.nombre,
        genero: e.genero,
        familia_olfativa: e.familia_olfativa,
        stock_al_momento: !!e.stock_al_momento,
        proveedor: e.proveedores?.nombre || "",
        categoria: e.insumos_categorias?.nombre || ""
    }));

    // Extract unique values for filters
    const uniqueProveedores = Array.from(new Set(formattedData.map(d => d.proveedor))).filter(Boolean).sort();
    const uniqueCategorias = Array.from(new Set(formattedData.map(d => d.categoria))).filter(Boolean).sort();
    const uniqueFamilias = Array.from(new Set(formattedData.map(d => d.familia_olfativa).filter(Boolean).flatMap(f => f.split(',').map((s: string) => s.trim())))).sort();

    return (
        <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center mb-6">
                <h1 className="text-3xl font-bold">Aviso de Stock</h1>
                <p className="text-muted-foreground mt-2">
                    Gestiona la disponibilidad de productos en el momento. Los productos marcados aparecerán como "Stock disponible" para revendedores y compradores.
                </p>
            </div>

            <StockList
                data={formattedData}
                proveedores={uniqueProveedores}
                categorias={uniqueCategorias}
                familias={uniqueFamilias}
            />
        </div>
    );
}
