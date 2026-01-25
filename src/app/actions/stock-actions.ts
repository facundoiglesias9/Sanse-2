'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleStock(id: string, currentStatus: boolean) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('esencias')
        .update({ stock_al_momento: !currentStatus })
        .eq('id', id);

    if (error) {
        console.error("Error updating stock:", error);
        throw new Error(error.message);
    }

    revalidatePath('/');
    revalidatePath('/lista-de-precios/aviso-de-stock');
}
