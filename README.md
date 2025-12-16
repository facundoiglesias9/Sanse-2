# 🌸 Sanse Perfumes

Aplicación web para administrar integralmente el negocio de Sanse Perfumes: controla esencias, insumos, costos, ventas, caja, deudas y sincroniza precios con proveedores externos. Está construida sobre el ecosistema de Next.js y Supabase para ofrecer una experiencia rápida, responsiva y lista para producción.

---

## 📑 Tabla de contenidos
1. [Visión general](#-visión-general)
2. [Características principales](#-características-principales)
3. [Stack tecnológico](#-stack-tecnológico)
4. [Arquitectura y organización del código](#-arquitectura-y-organización-del-código)
5. [Integraciones y modelo de datos](#-integraciones-y-modelo-de-datos)
6. [Requisitos previos](#-requisitos-previos)
7. [Configuración del entorno local](#-configuración-del-entorno-local)
8. [Variables de entorno](#-variables-de-entorno)
9. [Comandos disponibles](#-comandos-disponibles)
10. [Flujo de trabajo recomendado](#-flujo-de-trabajo-recomendado)
11. [Despliegue](#-despliegue)
12. [Recursos útiles](#-recursos-útiles)

---

## 🧭 Visión general
- **Tipo de producto:** dashboard interno para gestión de perfumería artesanal.
- **Usuarios objetivo:** equipo administrativo y operativo de Sanse Perfumes.
- **Autenticación:** Supabase Auth + middleware que protege todas las rutas de la app.
- **Persistencia:** Supabase Postgres con Row Level Security (RLS) esperado en tablas críticas.
- **Infraestructura sugerida:** despliegue en Vercel + Supabase (DB, Auth, Storage) + ExchangeRate API.

---

## ✨ Características principales
- **Lista de precios dinámica:** cálculo automático de precios al costo, venta y mayorista combinando datos de esencias, insumos y proveedor. Integración con cotizaciones USD→ARS.
- **Gestión de inventario:** seguimiento de insumos, esencias, perfumes, frascos y etiquetas con filtros por categoría y género.
- **Ventas y caja:** registro de ventas con filtros temporales, detalle de productos vendidos y control de gastos/caja.
- **Deudas y cobranzas:** módulo dedicado para monitorear deudas activas.
- **ABM avanzado:** formularios optimizados con React Hook Form + Zod, edición inline y validaciones contextuales.
- **Sincronización externa (Van Rossum):** endpoints para importar precios y aceptar esencias huérfanas desde un scraper externo.
- **Perfil de usuario:** actualización de datos personales y cambio de tema (claro/oscuro) mediante `next-themes`.
- **Experiencia UI/UX:** componentes `shadcn/ui`, animaciones con Framer Motion, tablas potentes con TanStack Table y exportación a Excel (`xlsx`).

---

## 🧱 Stack tecnológico

### Front-end
- **Next.js 15** con App Router y soporte Turbopack para desarrollo rápido.
- **React 19** + **TypeScript 5** como base de componentes y tipado estático.
- **Tailwind CSS 4** junto con `tw-animate-css`, `tailwind-merge`, `clsx` y `class-variance-authority` para estilos consistentes.
- **shadcn/ui** (Radix UI) para componentes accesibles.
- **Framer Motion** para microinteracciones.

### Datos y lógica
- **Supabase (Postgres + Auth + Storage)** mediante `@supabase/supabase-js` y `@supabase/ssr`.
- **TanStack React Table v8** para tablas interactivas con filtros avanzados.
- **React Hook Form** + **Zod** para validación y manejo de formularios.
- **ExchangeRate-API** para obtener tasas de cambio USD.

### Tooling
- **TypeScript** para chequeo de tipos.
- **Next Lint (ESLint)** como herramienta de linting.
- **Prettier 3** para formateo.

---

## 🗂️ Arquitectura y organización del código
```
src/
├─ app/
│  ├─ (auth)/login           → flujo de autenticación (formulario, validaciones, UI)
│  ├─ (app)/                 → layout autenticado y páginas principales
│  │  ├─ ventas/             → tabla de ventas + control de caja
│  │  ├─ abm/                → administración de esencias, insumos y perfumes
│  │  ├─ deudas/             → seguimiento de deudores
│  │  ├─ perfil/             → gestión del perfil de usuario y preferencias
│  │  ├─ herramientas/       → utilidades varias (exportaciones, calculadoras, etc.)
│  │  ├─ accept-orphans/     → flujo para aceptar esencias importadas
│  │  └─ registro_de_actividad/ → log de operaciones relevantes
│  ├─ api/                   → rutas API (exchange-rate, vanrossum/*)
│  ├─ contexts/              → React Contexts (p.ej. CurrencyContext)
│  ├─ helpers/ & types/      → funciones puras, tipados compartidos
│  └─ middleware.ts          → protección de rutas vía Supabase Auth
├─ components/               → componentes reutilizables + `ui/` (design system shadcn)
├─ lib/                      → utilidades de dominio, cálculos específicos y constantes
└─ utils/                    → helpers genéricos (clientes Supabase, conversión de divisas)
```

### Puntos clave
- **Separación por segmentos de App Router:** `(auth)` y `(app)` aíslan el flujo de login del dashboard.
- **Cliente Supabase centralizado:** `src/utils/supabase/{client,server,middleware}.ts` garantizan que la sesión se mantenga tanto en cliente como en servidor.
- **Contextos globales:** `CurrencyContext` abastece tasas de cambio cacheadas y es consumido por la lista de precios.
- **Componentización extensiva:** tablas, formularios y modales se construyen con componentes de `src/app/(app)/components` y `src/components/ui`.

---

## 🔗 Integraciones y modelo de datos
- **Supabase Postgres:** tablas principales (`esencias`, `insumos`, `ventas`, `gastos`, `deudas`, etc.) con RLS habilitado. Es indispensable revisar/activar reglas antes de exponer la app a usuarios reales.
- **Endpoints internos:**
  - `GET /api/exchange-rate` cachea en memoria las cotizaciones por 30 minutos.
  - `POST /api/vanrossum/sync-precios` sincroniza precios desde un scraper externo utilizando `SUPABASE_SERVICE_ROLE_KEY`.
  - `POST /api/vanrossum/accept-orphan` acepta registros huérfanos generados por el scraper.
- **Seguridad:** los endpoints que usan `SUPABASE_SERVICE_ROLE_KEY` poseen privilegios completos. Protege estas rutas con verificación adicional de roles o tokens compartidos y monitorea su uso en producción.

---

## ✅ Requisitos previos
- **Node.js 20.0+** (recomendado 20.17 o superior para alinearse con Next.js 15).
- **npm 10+** (incluido con Node 20).
- **Cuenta Supabase** con proyecto configurado (Auth + Database + Storage opcional).
- **Cuenta en [ExchangeRate-API](https://www.exchangerate-api.com/)** con plan que incluya el endpoint `latest`.

---

## 🛠️ Configuración del entorno local
1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tuusuario/sanseperfumes.git
   cd sanseperfumes
   ```
2. **Instalar dependencias**
   ```bash
   npm install
   ```
3. **Configurar variables de entorno**
   - Copia `.env.example` (si existe) o crea `.env.local` en la raíz del proyecto.
   - Completa las claves descritas en la sección [Variables de entorno](#-variables-de-entorno).
4. **Ejecutar el servidor de desarrollo**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

---

## 🔐 Variables de entorno
Coloca las variables en `.env.local`. Las claves marcadas como 🔒 no deben exponerse en el cliente.

| Variable | Descripción | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API key `anon` de Supabase para operaciones desde el cliente. | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key con privilegios elevados usada en endpoints protegidos. | 🔒 Servidor |
| `SCRAPING_PROFILE_ID` | UUID opcional utilizado para auditar registros creados por el scraper. | 🔒 Servidor |
| `EXCHANGERATE_API_KEY` | API key de ExchangeRate-API para obtener tasas de cambio USD. | 🔒 Servidor |

> **Nota:** valida las políticas RLS de Supabase. Las rutas API con service role deberían requerir comprobaciones adicionales (token secreto, roles específicos, etc.).

---

## 🧪 Comandos disponibles
```bash
npm run dev     # Levanta la app en modo desarrollo con Turbopack
npm run build   # Genera el build de producción
npm run start   # Sirve el build de producción
npm run lint    # Ejecuta ESLint con la configuración de Next.js
```

Para formatear manualmente el código puedes usar Prettier (por ejemplo con extensiones del editor o scripts personalizados).

---

## 🔁 Flujo de trabajo recomendado
1. **Crear rama de trabajo** a partir de `main`.
2. **Actualizar dependencias y variables** si es necesario (`npm install`).
3. **Desarrollar y probar** utilizando `npm run dev`.
4. **Validar linting** con `npm run lint` antes de abrir PR.
5. **Revisar los módulos sensibles** (`/api/vanrossum/*`, cálculos de precios) ante cambios en el dominio.
6. **Acompañar cada feature con documentación** (actualiza este README o crea guías específicas según corresponda).

---

## 🚀 Despliegue
- **Hosting recomendado:** [Vercel](https://vercel.com/). El repo ya incluye `vercel.json` con la configuración base.
- **Variables de entorno en producción:** replica las de `.env.local` en el panel de Vercel (Project Settings → Environment Variables).
- **Supabase:**
  - Habilita RLS para todas las tablas accesibles desde el cliente y define políticas por rol.
  - Limita el uso de `SUPABASE_SERVICE_ROLE_KEY` únicamente a entornos seguros (Edge Functions, CRON jobs, etc.).
- **Observabilidad:** configura logs y alertas para los endpoints que realizan sincronizaciones externas.

---

## 📚 Recursos útiles
- [Documentación oficial de Next.js](https://nextjs.org/docs)
- [Guía de Supabase para Next.js (SSR)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Componentes shadcn/ui](https://ui.shadcn.com/)
- [TanStack Table](https://tanstack.com/table/v8)
- [ExchangeRate-API](https://www.exchangerate-api.com/)

---

¿Necesitas ampliar la documentación? Abre un issue con la sección a mejorar y mantené este README como referencia principal.
