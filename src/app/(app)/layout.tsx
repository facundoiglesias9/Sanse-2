import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NavigationBar } from "@/app/(app)/components/navigation-bar";
import { CurrencyProvider } from "@/app/contexts/CurrencyContext";

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

  return (
    <CurrencyProvider>
      <NavigationBar />
      {children}
    </CurrencyProvider>
  );
}
