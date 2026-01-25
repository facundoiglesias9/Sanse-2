"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Perfume } from "@/app/types/perfume";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, Pencil, Trash2, ShoppingCart, ArrowUp, ArrowDown } from "lucide-react";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import {
  redondearAlCienMasCercano,
  redondearAlMilMasCercano,
} from "@/app/helpers/redondear";

const cartSelectColumn: ColumnDef<Perfume> = {
  id: "select",
  header: () => (
    <div className="flex justify-center my-auto h-full items-center">
      <ShoppingCart className="text-muted-foreground opacity-50" size={16} />
    </div>
  ),
  cell: ({ row }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => row.toggleSelected(!row.getIsSelected())}
      title={row.getIsSelected() ? "Quitar del carrito" : "Agregar al carrito"}
    >
      <ShoppingCart
        size={16}
        className={row.getIsSelected() ? "text-primary fill-primary" : "text-muted-foreground"}
      />
    </Button>
  ),
  enableSorting: false,
  enableHiding: false,
};

const allColumns: ColumnDef<Perfume>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todas las filas"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {

    accessorKey: "nombre",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0 hover:bg-transparent"
        >
          Perfume
          {isSorted === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : isSorted === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => <p className="font-bold break-words">{row.getValue("nombre")}</p>,
  },
  {
    id: "disponibilidad",
    header: () => <div className="text-center">Disponibilidad</div>,
    cell: ({ row }) => {
      const stock = row.original.stock_al_momento;
      return (
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className={
              stock
                ? "bg-green-100 text-green-800 hover:bg-green-200 border-transparent whitespace-nowrap"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-transparent whitespace-nowrap"
            }
          >
            {stock ? "Stock disponible" : "A pedido"}
          </Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      if (value === "todos") return true;
      const stock = row.original.stock_al_momento;
      if (value === "disponibles") return stock === true;
      if (value === "pedidos") return stock === false;
      return true;
    },
  },
  {
    accessorKey: "insumos_categorias.nombre", // Accessor para ordenamiento potencial
    id: "categoria",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0 hover:bg-transparent"
        >
          Categoría
          {isSorted === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : isSorted === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const categoria = row.original.insumos_categorias?.nombre;

      if (!categoria) return <div className="flex justify-center"><Badge variant="outline">Sin categoría</Badge></div>;

      // Override específico para "Perfumería fina" como pidió el usuario
      if (categoria.toLowerCase().includes("perfumería fina") || categoria.toLowerCase() === "fina") {
        return (
          <div className="flex justify-center">
            <Badge className="bg-lime-100 text-lime-800 hover:bg-lime-200 border-transparent" variant="outline">
              {categoria}
            </Badge>
          </div>
        );
      }

      // Función simple para generar un índice consistente basado en el string
      const getHash = (str: string) => {
        let hash = 5381; // Empezando con un número primo estilo DJB2
        for (let i = 0; i < str.length; i++) {
          hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return hash;
      };

      // Paleta de colores pastel modificada para evitar colisiones con el violeta/lila de los proveedores
      // Se eliminaron violet, fuchsia, indigo. Se priorizan colores frescos y distintos.
      const PASTEL_COLORS = [
        "bg-teal-100 text-teal-800 hover:bg-teal-200 border-transparent",      // 0: Verde azulado
        "bg-orange-100 text-orange-800 hover:bg-orange-200 border-transparent", // 1: Naranja
        "bg-sky-100 text-sky-800 hover:bg-sky-200 border-transparent",          // 2: Azul cielo
        "bg-lime-100 text-lime-800 hover:bg-lime-200 border-transparent",       // 3: Lima
        "bg-rose-100 text-rose-800 hover:bg-rose-200 border-transparent",       // 4: Rosa (Lo suficientemente distinto del púrpura)
        "bg-amber-100 text-amber-800 hover:bg-amber-200 border-transparent",    // 5: Ámbar
        "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-transparent", // 6: Esmeralda
        "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-transparent",       // 7: Cian
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-transparent", // 8: Amarillo
        "bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent",    // 9: Pizarra (Neutral)
      ];

      const colorIndex = Math.abs(getHash(categoria)) % PASTEL_COLORS.length;
      const colorClass = PASTEL_COLORS[colorIndex];

      return (
        <div className="flex justify-center">
          <Badge className={colorClass} variant="outline">
            {categoria}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "costo",
    header: () => <div className="text-center">Al costo</div>,
    cell: ({ row }) => {
      const costo = row.getValue("costo") as number;
      return <div className="text-center font-medium text-muted-foreground">{formatCurrency(costo, "ARS", 0)}</div>;
    },
  },
  {
    id: "cantidad",
    header: () => <div className="text-center">Cantidad</div>,
    cell: ({ row }) => {
      const categoria = row.original.insumos_categorias?.nombre || "";
      const isPerfumeria = categoria.toLowerCase().includes("perfumería fina") || categoria.toLowerCase() === "fina";

      if (isPerfumeria) {
        // Visualmente "100 ml" como solicitado, sin tocar datos ni leer nada
        return <div className="text-center">100 ml</div>;
      }
      return <div className="text-center text-muted-foreground text-xs">N/A</div>;
    },
  },
  {
    accessorKey: "precio",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <div className="text-center flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent"
          >
            Precio
            {isSorted === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : isSorted === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const precio = row.getValue("precio") as number;
      const precioRedondeadoCien = redondearAlCienMasCercano(precio);
      const precioRedondeadoMil = redondearAlMilMasCercano(precio);
      const insumosCategoriasId = row.original.insumos_categorias_id;

      return (
        <div className="text-center font-bold">
          {insumosCategoriasId === "999b53c3-f181-4910-86fd-5c5b1f74af7b"
            ? formatCurrency(precioRedondeadoMil, "ARS", 0)
            : formatCurrency(precioRedondeadoCien, "ARS", 0)}
        </div>
      );
    },
  },
  {
    accessorKey: "precio_mayorista",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <div className="text-center flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent"
          >
            Precio mayorista
            {isSorted === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : isSorted === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const precioMayorista = row.getValue("precio_mayorista") as number;
      const precioMayoristaRedondeadoCien =
        redondearAlCienMasCercano(precioMayorista);
      const precioMayoristaRedondeadoMil =
        redondearAlMilMasCercano(precioMayorista);
      const insumosCategoriasId = row.original.insumos_categorias_id;

      return (
        <div className="text-center font-bold">
          {insumosCategoriasId === "999b53c3-f181-4910-86fd-5c5b1f74af7b"
            ? formatCurrency(precioMayoristaRedondeadoMil, "ARS", 0)
            : formatCurrency(precioMayoristaRedondeadoCien, "ARS", 0)}
        </div>
      );
    },
  },
  {
    accessorKey: "proveedor_id",
    header: () => <div className="text-center">Proveedor</div>,
    filterFn: (row, id, value) => {
      if (!value) return true;
      return row.getValue(id) === value;
    },
    cell: ({ row }) => {
      const proveedor = row.original.proveedores;
      if (!proveedor) return <div className="flex justify-center"><Badge variant="outline">N/A</Badge></div>;
      return (
        <div className="flex justify-center">
          <Badge
            variant={
              [
                "default",
                "secondary",
                "destructive",
                "outline",
                "warning",
                "success",
                "indigo",
                "pink",
                "purple",
              ].includes(proveedor.color as string)
                ? (proveedor.color as
                  | "default"
                  | "secondary"
                  | "destructive"
                  | "outline"
                  | "warning"
                  | "success"
                  | "indigo"
                  | "pink"
                  | "purple")
                : "default"
            }
          >
            {proveedor.nombre}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "genero",
    header: () => <div className="text-center">Género</div>,
    cell: ({ row }) => {
      const genero = row.getValue("genero") as string;
      return (
        <div className="flex justify-center">
          <Badge
            variant={genero === "masculino"
              ? "indigo"
              : genero === "femenino"
                ? "pink"
                : genero === "ambiente"
                  ? "warning"
                  : "default"
            }
          >
            {capitalizeFirstLetter(genero)}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "familia_olfativa",
    header: () => <div className="text-center">Familia Olfativa</div>,
    filterFn: (row, id, value) => {
      if (!value) return true;
      const rowValue = row.getValue(id) as string | null;
      if (!rowValue) return false;
      return rowValue.includes(value);
    },
    cell: ({ row }) => {
      const val = row.getValue("familia_olfativa") as string | null;
      if (!val) return <div className="text-center">-</div>;
      return (
        <div className="flex justify-center">
          <Badge variant="outline" className="max-w-[150px] truncate block" title={val}>
            {val}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "acciones",
    header: () => <div className="text-center">Acciones</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      return (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
            onClick={() => meta?.editProduct(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
            onClick={() => meta?.deleteProduct(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];

export const getListaPreciosColumns = (
  view: "minorista" | "mayorista" = "minorista",
  userRole: string = "admin"
): ColumnDef<Perfume>[] => {
  const columns = allColumns.filter((col) => {
    const isNonAdmin = userRole === "revendedor" || userRole === "comprador";

    // Ocultar columna 'acciones' para no administradores
    if (col.id === "acciones" && isNonAdmin) return false;

    // Ocultar columna 'proveedor' para no administradores
    if ("accessorKey" in col && (col as any).accessorKey === "proveedor_id" && isNonAdmin) return false;

    // Ocultar columna 'costo' explícitamente para compradores (al estar en vista minorista, se mostraría por defecto)
    if ("accessorKey" in col && (col as any).accessorKey === "costo" && userRole === "comprador") return false;

    // Si la columna no tiene accessorKey, es probablemente 'select' o 'acciones' o 'categoria'
    if (!("accessorKey" in col) && col.id !== "select" && col.id !== "acciones" && col.id !== "categoria") return true;

    const key = (col as any).accessorKey;

    if (view === "minorista") {
      // En minorista, ocultar precio mayorista
      if (key === "precio_mayorista") return false;
    } else if (view === "mayorista") {
      // En mayorista, ocultar 'costo' y 'precio' minorista
      if (key === "costo") return false;
      if (key === "precio") return false;
    }

    // Ocultar familia olfativa si es comprador? (Opcional, pero el usuario pidió filtrar, así que dejarlo)

    return true;
  });

  // Siempre usar la columna de selección del carrito para ambas vistas
  return columns.map(col => col.id === "select" ? cartSelectColumn : col);
};
