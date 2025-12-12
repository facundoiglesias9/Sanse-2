"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { useTheme } from "next-themes";
import {
  DollarSign,
  Moon,
  Sun,
  Monitor,
  SoapDispenserDroplet,
  Boxes,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const linksNavbar = [
  { href: "/", label: "Lista de precios" },
  { href: "/agregar-producto", label: "Agregar producto" },
  { href: "/abm/inventario", label: "Inventario" },
  { href: "/pedido-mayorista", label: "Pedido Mayorista" },
];

const abmLinks = [
  { href: "/abm/esencias", label: "Esencias", icon: <SoapDispenserDroplet /> },
  { href: "/abm/insumos", label: "Insumos", icon: <Boxes /> },
  { href: "/abm/proveedores", label: "Proveedores", icon: <Users /> },
];

const herramientasLinks = [
  {
    href: "/herramientas/calculadora-margen",
    label: "Calculadora de margen",
    description: "Calcular márgenes de ganancia y precios sugeridos.",
  },
  {
    href: "/herramientas/notas",
    label: "Notas",
    description: "Gestionar notas.",
  },
];

const linksUserbar = [
  { href: "/perfil", label: "Perfil" },
  { href: "/registro_de_actividad", label: "Registro de actividad" },
  { href: "/accept-orphans", label: "Aceptar Huérfanos" },
  { href: "/gestion-usuarios", label: "Gestión de usuarios" },
];

/* 
   ... imports ...
*/

// ... (previous imports)

export function NavigationBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("revendedor"); // Default safe
  const router = useRouter();
  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // Verificar si hay una sesión activa
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // Attempt to get role from profiles, fallback to metadata
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        const role = profile?.rol || session.user.user_metadata?.rol || "revendedor";
        setUserRole(role);
      }
    });
  }, []);


  const handleLogout = async () => {
    await supabase.auth.signOut(); // Cierra la sesión en Supabase
    setSession(null); // Actualiza el estado de la sesión
    router.push("/login"); // Redirige al login
  };


  // Filter Links Based on Role
  const isAdmin = userRole === "admin";

  // Admin sees everything. Revendedor sees restricted list.
  // Revendedor: Lista de precios (and implied 'Pedidio Mayorista' maybe? No, strict to request: "Lista precios" & "Agregar ventas").
  // "Agregar ventas" functionality is usually embedded in the main view or a specific /ventas page. 
  // Assuming "/" (Lista de precios) contains the sales logic.

  // Navbar: 
  // Admin: All (Lista, Agregar Prod, Inventario, Pedidos)
  // Revendedor: Lista de precios.
  const filteredNavbar = linksNavbar.filter(link => {
    if (isAdmin) return true;
    return ["/"].includes(link.href);
  });

  // ABM:
  // Admin: All
  // Revendedor: None
  const filteredABM = isAdmin ? abmLinks : [];

  // Herramientas:
  // Admin: All
  // Revendedor: None
  const filteredHerramientas = isAdmin ? herramientasLinks : [];

  // Caja:
  // Admin: Yes
  // Revendedor: No
  const showCaja = isAdmin;

  // Userbar:
  // Admin: All
  // Revendedor: Perfil, Registro. (No Gestion Usuarios)
  const filteredUserbar = linksUserbar.filter(link => {
    if (isAdmin) return true;
    return link.href !== "/gestion-usuarios";
  });

  return (
    // ... Render with filtered lists ...
    // (I will reconstruct the component using these filtered variables)
    <header
      className={clsx(
        "sticky top-0 z-50 flex items-center justify-between w-full backdrop-blur-lg bg-background/70 py-3 md:py-4 shadow-sm transition-all",
      )}
    >
      {/* Logo */}
      <Link
        href="/"
        className="text-xl md:text-2xl font-semibold tracking-tight px-3 md:pl-6 flex-1 md:flex-none text-center md:text-left"
      >
        Sanse perfumes
      </Link>

      {/* Navegación Desktop */}
      <NavigationMenu viewport={false} className="hidden md:flex">
        <NavigationMenuList>
          {filteredNavbar.map((link) => {
            // Admin gets dropdown for "Lista de precios", Revendedor gets simple link
            if (link.href === "/" && isAdmin) {
              return (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuTrigger className={pathname === "/" ? "bg-accent text-accent-foreground" : ""}>Lista de precios</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[200px] gap-2 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/"
                            className={clsx(
                              navigationMenuTriggerStyle(),
                              pathname === "/" && (!searchParams.get("view") || searchParams.get("view") === "minorista") && "bg-accent text-accent-foreground"
                            )}
                          >
                            Minorista
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/?view=mayorista"
                            className={clsx(
                              navigationMenuTriggerStyle(),
                              pathname === "/" && searchParams.get("view") === "mayorista" && "bg-accent text-accent-foreground"
                            )}
                          >
                            Mayorista
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              );
            } else if (link.href === "/" && !isAdmin) {
              // Revendedor: Simple link to mayorista only
              return (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/?view=mayorista"
                      className={clsx(
                        navigationMenuTriggerStyle(),
                        pathname === "/" && "bg-accent text-accent-foreground"
                      )}
                    >
                      Lista de precios
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            }
            return (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild>
                  <Link
                    href={link.href}
                    className={clsx(
                      navigationMenuTriggerStyle(),
                      pathname === link.href && "bg-accent text-accent-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>

        {(filteredABM.length > 0 || showCaja || filteredHerramientas.length > 0) && (
          <NavigationMenuList>
            {filteredABM.length > 0 && (
              <NavigationMenuItem>
                <NavigationMenuTrigger className={pathname.startsWith("/abm") && !pathname.startsWith("/abm/inventario") ? "bg-accent text-accent-foreground" : ""}>ABMs</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[200px] gap-2">
                    {filteredABM.map((link) => {
                      return (
                        <li key={link.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={link.href}
                              className="flex-row items-center gap-x-3"
                            >
                              {link.icon}
                              {link.label}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      );
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}

            {showCaja && (
              <NavigationMenuItem>
                <NavigationMenuTrigger className={pathname.startsWith("/caja2") ? "bg-accent text-accent-foreground" : ""}>Caja</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[300px] gap-2">
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/caja2"
                          className={clsx(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            pathname === "/caja2" && "bg-accent text-accent-foreground"
                          )}
                        >
                          <div className="text-sm font-medium leading-none">Caja Unificada</div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Ver ganancias, gastos y deudas
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/caja2/ventas-revendedores"
                          className={clsx(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            pathname === "/caja2/ventas-revendedores" && "bg-accent text-accent-foreground"
                          )}
                        >
                          <div className="text-sm font-medium leading-none">Ventas Revendedores</div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Historial de ventas por revendedor
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}

            {filteredHerramientas.length > 0 && (
              <NavigationMenuItem>
                <NavigationMenuTrigger className={pathname.startsWith("/herramientas") ? "bg-accent text-accent-foreground" : ""}>Herramientas</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[300px] gap-2">
                    {filteredHerramientas.map((link) => {
                      return (
                        <li key={link.href}>
                          <NavigationMenuLink asChild>
                            <Link href={link.href}>
                              <div className="font-medium">{link.label}</div>
                              <div className="text-muted-foreground">
                                {link.description}
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      );
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        )}

      </NavigationMenu>

      {/* Sección derecha */}
      <div className="flex items-center gap-2 md:gap-4 pr-3 md:pr-6">
        {/* Cotización del dólar SOLO visible en desktop */}
        <div className="hidden md:flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-md border border-muted-foreground/20 bg-muted-foreground/5">
          <DollarSign className="w-4 h-4 text-success" />
          <span>
            Dólar:{" "}
            {!loadingCurrencies && currencies["ARS"] ? (
              `$${currencies["ARS"].toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
            ) : (
              <span className="opacity-50">—</span>
            )}
          </span>
        </div>

        {session && (
          // Avatar y menú de usuario
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar>
                  <AvatarFallback>
                    {session.user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Mi cuenta ({userRole === 'admin' ? 'Admin' : 'Revendedor'})</DropdownMenuLabel>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Modo de color</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="w-4 h-4 mr-2" /> Oscuro
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="w-4 h-4 mr-2" /> Claro
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor className="w-4 h-4 mr-2" /> Sistema
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                {filteredUserbar.map((link) => {
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link href={link.href}>{link.label}</Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <div className="flex items-center gap-2">
                    <LogOut width={24} className="text-destructive" />
                    Cerrar sesión
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Menú Mobile */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button aria-label="Abrir menú" variant="ghost" size="icon">
                <Menu width={24} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-5 max-w-[80vw]"
              aria-describedby={undefined}
            >
              <SheetHeader>
                <SheetTitle>Menú</SheetTitle>
              </SheetHeader>

              {/* Cotización del dólar SOLO visible en mobile */}
              <div className="flex md:hidden items-center gap-2 text-sm font-bold px-3 py-1 rounded-md border border-muted-foreground/20 bg-muted-foreground/5 mb-4">
                <DollarSign className="w-4 h-4 text-success" />
                <span>
                  Dólar:{" "}
                  {!loadingCurrencies && currencies["ARS"] ? (
                    `$${currencies["ARS"].toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
                  ) : (
                    <span className="opacity-50">—</span>
                  )}
                </span>
              </div>

              <nav className="flex flex-col gap-2 mt-2">
                {isAdmin && (
                  <>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Lista de precios</p>
                    <Link
                      href="/"
                      className={clsx(
                        "text-lg font-semibold hover:text-foreground pl-4",
                        pathname === "/" && searchParams.get("view") !== "mayorista" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      Minorista
                    </Link>
                    <Link
                      href="/?view=mayorista"
                      className={clsx(
                        "text-lg font-semibold hover:text-foreground pl-4",
                        searchParams.get("view") === "mayorista" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      Mayorista
                    </Link>
                  </>
                )}

                {!isAdmin && (
                  <Link
                    href="/?view=mayorista"
                    className={clsx(
                      "text-lg font-semibold hover:text-foreground",
                      pathname === "/" ? "text-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    Lista de precios
                  </Link>
                )}

                {filteredNavbar.filter(l => l.href !== "/").map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={clsx(
                        "text-lg font-semibold hover:text-foreground",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {filteredABM.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={clsx(
                        "text-lg font-semibold hover:text-foreground",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {showCaja && (
                  <Link
                    href="/caja2"
                    className={clsx(
                      "text-lg font-semibold hover:text-foreground",
                      pathname === "/caja2"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                    onClick={() => setOpen(false)}
                  >
                    Caja
                  </Link>
                )}

                {filteredUserbar.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={clsx(
                        "text-lg font-semibold hover:text-foreground",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {session && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="justify-start w-full"
                    onClick={handleLogout}
                  >
                    <LogOut width={24} className="text-destructive" />
                    Cerrar sesión
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header >
  );
}
