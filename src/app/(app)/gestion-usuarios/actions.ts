"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function updateUserPassword(userId: string, password: string) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: password,
        });

        if (error) {
            console.error("Error updating user:", error);
            return { error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Server action error:", error);
        return { error: error.message || "Unknown error occurred" };
    }
}

export async function deleteUser(userId: string) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Obtener el ID del usuario administrador actual para heredar las referencias
        const serverSupabase = await createServerClient();
        const { data: { user: adminUser } } = await serverSupabase.auth.getUser();

        const inheritorId = adminUser?.id;

        if (inheritorId) {
            // Reasignar registros de inventario al administrador
            await supabase.from('inventario').update({ updated_by: inheritorId }).eq('updated_by', userId);
            await supabase.from('inventario').update({ created_by: inheritorId }).eq('created_by', userId);
            // Reasignar ventas al administrador
            await supabase.from('ventas').update({ user_id: inheritorId }).eq('user_id', userId);
        } else {
            // Alternativa: intentar establecer en nulo (puede fallar si la columna no admite nulos)
            await supabase.from('inventario').update({ updated_by: null }).eq('updated_by', userId);
            await supabase.from('inventario').update({ created_by: null }).eq('created_by', userId);
            // Intentar establecer user_id de ventas en nulo (probablemente fallará si no admite nulos)
            await supabase.from('ventas').update({ user_id: null }).eq('user_id', userId);
        }

        // Eliminar registros de actividad
        await supabase.from('activity_logs').delete().eq('user_id', userId);

        // Eliminar perfil
        const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);

        if (profileError) {
            console.error("Error deleting profile:", profileError);
            return { error: `Error DB: ${profileError.message}. Detalle: ${profileError.details || 'Sin detalles extra'}` };
        }

        // Eliminar usuario de autenticación
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) {
            return { error: authError.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Server action error:", error);
        return { error: error.message || "Unknown error occurred" };
    }

}



export async function createUser(data: { username: string; password: string; rol: string }) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Generar un email falso a partir del nombre de usuario
        const email = `${data.username.toLowerCase().replace(/\s/g, '')}@sanseperfumes.local`;

        // 1. Crear usuario en Auth
        const { data: userData, error } = await supabase.auth.admin.createUser({
            email: email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                nombre: data.username,
                rol: data.rol,
                // Mantenemos metadatos para legado/triggers, pero la fuente principal de verdad ahora es la tabla de perfiles
            },
        });

        if (error) {
            console.error("Error creating user:", error);
            return { error: error.message };
        }

        if (userData.user) {
            // 2. Actualizar explícitamente el rol del perfil
            // ¿Usamos un pequeño retraso o lógica de reintento en caso de que el trigger no se haya disparado aún?
            // Mejor: Upsert para asegurar que existe y establecer el rol.
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: userData.user.id,
                    email: email,
                    nombre: data.username,
                    rol: data.rol
                }, { onConflict: 'id' });

            if (profileError) {
                console.error("Error creating/updating profile role:", profileError);
                // No es fatal, pero bueno saberlo
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error("Server action error:", error);
        return { error: error.message || "Unknown error occurred" };
    }
}

export async function getUsers() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // 1. Obtener datos de autenticación (ID, Email)
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        // 2. Obtener datos de perfiles (ID, Nombre, Rol)
        // Usamos la clave de rol de servicio para poder acceder a todos los perfiles independientemente de RLS
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nombre, rol');

        if (profilesError) throw profilesError;

        // 3. Fusionar datos
        const users = authData.users.map(u => {
            const profile = profilesData?.find(p => p.id === u.id);
            return {
                id: u.id,
                email: u.email,
                nombre: profile?.nombre || u.user_metadata?.nombre || "Sin nombre",
                rol: profile?.rol || u.user_metadata?.rol || "revendedor",
                last_sign_in_at: u.last_sign_in_at
            };
        });

        return { users };
    } catch (error: any) {
        console.error("Server action error:", error);
        return { error: error.message || "Unknown error occurred" };
    }
}


export async function updateUserRole(userId: string, rol: string) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Actualizar la tabla de perfiles directamente
        const { error } = await supabase
            .from('profiles')
            .upsert({ id: userId, rol: rol }, { onConflict: 'id' });

        if (error) {
            console.error("Error updating user role:", error);
            return { error: error.message };
        }

        // También actualizar metadatos de Auth para redundancia/fallback
        await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { rol: rol }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Server action error:", error);
        return { error: error.message || "Unknown error occurred" };
    }
}
