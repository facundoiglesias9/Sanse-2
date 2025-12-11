# Documentación Técnica - Módulo de Gestión de Productos y Precios

**Fecha:** 08/12/2025
**Proyecto:** Sanse Perfumes (Web App)
**Desarrollado en:** TypeScript / Next.js

---

## 1. Resumen Ejecutivo
Este documento detalla las implementaciones técnicas realizadas en el módulo de "Agregar Producto" y la "Lista de Precios". El objetivo principal fue crear una calculadora de costos dinámica que permitiera la composición flexible de productos (Perfumes, Aromatizantes, etc.) utilizando esencias e insumos, con una lógica de precios robusta y personalizable.

## 2. Tecnologías Utilizadas
*   **Frontend Framework:** Next.js 14 (App Router)
*   **Lenguaje:** TypeScript
*   **Estilos:** Tailwind CSS
*   **Componentes UI:** Shadcn/ui (basado en Radix UI)
*   **Iconografía:** Lucide React
*   **Animaciones:** Framer Motion (`framer-motion`) & `tailwindcss-animate`
*   **Gestión de Estado:** React Hooks (`useState`, `useEffect`, `useForm`)
*   **Base de Datos / Backend:** Supabase (PostgreSQL)

---

## 3. Módulo: Agregar Producto (`/agregar-producto`)

### 3.1. Arquitectura de Pestañas (Tabs)
Se implementó un sistema de navegación por pestañas dinámicas que se adapta a las categorías de insumos:
*   **Categorías Estáticas:** "Perfumería Fina", "Auto (Aromatizante)", "Limpia Pisos".
*   **Categorías Dinámicas:** Se renderizan automáticamente pestañas adicionales basadas en la tabla `insumos_categorias` de la base de datos, excluyendo las estáticas para evitar duplicidad.
*   **Lógica de Formulario:** Al cambiar de pestaña, el formulario adapta ciertos valores por defecto (ej. género "femenino" para perfumería, "ambiente" para autos) para agilizar la carga.

### 3.2. Calculadora de Costos
El núcleo del módulo es la calculadora interactiva que permite componer el costo del producto en tiempo real.

*   **Tipos de Ítem:**
    *   **Insumo:** Elementos físicos (frascos, tapas, alcohol). Se seleccionan de una lista simple.
    *   **Esencia:** El componente principal. Utiliza un buscador avanzado (`Combobox` de Shadcn/ui) que permite filtrar por nombre, género y proveedor.

*   **Lógica de Conversión de Unidades:**
    Se implementó un algoritmo de normalización de precios para manejar diferentes unidades de medida (Litros vs Mililitros):
    *   **Base de Datos:** Los insumos a granel (ej. Alcohol) almacenan su `cantidad_lote` en la unidad mínima (ml/gr). Ejemplo: Un bidón de 5L se guarda como 5000 (ml).
    *   **Input de Usuario:**
        *   Si el usuario selecciona **ml** o **gr**: El cálculo es directo 1:1.
        *   Si el usuario selecciona **Lt** o **Kg**: El sistema multiplica la cantidad por 1000 automáticamente antes de calcular el costo.
    *   **Fórmula:** `Costo = (PrecioLote / CantidadLote) * CantidadUsuario * FactorDeConversion`

### 3.3. UX/UI
*   **Feedback Visual:** Uso de `Sonner` (Toasts) para confirmar acciones o mostrar errores.
*   **Diseño:** Tarjetas con efecto *glassmorphism* (fondo translúcido) y bordes sutiles.
*   **Tabla de Resumen:** Visualización clara de los insumos agregados con desglose de costos (ARS/USD) y eliminación individual.

---

## 4. Módulo: Lista de Precios y Edición

### 4.1. Visualización de Precios (`page.tsx`)
La tabla principal calcula los precios dinámicamente basándose en la composición del producto.
*   **Prioridad de Cálculo:**
    1.  **Personalizado:** Si el producto tiene una lista de `custom_insumos` guardada, el sistema ignora los cálculos por defecto y suma exclusivamente los costos de esos insumos personalizados.
    2.  **Por Defecto:** Si no hay personalización, aplica la lógica estándar (Costo Esencia + Frasco según género + Insumos generales de categoría).

### 4.2. Edición Avanzada (`data-table.tsx`)
Se desarrolló un modal complejo para la edición de productos existentes.

*   **Virtual Insumo ("Esencia"):**
    *   Para garantizar la integridad de los datos, la esencia del producto se muestra como el primer ítem en la lista de insumos de edición.
    *   Es un ítem "virtual" (no se puede borrar) que refleja el costo base y la cantidad de gramos configurada en el producto.

*   **Persistencia de Datos (Supabase):**
    *   Se extendió la tabla `esencias` con columnas JSONB y Numeric para guardar personalizaciones por producto sin afectar al resto:
        *   `custom_insumos` (JSONB): Guarda la lista exacta de ingredientes de ese producto específico.
        *   `margen_minorista` (Numeric): Permite sobrescribir el margen del proveedor.
        *   `margen_mayorista` (Numeric): Permite definir un margen específico para venta mayorista.

*   **Mejoras de Interfaz:**
    *   **Scroll en Modal:** Se limitó la altura del modal (`max-h-[85vh]`) para evitar desbordes en pantallas pequeñas.
    *   **Simetría:** Inputs de precios ARS/USD alineados visualmente.

---

## 5. Base de Datos
Consultas clave y estructuras utilizadas:
*   **Tablas:** `esencias`, `insumos`, `insumos_categorias`, `proveedores`.
*   **Estrategia JSONB:** Se optó por una columna JSONB para `custom_insumos` para permitir una flexibilidad total en la composición del producto sin necesidad de crear tablas intermedias complejas para cada variación única.

---
*Este documento certifica la entrega funcional de las características solicitadas al 08/12/2025.*
