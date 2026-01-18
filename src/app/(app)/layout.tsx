import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NavigationBar } from "@/app/(app)/components/navigation-bar";
import { CurrencyProvider } from "@/app/contexts/CurrencyContext";
import { getGlobalConfig } from "@/app/actions/config-actions";
import { MaintenanceView } from "@/app/(app)/components/maintenance-view";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  // Check Maintenance Mode
  const maintenanceMode = await getGlobalConfig('maintenance_mode');

  if (maintenanceMode === 'true') {
    // Buscar rol del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', data.user.id)
      .single();

    const role = profile?.rol || data.user.user_metadata?.rol || "";
    const normalizedRole = role.toLowerCase().trim();

    if (normalizedRole !== 'admin') {
      return (
        <CurrencyProvider>
          <NavigationBar maintenanceMode={true} />
          <MaintenanceView />
        </CurrencyProvider>
      );
    }
  }

  return (
    <CurrencyProvider>
      <NavigationBar />
      {children}
    </CurrencyProvider>
  );
}
