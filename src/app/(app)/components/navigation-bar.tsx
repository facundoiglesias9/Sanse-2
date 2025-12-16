
"use client";


import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Menu, LogOut, Info, X, Package, Check, Bell, Gift, Truck, Trash2,
  DollarSign, Moon, Sun, Monitor, SoapDispenserDroplet, Boxes, Users
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useCurrencies } from "@/app/contexts/CurrencyContext";
import { useTheme } from "next-themes";
import { formatCurrency } from "@/app/helpers/formatCurrency";
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
];

const stockLinks = [
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

export function NavigationBar({ maintenanceMode = false }: { maintenanceMode?: boolean; }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("revendedor"); // Seguro por defecto
  const router = useRouter();
  const supabase = createClient();
  const { currencies, isLoading: loadingCurrencies } = useCurrencies();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pendingPrizes, setPendingPrizes] = useState<any[]>([]);
  const [solicitudNotifications, setSolicitudNotifications] = useState<any[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Cargar IDs descartados del localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dismissedNotifications");
    if (saved) {
      setDismissedIds(JSON.parse(saved));
    }
  }, []);

  // Estado para controlar el montaje en cliente y evitar errores de hidratación
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Resolver usuario y rol
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol, nombre')
          .eq('id', session.user.id)
          .single();

        const role = profile?.rol || session.user.user_metadata?.rol || "revendedor";
        setUserRole(role);

        let resolvedName = profile?.nombre;
        if (!resolvedName) {
          const meta = session.user.user_metadata;
          resolvedName = meta?.nombre || meta?.full_name || meta?.name || session.user.email || "";
        }
        setUserName(resolvedName);
      }
    };
    getUser();
  }, []);



  // 2. Fetch inicial y Suscripción Realtime
  useEffect(() => {
    if (!userName) return;

    let channel: any;

    const fetchNotifications = async () => {
      // Buscar premios pendientes
      const { data: prizes } = await supabase
        .from('premios')
        .select('*')
        .eq('revendedor_nombre', userName)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(5);

      if (prizes) {
        setPendingPrizes(prizes.filter(p => !dismissedIds.includes(p.id)));
      }

      // Buscar actualizaciones de solicitudes
      const { data: requestUpdates } = await supabase
        .from('solicitudes')
        .select('*')
        .ilike('cliente', userName)
        .in('estado', ['rechazado', 'en_preparacion', 'preparado'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (requestUpdates) {
        setSolicitudNotifications(
          requestUpdates.filter(req => !dismissedIds.includes(req.id))
        );
      }
    };

    // Llamada inicial
    fetchNotifications();

    // Polling cada 5 segundos (Backup para Realtime)
    const interval = setInterval(fetchNotifications, 5000);

    // Suscripción Realtime (Actualización inmediata)
    channel = supabase
      .channel('nav_notifications_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' }, () => {
        console.log("Solitudes change detected!");
        fetchNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'premios' }, () => {
        console.log("Premios change detected!");
        fetchNotifications();
      })
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userName, dismissedIds]);


  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedNotifications", JSON.stringify(newDismissed));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); // Cierra la sesión en Supabase
    setSession(null); // Actualiza el estado de la sesión
    router.push("/login"); // Redirige al login
  };


  // Filtrar enlaces basados en el rol
  const isAdmin = userRole === "admin";

  // Admin ve todo. Revendedor ve lista restringida.
  // Revendedor: Lista de precios (y ¿'Pedido Mayorista' implícito quizás? No, estricto a la solicitud: "Lista precios" y "Agregar ventas").
  // La funcionalidad "Agregar ventas" suele estar integrada en la vista principal o en una página específica /ventas.
  // Asumiendo que "/" (Lista de precios) contiene la lógica de ventas.

  // Barra de navegación:
  // Admin: Todo (Lista, Agregar Prod, Inventario, Pedidos)
  // Revendedor: Lista de precios.
  const filteredNavbar = linksNavbar.filter(link => {
    if (isAdmin) return true;
    return ["/"].includes(link.href);
  });

  // ABM:
  // Admin: Todo
  // Revendedor: Ninguno
  const filteredABM = isAdmin ? abmLinks : [];

  // Herramientas:
  // Admin: Todo
  // Revendedor: Ninguno
  const filteredHerramientas = isAdmin ? herramientasLinks : [];

  // Caja:
  // Admin: Sí
  // Revendedor: No (pero accede a Solicitudes por "Mis Pedidos")
  const showCaja = isAdmin;

  // Barra de usuario:
  // Admin: Todo
  // Revendedor/Comprador: Solo Perfil (Modo color y Cerrar sesión son fijos)
  const filteredUserbar = linksUserbar.filter(link => {
    if (isAdmin) return true;
    return link.href === "/perfil";
  });

  // Render simplificado para el servidor / pre-hidratación
  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 flex items-center justify-between w-full backdrop-blur-lg bg-background/70 py-3 md:py-4 shadow-sm transition-all">
        <div className="flex flex-1 justify-center md:justify-start px-3 md:pl-6">
          <span className="text-xl md:text-2xl font-semibold tracking-tight text-center md:text-left whitespace-nowrap">
            Sanse perfumes
          </span>
        </div>
      </header>
    );
  }

  return (
    // ... Renderizar con listas filtradas ...
    // (Reconstruiré el componente usando estas variables filtradas)
    <header
      className={clsx(
        "sticky top-0 z-50 flex items-center justify-between w-full backdrop-blur-lg bg-background/70 py-3 md:py-4 shadow-sm transition-all",
      )}
    >
      {/* Logo */}
      <div className="flex flex-1 justify-center md:justify-start px-3 md:pl-6">
        <Link
          href="/"
          className="text-xl md:text-2xl font-semibold tracking-tight text-center md:text-left whitespace-nowrap"
        >
          Sanse perfumes
        </Link>
      </div>

      {/* Navegación Desktop */}
      <NavigationMenu viewport={false} className="hidden md:flex mx-auto">
        <NavigationMenuList>
          {!maintenanceMode && filteredNavbar.map((link) => {
            // Admin obtiene desplegable para "Lista de precios", Revendedor obtiene enlace simple
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
              // Revendedor: Enlace simple solo a mayorista
              return (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={userRole === "comprador" ? "/?view=minorista" : "/?view=mayorista"}
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

        {isAdmin && (
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className={pathname.startsWith("/abm/inventario") || pathname === "/pedido-mayorista" ? "bg-accent text-accent-foreground" : ""}>
                Stock
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[200px] gap-2 p-2">
                  {stockLinks.map((link) => (
                    <li key={link.href}>
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
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        )}
        {/* Enlace "Mis Pedidos" para No-Admins (Revendedores/Compradores) */}
        {!isAdmin && !maintenanceMode && (
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/caja/solicitudes"
                  className={clsx(
                    navigationMenuTriggerStyle(),
                    pathname === "/caja/solicitudes" && "bg-accent text-accent-foreground"
                  )}
                >
                  Mis Pedidos
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        )}

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
                <NavigationMenuTrigger className={pathname.startsWith("/caja") ? "bg-accent text-accent-foreground" : ""}>Caja</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[300px] gap-2">
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/caja"
                          className={clsx(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            pathname === "/caja" && "bg-accent text-accent-foreground"
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
                          href="/caja/solicitudes"
                          className={clsx(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            pathname === "/caja/solicitudes" && "bg-accent text-accent-foreground"
                          )}
                        >
                          <div className="text-sm font-medium leading-none">Solicitudes de Compra</div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Gestionar pedidos de compradores
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/caja/ventas-revendedores"
                          className={clsx(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            pathname === "/caja/ventas-revendedores" && "bg-accent text-accent-foreground"
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
      <div className="flex flex-1 justify-end items-center gap-2 md:gap-4 pr-3 md:pr-6">
        {/* Cotización del dólar SOLO visible en desktop y para ADMINS */}
        {isAdmin && (
          <div className="hidden md:flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-md border border-muted-foreground/20 bg-muted-foreground/5">
            <DollarSign className="w-4 h-4 text-success" />
            <span>
              Dólar:{" "}
              {!loadingCurrencies && currencies["ARS"] ? (
                `$${currencies["ARS"].toLocaleString("es-AR", { maximumFractionDigits: 2 })} `
              ) : (
                <span className="opacity-50">—</span>
              )}
            </span>
          </div>
        )}

        {session && (
          // Avatar y menú de usuario
          <div className="flex items-center gap-2">

            {/* Notificaciones */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {(pendingPrizes.length > 0 || solicitudNotifications.length > 0) && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pendingPrizes.length === 0 && solicitudNotifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No tienes nuevas notificaciones
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    {/* Premios */}
                    {pendingPrizes.map((prize) => (
                      <div key={prize.id} className="p-3 border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 p-2 rounded-full shrink-0">
                            <Gift className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground leading-none">¡Premio Recibido!</p>
                            <p className="text-xs text-muted-foreground mt-1 text-wrap break-words">{prize.premio}</p>
                            <p className="text-[10px] text-muted-foreground mt-2 text-right">
                              {new Date(prize.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Solicitudes Updates */}
                    {solicitudNotifications.map((req) => {
                      let icon = <Info className="w-4 h-4 text-blue-500" />;
                      let bgClass = "bg-blue-100";
                      let title = "Actualización de pedido";

                      switch (req.estado) {
                        case 'rechazado':
                          icon = <X className="w-4 h-4 text-red-500" />;
                          bgClass = "bg-red-100";
                          title = "Pedido Rechazado";
                          break;
                        case 'en_preparacion':
                          icon = <Package className="w-4 h-4 text-amber-500" />;
                          bgClass = "bg-amber-100";
                          title = "Pedido en Preparación";
                          break;
                        case 'preparado':
                          icon = <Check className="w-4 h-4 text-green-500" />;
                          bgClass = "bg-green-100";
                          title = "¡Pedido Listo para Retirar!";
                          break;
                      }

                      return (
                        <div key={req.id} className="p-3 border-b last:border-0 hover:bg-muted/50 transition-colors group relative">
                          <div className="flex items-start gap-3">
                            <div className={`${bgClass} p-2 rounded-full shrink-0`}>
                              {icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-medium text-foreground leading-none">{title}</p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-destructive -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismiss(req.id);
                                  }}
                                  title="Eliminar notificación"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 pr-4">
                                {req.estado === 'rechazado' ? "Tu pedido no pudo ser procesado." :
                                  req.estado === 'en_preparacion' ? "Estamos armando tu pedido." :
                                    req.estado === 'preparado' ? "Pasa a buscarlo por el local." : ""}
                                <span className="block font-semibold mt-0.5">{formatCurrency(req.total, "ARS", 0)}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-2 text-right">
                                {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar>
                  <AvatarFallback>
                    {session.user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Mi cuenta ({userRole === 'admin' ? 'Admin' : userRole.charAt(0).toUpperCase() + userRole.slice(1)})</DropdownMenuLabel>
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

              {/* Cotización del dólar SOLO visible en mobile y para ADMINS */}
              {isAdmin && (
                <div className="flex md:hidden items-center gap-2 text-sm font-bold px-3 py-1 rounded-md border border-muted-foreground/20 bg-muted-foreground/5 mb-4">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span>
                    Dólar:{" "}
                    {!loadingCurrencies && currencies["ARS"] ? (
                      `$${currencies["ARS"].toLocaleString("es-AR", { maximumFractionDigits: 2 })} `
                    ) : (
                      <span className="opacity-50">—</span>
                    )}
                  </span>
                </div>
              )}

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

                {!isAdmin && !maintenanceMode && (
                  <Link
                    href={userRole === "comprador" ? "/?view=minorista" : "/?view=mayorista"}
                    className={clsx(
                      "text-lg font-semibold hover:text-foreground",
                      pathname === "/" ? "text-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    Lista de precios
                  </Link>
                )}

                {filteredNavbar.filter(l => l.href !== "/" && !maintenanceMode).map((link) => {
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

                {isAdmin && stockLinks.map((link) => {
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
                    href="/caja"
                    className={clsx(
                      "text-lg font-semibold hover:text-foreground",
                      pathname === "/caja"
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
