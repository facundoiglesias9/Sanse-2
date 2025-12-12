"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import { Perfume } from "@/app/types/perfume";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, Pencil, Trash2, ShoppingCart } from "lucide-react";
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
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Perfume
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <p className="font-bold">{row.getValue("nombre")}</p>,
  },
  {
    accessorKey: "insumos_categorias.nombre", // Accessor for potential sorting
    id: "categoria",
    header: "Categoría",
    cell: ({ row }) => {
      const categoria = row.original.insumos_categorias?.nombre;

      if (!categoria) return <Badge variant="outline">Sin categoría</Badge>;

      // Override específico para "Perfumería fina" como pidió el usuario
      if (categoria.toLowerCase().includes("perfumería fina") || categoria.toLowerCase() === "fina") {
        return (
          <Badge className="bg-lime-100 text-lime-800 hover:bg-lime-200 border-transparent" variant="outline">
            {categoria}
          </Badge>
        );
      }

      // Función simple para generar un índice consistente basado en el string
      const getHash = (str: string) => {
        let hash = 5381; // Starting with a prime number DJB2-ish
        for (let i = 0; i < str.length; i++) {
          hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return hash;
      };

      // Paleta de colores pastel modificada para evitar colisiones con el violeta/lila de los proveedores
      // Se eliminaron violet, fuchsia, indigo. Se priorizan colores frescos y distintos.
      const PASTEL_COLORS = [
        "bg-teal-100 text-teal-800 hover:bg-teal-200 border-transparent",      // 0: Teal
        "bg-orange-100 text-orange-800 hover:bg-orange-200 border-transparent", // 1: Orange
        "bg-sky-100 text-sky-800 hover:bg-sky-200 border-transparent",          // 2: Sky Blue
        "bg-lime-100 text-lime-800 hover:bg-lime-200 border-transparent",       // 3: Lime
        "bg-rose-100 text-rose-800 hover:bg-rose-200 border-transparent",       // 4: Rose (Distinct enough from purple)
        "bg-amber-100 text-amber-800 hover:bg-amber-200 border-transparent",    // 5: Amber
        "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-transparent", // 6: Emerald
        "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-transparent",       // 7: Cyan
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-transparent", // 8: Yellow
        "bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent",    // 9: Slate (Neutral)
      ];

      const colorIndex = Math.abs(getHash(categoria)) % PASTEL_COLORS.length;
      const colorClass = PASTEL_COLORS[colorIndex];

      return (
        <Badge className={colorClass} variant="outline">
          {categoria}
        </Badge>
      );
    },
  },
  {
    accessorKey: "costo",
    header: "Al costo",
    cell: ({ row }) => {
      const costo = row.getValue("costo") as number;
      return <p>{formatCurrency(costo, "ARS", 0)}</p>;
    },
  },
  {
    accessorKey: "precio",
    header: "Precio",
    cell: ({ row }) => {
      const precio = row.getValue("precio") as number;
      const precioRedondeadoCien = redondearAlCienMasCercano(precio);
      const precioRedondeadoMil = redondearAlMilMasCercano(precio);
      const insumosCategoriasId = row.original.insumos_categorias_id;

      return (
        <p className="font-bold">
          {insumosCategoriasId === "999b53c3-f181-4910-86fd-5c5b1f74af7b"
            ? formatCurrency(precioRedondeadoMil, "ARS", 0)
            : formatCurrency(precioRedondeadoCien, "ARS", 0)}
        </p>
      );
    },
  },
  {
    accessorKey: "precio_mayorista",
    header: "Precio mayorista",
    cell: ({ row }) => {
      const precioMayorista = row.getValue("precio_mayorista") as number;
      const precioMayoristaRedondeadoCien =
        redondearAlCienMasCercano(precioMayorista);
      const precioMayoristaRedondeadoMil =
        redondearAlMilMasCercano(precioMayorista);
      const insumosCategoriasId = row.original.insumos_categorias_id;

      return (
        <p className="font-bold">
          {insumosCategoriasId === "999b53c3-f181-4910-86fd-5c5b1f74af7b"
            ? formatCurrency(precioMayoristaRedondeadoMil, "ARS", 0)
            : formatCurrency(precioMayoristaRedondeadoCien, "ARS", 0)}
        </p>
      );
    },
  },
  {
    accessorKey: "proveedor_id",
    header: "Proveedor",
    filterFn: (row, id, value) => {
      if (!value) return true;
      return row.getValue(id) === value;
    },
    cell: ({ row }) => {
      const proveedor = row.original.proveedores;
      if (!proveedor) return <Badge variant="outline">N/A</Badge>;
      return (
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
      );
    },
  },
  {
    accessorKey: "genero",
    header: "Género",
    cell: ({ row }) => {
      const genero = row.getValue("genero") as string;
      return (
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
      );
    },
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      return (
        <div className="flex items-center gap-2">
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
    // Hide 'acciones' column for revendedores
    if (col.id === "acciones" && userRole === "revendedor") return false;

    // Hide 'proveedor' column for revendedores
    if ("accessorKey" in col && (col as any).accessorKey === "proveedor_id" && userRole === "revendedor") return false;

    // If column has no accessorKey, it's likely 'select' or 'acciones', keep them always?
    // 'select' has id='select'
    // 'acciones' has id='acciones'
    // 'insumos_categorias.nombre' has id='categoria'
    if (!("accessorKey" in col) && col.id !== "select" && col.id !== "acciones" && col.id !== "categoria") return true;

    const key = (col as any).accessorKey;

    if (view === "minorista") {
      // In minorista, hide wholesale price
      if (key === "precio_mayorista") return false;
    } else if (view === "mayorista") {
      // In mayorista, hide 'costo' and retail 'precio'
      if (key === "costo") return false;
      if (key === "precio") return false;
    }

    return true;
  });

  // Always use the cart select column for both views
  return columns.map(col => col.id === "select" ? cartSelectColumn : col);
};
