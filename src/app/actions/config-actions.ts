'use server';

import { createClient } from "@/utils/supabase/server";

export async function getGlobalConfig(key: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('configuracion')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error(`Error fetching config ${key}:`, error);
    return null;
  }

  return data?.value || null;
}

export async function updateGlobalConfig(key: string, value: string) {
  const supabase = await createClient();

  // Security check: Only admins should be able to update config
  // Fetch user session and role
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { error: 'No autorizado' };
  }

  // Assuming role check logic similar to other parts of the app, 
  // or relying on RLS if configured correctly. 
  // Explicitly checking role here for safety on server action.
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single();

  const userRole = profile?.rol || session.user.user_metadata?.rol;

  if (userRole !== 'admin') {
    return { error: 'Solo administradores pueden modificar la configuración.' };
  }

  const { error } = await supabase
    .from('configuracion')
    .upsert({ key, value });

  if (error) {
    console.error(`Error updating config ${key}:`, error);
    return { error: 'Error actualizando configuración' };
  }

  return { success: true };
}
