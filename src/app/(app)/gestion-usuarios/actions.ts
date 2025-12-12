"use server";

import { createClient } from "@supabase/supabase-js";

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

        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) {
            console.error("Error deleting user:", error);
            return { error: error.message };
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

        // Generate a fake email from username
        const email = `${data.username.toLowerCase().replace(/\s/g, '')}@sanseperfumes.local`;

        // 1. Create User in Auth
        const { data: userData, error } = await supabase.auth.admin.createUser({
            email: email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                nombre: data.username,
                // We keep metadata for legacy/triggers, but main source of truth is now profiles table
            },
        });

        if (error) {
            console.error("Error creating user:", error);
            return { error: error.message };
        }

        if (userData.user) {
            // 2. Explicitly update the profile role
            // We use a small delay or retry logic in case the trigger hasn't fired yet? 
            // Better: Upsert to ensure it exists and set the role.
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: userData.user.id,
                    nombre: data.username,
                    rol: data.rol
                }, { onConflict: 'id' });

            if (profileError) {
                console.error("Error creating/updating profile role:", profileError);
                // Not fatal, but good to know
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

        // 1. Get Auth Data (ID, Email)
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        // 2. Get Profiles Data (ID, Nombre, Rol)
        // We use the service role key so we can access all profiles regardless of RLS
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nombre, rol');

        if (profilesError) throw profilesError;

        // 3. Merge Data
        const users = authData.users.map(u => {
            const profile = profilesData?.find(p => p.id === u.id);
            return {
                id: u.id,
                email: u.email,
                nombre: profile?.nombre || u.user_metadata?.nombre || "Sin nombre",
                rol: profile?.rol || "revendedor", // Default from profile or fallback
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

        // Update Profiles Table directly
        const { error } = await supabase
            .from('profiles')
            .update({ rol: rol })
            .eq('id', userId);

        if (error) {
            console.error("Error updating user role:", error);
            return { error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Server action error:", error);
        return { error: error.message || "Unknown error occurred" };
    }
}
