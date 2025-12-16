import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No ejecute código entre createServerClient y
  // supabase.auth.getUser(). Un simple error podría dificultar mucho la depuración
  // de problemas con usuarios que se desconectan aleatoriamente.

  // IMPORTANTE: NO ELIMINE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    // sin usuario, potencialmente responder redirigiendo al usuario a la página de inicio de sesión
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Lógica de protección de rutas basada en rol
  if (user) {
    // Buscar el rol del usuario en la tabla profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    const userRole = profile?.rol ?? user.user_metadata?.rol ?? "comprador";
    const currentPath = request.nextUrl.pathname;

    // Si NO es admin...
    if (userRole !== "admin") {
      // Y NO está en la home ("/") ni en rutas permitidas explícitamente (como /login, /start, etc.)
      const isAllowedPath =
        currentPath === "/" ||
        currentPath.startsWith("/login") ||
        currentPath.startsWith("/auth") ||
        currentPath.startsWith("/api"); // Permitir API requests si es necesario, o restringir también

      // Si intenta acceder a cualquier otra cosa, redirigir a "/"
      if (!isAllowedPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  // IMPORTANTE: Debe devolver el objeto supabaseResponse tal como está.
  // Si está creando un nuevo objeto de respuesta con NextResponse.next(), asegúrese de:
  // 1. Pasar la solicitud en él, así:
  //    const miNuevaRespuesta = NextResponse.next({ request })
  // 2. Copiar las cookies, así:
  //    miNuevaRespuesta.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Cambie el objeto miNuevaRespuesta según sus necesidades, pero evite cambiar
  //    las cookies.
  // 4. Finalmente:
  //    return miNuevaRespuesta
  // Si no hace esto, puede causar que el navegador y el servidor se desincronicen y terminen la sesión del usuario prematuramente.

  return supabaseResponse;
}