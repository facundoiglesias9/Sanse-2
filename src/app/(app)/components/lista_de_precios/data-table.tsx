"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { formatCurrency } from "@/app/helpers/formatCurrency";
import {
  redondearAlCienMasCercano,
  redondearAlMilMasCercano,
} from "@/app/helpers/redondear";
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter";
import { Perfume } from "@/app/types/perfume";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Download, ShoppingCart, Loader2, Trash2, FileSpreadsheet } from "lucide-react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

import { Label } from "@/components/ui/label";

interface DataTableProps {
  columns: ColumnDef<Perfume, any>[];
  data: Perfume[];
  isLoading?: boolean;
  filterColumnId?: string;
  onDataUpdate?: () => void;
  view?: "minorista" | "mayorista";
  userRole?: string;
}

export function DataTable({
  columns,
  data,
  isLoading = false,
  filterColumnId = "nombre",
  onDataUpdate,
  view = "minorista",
  userRole = "admin",
}: DataTableProps) {
  const supabase = createClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [ventaPerfumes, setVentaPerfumes] = useState<VentaPerfumeItem[]>([]);
  const [cliente, setCliente] = useState("");

  // Edit / Delete State
  const [productToDelete, setProductToDelete] = useState<Perfume | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [productToEdit, setProductToEdit] = useState<Perfume | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrecioArs, setEditPrecioArs] = useState("");
  const [editPrecioUsd, setEditPrecioUsd] = useState("");

  // New Edit State
  const [editMargenMinorista, setEditMargenMinorista] = useState("");
  const [editMargenMayorista, setEditMargenMayorista] = useState("");
  const [editInsumos, setEditInsumos] = useState<InsumoLite[]>([]);

  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // cacheamos insumos para calcular costo de envases y filtros
  const [insumos, setInsumos] = useState<InsumoLite[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string; }[]>([]);
  const [insumosCategorias, setInsumosCategorias] = useState<{ id: string; nombre: string; }[]>([]);

  // ... (Keep existing ID constants and types)
  const [isAddingInsumo, setIsAddingInsumo] = useState(false);
  const [selectedInsumoId, setSelectedInsumoId] = useState("");
  const [newInsumoQty, setNewInsumoQty] = useState("1");

  const CAT_AROMATIZANTES_ID = "999b53c3-f181-4910-86fd-5c5b1f74af7b";
  const LIMPIA_PISOS_CAT_ID = "6944056a-4b9c-4102-a368-7c2b9ff77d5a";

  const handleAddInsumo = () => {
    if (!selectedInsumoId || !newInsumoQty) return;
    const insumoOriginal = insumos.find(i => i.id === selectedInsumoId);
    if (!insumoOriginal) return;

    const newInsumo: InsumoLite = {
      ...insumoOriginal,
      cantidad_necesaria: parseFloat(newInsumoQty) || 1,
    };

    setEditInsumos([...editInsumos, newInsumo]);
    setIsAddingInsumo(false);
    setSelectedInsumoId("");
    setNewInsumoQty("1");
  };

  type Genero = "masculino" | "femenino" | "otro";
  type FrascoLP = "botella" | "bidon";

  type VentaPerfumeItem = {
    perfume: Perfume;
    cliente: string;
    genero: Genero;
    cantidad: number;
    frascoLP?: FrascoLP;
    devuelveEnvase?: boolean;
    priceType: "precio" | "costo";
  };

  type InsumoLite = {
    id: string;
    nombre: string;
    cantidad_necesaria: number;
    cantidad_lote: number;
    precio_lote: number;
    is_general: boolean;
    insumos_categorias_id: string | null;
  };

  // ... (Keep existing helpers: norm, unitCost, getEnvaseUnitCost, computePrecioUnitario, useEffect)
  const norm = (s: string | null | undefined) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const unitCost = (i: InsumoLite | null | undefined) => {
    if (!i || i.cantidad_lote <= 0) return 0;
    return (i.precio_lote / i.cantidad_lote) * i.cantidad_necesaria;
  };

  const getEnvaseUnitCost = (perfume: Perfume, frascoLP?: FrascoLP) => {
    if (perfume.insumos_categorias_id !== LIMPIA_PISOS_CAT_ID) return 0;
    const list = insumos.filter(
      (x) => x.insumos_categorias_id === LIMPIA_PISOS_CAT_ID
    );

    let match: InsumoLite | undefined;
    if (frascoLP === "bidon") {
      match =
        list.find((i) => /(bidon|bidón)/.test(norm(i.nombre))) ||
        list.find((i) => /bidon/.test(norm(i.nombre)));
    } else {
      match = list.find((i) => /botella/.test(norm(i.nombre)));
    }
    return unitCost(match);
  };

  const computePrecioUnitario = (
    perfume: Perfume,
    usarMayorista: boolean,
    frascoLP?: FrascoLP,
    priceType: "precio" | "costo" = "precio"
  ) => {
    if (priceType === "costo") {
      return redondearAlCienMasCercano(perfume.costo);
    }
    const isLP = perfume.insumos_categorias_id === LIMPIA_PISOS_CAT_ID;
    const base = isLP ? perfume.precio : (usarMayorista ? perfume.precio_mayorista : perfume.precio);
    const factorLP = isLP && frascoLP === "bidon" ? 5 : 1;
    const precioContenedor = base * factorLP;
    const esAmbiente = perfume.insumos_categorias_id === CAT_AROMATIZANTES_ID;
    return esAmbiente
      ? redondearAlMilMasCercano(precioContenedor)
      : redondearAlCienMasCercano(precioContenedor);
  };

  useEffect(() => {
    (async () => {
      const [{ data: provs }, { data: ins }, { data: cats }] = await Promise.all([
        supabase.from("proveedores").select("id, nombre").order("nombre", { ascending: true }),
        supabase
          .from("insumos")
          .select("id,nombre,cantidad_necesaria,cantidad_lote,precio_lote,is_general,insumos_categorias_id"),
        supabase.from("insumos_categorias").select("id, nombre").order("nombre", { ascending: true }),
      ]);
      if (provs) setProveedores(provs);
      if (ins) setInsumos(ins as unknown as InsumoLite[]);
      if (cats) setInsumosCategorias(cats);
    })();
  }, []);

  // Handlers
  const handleDeleteProduct = (product: Perfume) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleEditProduct = (product: Perfume) => {
    setProductToEdit(product);
    setEditName(product.nombre);
    setEditPrecioArs(product.precio_ars?.toString() || "");
    setEditPrecioUsd(product.precio_usd?.toString() || "");

    // Cargar Márgenes (Personalizados o por Defecto)
    if (product.margen_minorista != null) {
      setEditMargenMinorista(product.margen_minorista.toString());
    } else {
      const provMargin = product.proveedores?.margen_venta || 100;
      setEditMargenMinorista(provMargin.toString());
    }

    if (product.margen_mayorista != null) {
      setEditMargenMayorista(product.margen_mayorista.toString());
    } else {
      // Si no tiene margen mayorista fijo, intentamos calcularlo basado en precios actuales o usamos 15% por defecto
      if (product.costo > 0) {
        const implied = ((product.precio_mayorista - product.costo) / product.costo) * 100;
        setEditMargenMayorista(Math.round(implied).toString());
      } else {
        setEditMargenMayorista("15");
      }
    }

    // Cargar Insumos (Prioridad: Personalizados > Categoría Genérica)
    let baseInsumos: InsumoLite[] = [];
    if (product.custom_insumos && Array.isArray(product.custom_insumos) && product.custom_insumos.length > 0) {
      // Cargar insumos guardados específicamente para este producto
      baseInsumos = product.custom_insumos.map((ci: any) => {
        const live = insumos.find((i) => i.id === ci.id);
        return {
          ...ci,
          // Priorizamos datos vivos para costos, pero mantenemos la cantidad de la receta
          cantidad_necesaria: ci.cantidad_necesaria || ci.cantidad || 0,
          precio_lote: live?.precio_lote || 0,
          cantidad_lote: live?.cantidad_lote || 1, // Avoid division by zero
          is_general: live?.is_general ?? ci.is_general,
          insumos_categorias_id: live?.insumos_categorias_id ?? ci.insumos_categorias_id,
          nombre: live?.nombre || ci.nombre,
        };
      });
    } else {
      // Si no, cargar los insumos genéricos de la categoría
      baseInsumos = insumos.filter(i =>
        i.is_general && i.insumos_categorias_id === product.insumos_categorias_id
      );
    }

    // Crear Insumo Virtual para Esencia
    // Representa el costo base de la esencia (Costo Base ARS) y se muestra como primer ítem
    // cantidad_lote = Tamaño de la botella (ej: 100g)
    // cantidad_necesaria = Gramos usados por perfume (ej: 20g o 15g según proveedor)
    const gramosPorPerfume = product.proveedores?.gramos_configurados || 1;

    const esenciaInsumo: InsumoLite = {
      id: "virtual-esencia",
      nombre: `Esencia: ${product.nombre}`,
      cantidad_necesaria: gramosPorPerfume,
      cantidad_lote: product.cantidad_gramos || 1,
      precio_lote: product.precio_ars || 0,
      is_general: false,
      insumos_categorias_id: null
    };

    setEditInsumos([esenciaInsumo, ...baseInsumos]);

    setIsEditDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      const { error } = await supabase.from("esencias").delete().eq("id", productToDelete.id);
      if (error) throw error;
      toast.success("Producto eliminado correctamente");
      onDataUpdate?.();
    } catch (e: any) {
      toast.error("Error al eliminar: " + e.message);
    } finally {
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const saveEdit = async () => {
    if (!productToEdit) return;
    setIsSavingEdit(true);
    try {
      // Preparar Insumos Personalizados (excluyendo la esencia virtual)
      // Filtramos la "virtual-esencia" porque esa información ya vive en las columnas del producto (precio_ars, cantidad_gramos)
      // Guardamos solo los insumos adicionales para persistir la configuración única de este producto.
      const customInsumosToSave = editInsumos
        .filter(i => i.id !== "virtual-esencia")
        .map(i => ({
          id: i.id,
          nombre: i.nombre,
          cantidad_necesaria: i.cantidad_necesaria,
          cantidad_lote: i.cantidad_lote,
          precio_lote: i.precio_lote,
          is_general: i.is_general,
          insumos_categorias_id: i.insumos_categorias_id
        }));

      const updates: any = {
        nombre: editName,
        margen_minorista: parseFloat(editMargenMinorista) || null,
        margen_mayorista: parseFloat(editMargenMayorista) || null,
        custom_insumos: customInsumosToSave.length > 0 ? customInsumosToSave : null
      };

      if (editPrecioArs !== "") updates.precio_ars = parseFloat(editPrecioArs) || null;
      if (editPrecioUsd !== "") updates.precio_usd = parseFloat(editPrecioUsd) || null;

      const { error } = await supabase.from("esencias").update(updates).eq("id", productToEdit.id);
      if (error) throw error;

      toast.success("Producto actualizado correctamente");
      onDataUpdate?.();
      setIsEditDialogOpen(false);
    } catch (e: any) {
      toast.error("Error al actualizar: " + e.message);
      console.error(e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
    meta: {
      deleteProduct: handleDeleteProduct,
      editProduct: handleEditProduct,
    },
  });

  const filterValue =
    (table.getColumn(filterColumnId)?.getFilterValue() as string) ?? "";

  // Export State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({
    perfume: true,
    precio: true,
    genero: true,
    proveedor: false,
    categoria: false,
  });

  const [exportSelectedProviders, setExportSelectedProviders] = useState<string[]>([]);
  const [exportSelectedCategories, setExportSelectedCategories] = useState<string[]>([]);
  const [exportSelectedGenders, setExportSelectedGenders] = useState<string[]>(["masculino", "femenino"]);

  // Set default selections matching user preference
  useEffect(() => {
    if (proveedores.length > 0 && exportSelectedProviders.length === 0) {
      // Default: Only "Van Rossum"
      const defaultProvs = proveedores
        .filter(p => p.nombre.toLowerCase().includes("van rossum"))
        .map(p => p.id);

      // If found, set it. if not found (e.g. name changed), we might fallback to all or none.
      // Let's fallback to "None" so user sees empty (or check if array empty).
      if (defaultProvs.length > 0) {
        setExportSelectedProviders(defaultProvs);
      }
    }
  }, [proveedores]);

  useEffect(() => {
    if (insumosCategorias.length > 0 && exportSelectedCategories.length === 0) {
      // Default: Only "Perfumería fina"
      const defaultCats = insumosCategorias
        .filter(c => c.nombre.toLowerCase().includes("perfumería fina") || c.nombre.toLowerCase().includes("perfumeria fina"))
        .map(c => c.id);

      if (defaultCats.length > 0) {
        setExportSelectedCategories(defaultCats);
      }
    }
  }, [insumosCategorias]);


  function handleExportClick() {
    // NO autoseleccionar todo si está vacío. Queremos respetar los defaults o la selección vacía del usuario.
    // La inicialización sucede en useEffect.
    setIsExportDialogOpen(true);
  }

  function exportToExcel() {
    // Obtener la fecha / mes actual
    const now = new Date();
    const mesActual = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(now);
    const mesTitulo = capitalizeFirstLetter(mesActual);
    const mesSlug = mesActual.toLowerCase().replace(/\s+/g, "_");
    const titulo = `Lista ${capitalizeFirstLetter(view ?? "precios")} - ${mesTitulo}`;

    const precioRedondeado = (row: Perfume, usarMayorista: boolean) => {
      const isLP = row.insumos_categorias_id === LIMPIA_PISOS_CAT_ID;
      // Limpia Pisos NO usa mayorista
      const base = isLP ? row.precio : (usarMayorista ? row.precio_mayorista : row.precio);

      const esAmbiente = row.insumos_categorias_id === CAT_AROMATIZANTES_ID;
      return esAmbiente ? redondearAlMilMasCercano(base) : redondearAlCienMasCercano(base);
    };

    const filtrarMasCaro = (arr: Perfume[], usarMayorista: boolean) => {
      const map = new Map<string, Perfume & { _precioCalc: number; }>();
      for (const row of arr) {
        const key = `${row.nombre}_${row.genero}`;
        const p = precioRedondeado(row, usarMayorista);
        const prev = map.get(key);
        if (!prev || p > prev._precioCalc) map.set(key, { ...row, _precioCalc: p });
      }
      return Array.from(map.values());
    };

    const autoFit = (rows: Record<string, any>[]) => {
      if (!rows.length) return [];
      const headers = Object.keys(rows[0]);
      const getLength = (v: any) => (v == null ? "" : String(v)).length;
      return headers.map((h) => {
        const max = Math.max(getLength(h), ...rows.map((r) => getLength(r[h])));
        return { wch: Math.min(Math.max(max + 2, 8), 60) };
      });
    };

    const wb = XLSX.utils.book_new();

    const crearHojaConTitulo = (rows: Record<string, any>[], name: string) => {
      // 1) Hoja con título en A1 y una fila en blanco (A2)
      const ws = XLSX.utils.aoa_to_sheet([[titulo], []]);

      // 2) Agregar JSON empezando en A3 (fila 3)
      XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });

      // 3) Auto ancho
      (ws as any)["!cols"] = autoFit(rows);

      // 4) Merge del título desde A1 hasta última columna de la tabla
      const colCount = rows.length ? Object.keys(rows[0]).length : 1;
      const lastCol = colCount - 1;
      const merges = (ws as any)["!merges"] ?? [];
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }); // A1 -> A1+lastCol
      (ws as any)["!merges"] = merges;

      XLSX.utils.book_append_sheet(wb, ws, name);
    };


    // Nota: applyFilters ya maneja el filtrado por género, pero queremos dividir por género.
    // Así que deberíamos:
    // 1. Obtener datos filtrados (por proveedor/categoría).
    // 2. Iterar a través de los géneros seleccionados.
    // 3. Para cada género, filtrar el subconjunto y generar la hoja.

    // Auxiliar: aplicar filtros NO GÉNERO primero
    const applyCommonFilters = (rows: Perfume[]) => {
      return rows.filter(row => {
        // Filtro de Proveedor
        if (!exportSelectedProviders.includes(row.proveedor_id)) return false;

        // Filtro de Categoría
        const catId = row.insumos_categorias_id;
        // Manejar categoría nula -> normalmente no debería ocurrir, pero si es así, ¿incluir o excluir?
        if (catId && !exportSelectedCategories.includes(catId)) return false;

        return true;
      });
    };

    const commonFiltered = applyCommonFilters(view === "minorista" ? data : data);

    // Loop through selected genders to create sheets
    exportSelectedGenders.forEach(genderKey => {
      const genderData = commonFiltered.filter(row => {
        const rowGen = row.genero || "otro";
        // Asegurarse de que coincida con las claves en exportSelectedGenders
        return rowGen === genderKey;
      });

      if (genderData.length === 0) return; // Skip empty sheets

      const processedData = filtrarMasCaro(genderData, view === "mayorista").map((row) => {
        const obj: any = {};
        if (exportColumns.perfume) obj["Perfume"] = row.nombre;
        // Usar precio apropiado según vista
        if (view === "mayorista") {
          if (exportColumns.precio) obj["Precio Mayorista"] = formatCurrency(precioRedondeado(row, true), "ARS", 0);
        } else {
          if (exportColumns.precio) obj["Precio"] = formatCurrency(precioRedondeado(row, false), "ARS", 0);
        }
        if (exportColumns.genero) obj["Género"] = capitalizeFirstLetter(row.genero);
        if (exportColumns.proveedor) obj["Proveedor"] = proveedores.find(p => p.id === row.proveedor_id)?.nombre || "";
        if (exportColumns.categoria) obj["Categoría"] = insumosCategorias.find(c => c.id === row.insumos_categorias_id)?.nombre || "";
        return obj;
      });

      const sheetName = capitalizeFirstLetter(genderKey);
      // Sanitize sheet name just in case (max 31 chars, etc, though likely fine here)
      crearHojaConTitulo(processedData, sheetName);
    });

    const id = toast.loading("Generando archivo...");
    try {
      XLSX.writeFile(wb, `lista_${view}_${mesSlug}.xlsx`, { bookType: "xlsx", type: "binary" });
      toast.success("Descarga iniciada", { id, duration: 2000 });
      setIsExportDialogOpen(false);
    } catch (e) {
      toast.error("Hubo un problema al generar el archivo", { id });
    }
  }


  const handleSubmit = async (
    totalPrice: number,
    perfumesVendidos: {
      perfume: Perfume;
      cliente: string;
      genero: Genero;
      cantidad: number;
      frascoLP?: FrascoLP;
      devuelveEnvase?: boolean;
      priceType: "precio" | "costo";
    }[],
  ) => {
    setIsLoadingForm(true);

    const conjuntoDePerfumes = perfumesVendidos
      .map(({ perfume, genero, cantidad, frascoLP, devuelveEnvase, priceType }) => {
        const precioBaseUnit = computePrecioUnitario(perfume, view === "mayorista", frascoLP, priceType);
        const descuentoEnvase = devuelveEnvase ? getEnvaseUnitCost(perfume, frascoLP) : 0;
        const precioUnitFinal = Math.max(0, precioBaseUnit - descuentoEnvase);
        const envaseTxt =
          perfume.insumos_categorias_id === LIMPIA_PISOS_CAT_ID
            ? ` - Envase: ${frascoLP === "bidon" ? "Bidón (5L)" : "Botella (1L)"}${devuelveEnvase ? " (devolvió envase)" : ""}`
            : "";
        const tipoPrecioTxt = priceType === "costo" ? " [AL COSTO]" : "";
        return `${perfume.nombre} x ${cantidad} - ${genero} [$${precioUnitFinal}]${envaseTxt}${tipoPrecioTxt}`;
      })
      .join("; ");

    const cantidadTotal = perfumesVendidos.reduce((sum, p) => sum + p.cantidad, 0);

    const { error } = await supabase.from("ventas").insert([
      {
        created_at: new Date(),
        cliente: cliente,
        cantidad_perfumes: cantidadTotal,
        precio_total: totalPrice,
        perfumes: conjuntoDePerfumes,
        is_reseller_sale: userRole === "revendedor",
      },
    ]);

    if (error) {
      toast.error("Error al agregar la venta.");
      console.error("Error al agregar la venta:", error);
    } else {
      toast.success("¡Venta agregada correctamente!");
      setVentaPerfumes([]);
      setCliente("");
      setIsDialogOpen(false);
    }

    setIsLoadingForm(false);
    await actualizarInventarioDespuesVenta(perfumesVendidos);
    setRowSelection({});
  };

  const handleAgregarVenta = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("Debes seleccionar al menos un perfume.");
      return;
    }
    const perfumes = selectedRows.map((row) => row.original);
    const perfumesConCantidad: VentaPerfumeItem[] = perfumes.map((perfume) => ({
      perfume,
      cliente: "",
      genero: (perfume.genero as Genero) ?? "otro",
      cantidad: 1,
      frascoLP: perfume.insumos_categorias_id === LIMPIA_PISOS_CAT_ID ? "botella" : undefined,
      devuelveEnvase: false,
      priceType: "precio",
    }));
    setVentaPerfumes(perfumesConCantidad);

    // Autocompletar nombre de cliente para revendedores
    if (userRole === "revendedor") {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre')
          .eq('id', session.user.id)
          .single();

        if (profile?.nombre) {
          setCliente(profile.nombre);
        }
      }
    }

    setIsDialogOpen(true);
  };

  const handleCloseModal = () => setIsDialogOpen(false);

  function findInventario<T extends { nombre: string; tipo: string; genero?: string | null; }>(
    items: T[] | null | undefined,
    nombre: string,
    tipo: string,
    genero: string | null,
  ): T | null {
    const list = items || [];
    const nNombre = norm(nombre);
    const nTipo = norm(tipo);
    const nGenero = norm(genero);
    const exact = list.find((i) => norm(i.nombre) === nNombre && norm(i.tipo) === nTipo && norm(i.genero) === nGenero);
    if (exact) return exact;
    const neutral = list.find(
      (i) => norm(i.nombre) === nNombre && norm(i.tipo) === nTipo && (norm(i.genero) === "otro" || norm(i.genero) === ""),
    );
    if (neutral) return neutral;
    const any = list.find((i) => norm(i.nombre) === nNombre && norm(i.tipo) === nTipo);
    return any || null;
  }

  async function actualizarInventarioDespuesVenta(
    perfumesVendidos: {
      perfume: Perfume;
      genero: Genero;
      cantidad: number;
      frascoLP?: FrascoLP;
      devuelveEnvase?: boolean;
    }[],
  ) {
    const { data: inventarioActual } = await supabase.from("inventario").select("*");
    const { data: insumosAll } = await supabase.from("insumos").select("*");

    const invMap = new Map<string, any>((inventarioActual || []).map((i: any) => [i.id, { ...i }]));
    const pending = new Map<string, number>();
    const setCantidad = (id: string, nueva: number) => {
      const it = invMap.get(id);
      if (!it) return;
      it.cantidad = nueva;
      pending.set(id, nueva);
    };
    const decCantidad = (id: string, delta: number) => {
      const it = invMap.get(id);
      if (!it) return;
      const nueva = Math.max(0, Number(it.cantidad) - Number(delta));
      setCantidad(id, nueva);
    };

    for (const item of perfumesVendidos) {
      const { perfume, genero } = item;
      let qtyNecesaria = Number(item.cantidad);
      const isLimpiaPisos = perfume.insumos_categorias_id === LIMPIA_PISOS_CAT_ID;

      // 1) Consumir “Perfume” terminado (por género)
      const perfumeHecho = findInventario(inventarioActual, perfume.nombre, "Perfume", genero) as any | null;
      if (perfumeHecho && Number(perfumeHecho.cantidad) > 0) {
        const disponible = Number(invMap.get(perfumeHecho.id)?.cantidad ?? perfumeHecho.cantidad);
        const aUsar = Math.min(disponible, qtyNecesaria);
        if (aUsar > 0) {
          decCantidad(perfumeHecho.id, aUsar);
          qtyNecesaria -= aUsar;
          if (qtyNecesaria <= 0) continue;
        }
      }

      // 2) Config/consumos
      const insumosCat = (insumosAll || []).filter(
        (x: any) => x.insumos_categorias_id === perfume.insumos_categorias_id,
      );

      const alcoholCfg = insumosCat.find((x: any) => x.is_general && norm(x.nombre).includes("alcohol"));
      const frascoCfg = insumosCat.find(
        (x: any) => x.is_general && (norm(x.nombre).includes("frasco") || norm(x.nombre).includes("perfumero")),
      );

      const especificos = (insumosAll || []).filter((x: any) => !x.is_general && norm(x.nombre) === norm(perfume.nombre));
      const esenciaCfg =
        especificos.length > 0
          ? especificos.reduce((max: any, cur: any) =>
            Number(cur.cantidad_necesaria) > Number(max?.cantidad_necesaria ?? -Infinity) ? cur : max,
            null)
          : null;
      const etiquetaCfg =
        especificos.length > 0
          ? especificos.reduce((min: any, cur: any) =>
            Number(cur.cantidad_necesaria) < Number(min?.cantidad_necesaria ?? Infinity) ? cur : min,
            null)
          : null;

      const PERFUME_CONSUMO_ALCOHOL =
        Number(alcoholCfg?.cantidad_necesaria) > 0 ? Number(alcoholCfg.cantidad_necesaria) : 80;
      const PERFUME_CONSUMO_FRASCO =
        Number(frascoCfg?.cantidad_necesaria) > 0 ? Number(frascoCfg.cantidad_necesaria) : 1;
      const PERFUME_CONSUMO_ESENCIA =
        Number(esenciaCfg?.cantidad_necesaria) > 0 ? Number(esenciaCfg.cantidad_necesaria) : 15;
      const PERFUME_CONSUMO_ETIQUETA =
        Number(etiquetaCfg?.cantidad_necesaria) > 0 ? Number(etiquetaCfg.cantidad_necesaria) : 1;

      if (isLimpiaPisos) {
        // Esencia 75 por unidad SOLO si existe en inventario
        const esenciaInvLP =
          (findInventario(inventarioActual, perfume.nombre, "Esencia", null) as any | null) ||
          (findInventario(inventarioActual, perfume.nombre, "Esencia", "otro") as any | null) ||
          (findInventario(inventarioActual, perfume.nombre, "Esencia", genero) as any | null);
        if (esenciaInvLP) decCantidad(esenciaInvLP.id, 75 * qtyNecesaria);

        // Frasco: descontar únicamente si NO devuelve envase
        if (!item.devuelveEnvase) {
          const frascosAll = (inventarioActual || []).filter((i: any) => i.tipo === "Frasco") as any[];
          let frascoLPtoUse: any | null = null;
          if (item.frascoLP === "botella") {
            frascoLPtoUse = frascosAll.find((i) => /botella/.test(norm(i.nombre))) || null;
          } else if (item.frascoLP === "bidon") {
            frascoLPtoUse = frascosAll.find((i) => /(bidon|bidón)/.test(norm(i.nombre))) || null;
          }
          if (frascoLPtoUse) decCantidad(frascoLPtoUse.id, 1 * qtyNecesaria);
        }
        // Alcohol: NO se descuenta para limpia pisos
      } else {
        // Perfumería fina
        const esenciaInv = findInventario(inventarioActual, perfume.nombre, "Esencia", genero) as any | null;
        if (esenciaInv) decCantidad(esenciaInv.id, PERFUME_CONSUMO_ESENCIA * qtyNecesaria);

        const etiquetaInv = findInventario(inventarioActual, perfume.nombre, "Etiqueta", genero) as any | null;
        if (etiquetaInv) decCantidad(etiquetaInv.id, PERFUME_CONSUMO_ETIQUETA * qtyNecesaria);

        const alcoholInv = (inventarioActual || []).find(
          (i: any) => norm(i.tipo) === "insumo" && norm(i.nombre).includes("alcohol"),
        ) as any | null;
        if (alcoholInv) decCantidad(alcoholInv.id, PERFUME_CONSUMO_ALCOHOL * qtyNecesaria);

        const frascos = (inventarioActual || []).filter((i: any) => i.tipo === "Frasco") as any[];
        const frascoInv =
          frascos.find((i: any) => norm(i.genero) === norm(genero)) ||
          (norm(genero) === "otro"
            ? frascos.find((i: any) => norm(i.nombre).includes("bidon") || norm(i.nombre).includes("bidón"))
            : null) ||
          null;
        if (frascoInv) decCantidad(frascoInv.id, PERFUME_CONSUMO_FRASCO * qtyNecesaria);
      }
    }

    if (pending.size > 0) {
      await Promise.all(
        [...pending.entries()].map(([id, cantidad]) =>
          supabase.from("inventario").update({ cantidad }).eq("id", id),
        ),
      );
    }
  }

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} aria-describedby={undefined}>
        <DialogContent className="sm:max-w-5xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Detalle de la venta</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Input
                required
                type="text"
                placeholder="Nombre del cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                disabled={userRole === "revendedor"}
                className={userRole === "revendedor" ? "bg-muted cursor-not-allowed" : ""}
              />
            </div>
          </div>

          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Producto</TableHead>
                <TableHead className="w-[15%]">Precio</TableHead>
                <TableHead className="w-[20%]">Envase</TableHead>
                <TableHead className="w-[15%] text-center">Cantidad</TableHead>
                <TableHead className="w-[15%] text-right">Subtotal</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
          </Table>

          <ScrollArea className="max-h-[300px]">
            <Table className="table-fixed">
              <TableBody>
                {ventaPerfumes.map((item) => {
                  const unitBase = computePrecioUnitario(item.perfume, view === "mayorista", item.frascoLP, item.priceType);
                  const descEnv = item.devuelveEnvase ? getEnvaseUnitCost(item.perfume, item.frascoLP) : 0;
                  const unitFinal = Math.max(0, unitBase - descEnv);

                  const esLP = item.perfume.insumos_categorias_id === LIMPIA_PISOS_CAT_ID;

                  return (
                    <TableRow key={item.perfume.id} className="hover:bg-muted/50">
                      {/* Producto (Nombre + Género) */}
                      <TableCell className="w-[30%] align-top py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-base">{item.perfume.nombre}</span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                item.perfume.genero === "masculino"
                                  ? "indigo"
                                  : item.perfume.genero === "femenino"
                                    ? "pink"
                                    : "default"
                              }
                              className="w-fit"
                            >
                              {capitalizeFirstLetter(item.perfume.genero)}
                            </Badge>
                            {userRole === "admin" && (
                              <span className="text-xs text-muted-foreground">
                                {proveedores.find(p => p.id === item.perfume.proveedor_id)?.nombre || "Sin proveedor"}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Configuración (Precio) */}
                      <TableCell className="w-[15%] align-top py-4">
                        {view === "mayorista" ? (
                          <div className="flex h-9 items-center px-3 text-sm font-medium text-muted-foreground bg-muted/50 rounded-md border border-transparent">
                            Mayorista
                          </div>
                        ) : (
                          <Select
                            value={item.priceType}
                            onValueChange={(val: "precio" | "costo") => {
                              setVentaPerfumes(prev => prev.map(p => p.perfume.id === item.perfume.id ? { ...p, priceType: val } : p));
                            }}
                          >
                            <SelectTrigger className="h-9 w-[140px] bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="precio">Precio Lista</SelectItem>
                              <SelectItem value="costo">Al Costo</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>

                      {/* Envase (solo LP) */}
                      <TableCell className="w-[20%] align-top py-4">
                        {esLP ? (
                          <div className="flex flex-col gap-2">
                            <Select
                              value={item.frascoLP ?? "botella"}
                              onValueChange={(v: "botella" | "bidon") => {
                                setVentaPerfumes((prev) =>
                                  prev.map((p) =>
                                    p.perfume.id === item.perfume.id ? { ...p, frascoLP: v } : p
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger className="h-9 w-full bg-background">
                                <SelectValue placeholder="Envase" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="botella">Botella (1L)</SelectItem>
                                <SelectItem value="bidon">Bidón (5L)</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="flex items-center space-x-2 pt-1">
                              <Checkbox
                                id={`envase-${item.perfume.id}`}
                                checked={!!item.devuelveEnvase}
                                onCheckedChange={(checked) =>
                                  setVentaPerfumes((prev) =>
                                    prev.map((p) =>
                                      p.perfume.id === item.perfume.id
                                        ? { ...p, devuelveEnvase: checked === true }
                                        : p
                                    ),
                                  )
                                }
                              />
                              <label
                                htmlFor={`envase-${item.perfume.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Devolvió envase
                              </label>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">No aplica</span>
                        )}
                      </TableCell>

                      {/* Cantidad */}
                      <TableCell className="w-[15%] align-top py-4 text-center">
                        <div className="flex justify-center w-full">
                          <NumberInput
                            min={0}
                            decimalScale={0}
                            thousandSeparator="."
                            decimalSeparator=","
                            value={item.cantidad}
                            className="h-9 text-center w-20"
                            onValueChange={(n) => {
                              const value = n ?? 0;
                              setVentaPerfumes((prev) =>
                                prev.map((p) =>
                                  p.perfume.id === item.perfume.id ? { ...p, cantidad: value } : p,
                                ),
                              );
                            }}
                          />
                        </div>
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="w-[15%] align-top py-4 text-right font-medium text-lg">
                        {formatCurrency(unitFinal * item.cantidad, "ARS", 0)}
                      </TableCell>

                      {/* Remove Button */}
                      <TableCell className="w-[5%] align-top py-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setVentaPerfumes(prev => prev.filter(p => p.perfume.id !== item.perfume.id));
                            setRowSelection(prev => {
                              const newState = { ...prev };
                              delete newState[item.perfume.id];
                              return newState;
                            });
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          <Table className="table-fixed">
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-bold text-lg text-right pr-4">
                  Total Final
                </TableCell>
                <TableCell className="w-[15%] text-right font-bold text-xl text-emerald-600">
                  {formatCurrency(
                    ventaPerfumes.reduce((acc, it) => {
                      const base = computePrecioUnitario(it.perfume, view === "mayorista", it.frascoLP, it.priceType);
                      const d = it.devuelveEnvase ? getEnvaseUnitCost(it.perfume, it.frascoLP) : 0;
                      return acc + Math.max(0, base - d) * it.cantidad;
                    }, 0),
                    "ARS",
                    0,
                  )}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          <div className="mt-4 flex justify-end gap-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      disabled={isLoadingForm || cliente.trim() === ""}
                      onClick={() => {
                        let total = 0;
                        const ventaConCliente = ventaPerfumes.map((item) => {
                          const base = computePrecioUnitario(item.perfume, view === "mayorista", item.frascoLP, item.priceType);
                          const d = item.devuelveEnvase ? getEnvaseUnitCost(item.perfume, item.frascoLP) : 0;
                          total += Math.max(0, base - d) * item.cantidad;
                          return { ...item, cliente: cliente.trim() };
                        });
                        handleSubmit(total, ventaConCliente);
                      }}
                    >
                      {isLoadingForm && <Loader2 width={18} className="animate-spin" />}
                      Agregar venta
                    </Button>
                  </span>
                </TooltipTrigger>
                {isLoadingForm ? (
                  <TooltipContent>Procesando la venta...</TooltipContent>
                ) : cliente.trim() === "" ? (
                  <TooltipContent>Ingresa el nombre del cliente para continuar</TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
            <Button variant="secondary" size="sm" onClick={handleCloseModal}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {userRole === "admin" && (
        <div className="flex items-center gap-x-4 mb-4">
          <div className="relative max-w-sm">
            <Input
              placeholder="Buscar por nombre..."
              value={filterValue}
              onChange={(event) => table.getColumn("nombre")?.setFilterValue(event.target.value)}
              className="pr-10"
            />
          </div>
          <Select
            onValueChange={(value) =>
              table.getColumn("genero")?.setFilterValue(value === "todos" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrar por género" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="femenino">Femenino</SelectItem>
              <SelectItem value="ambiente">Ambiente</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              table.getColumn("categoria")?.setFilterValue(value === "todos" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {insumosCategorias.filter(c => c.nombre.toLowerCase() !== 'otro').map((c) => (
                <SelectItem key={c.id} value={c.nombre}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={
              typeof table.getColumn("proveedor_id")?.getFilterValue() === "string"
                ? (table.getColumn("proveedor_id")?.getFilterValue() as string)
                : "todos"
            }
            onValueChange={(value) =>
              table.getColumn("proveedor_id")?.setFilterValue(value === "todos" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-x-4 mb-4">
        <Button
          size="sm"
          onClick={handleExportClick}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition-all font-medium gap-2"
        >
          <FileSpreadsheet size={16} />
          Exportar {view === "mayorista" ? "Mayorista" : "Minorista"}
        </Button>
        <Button
          size="sm"
          onClick={handleAgregarVenta}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition-all font-medium gap-2"
        >
          <ShoppingCart size={16} />
          {Object.keys(rowSelection).length > 0 ? `Ver Carrito (${Object.keys(rowSelection).length})` : "Ver Carrito"}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Cargando datos...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No hay resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} enableRowSelection />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el producto "{productToDelete?.nombre}".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Options Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opciones de Exportación ({view === "mayorista" ? "Mayorista" : "Minorista"})</DialogTitle>
            <DialogDescription>
              Personaliza qué datos y columnas deseas exportar al Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Columnas Selection */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2 text-sm text-foreground/80 border-b pb-1">
                <FileSpreadsheet className="h-4 w-4" /> Columnas a incluir
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "perfume", label: "Perfume" },
                  { key: "precio", label: view === "mayorista" ? "Precio Mayorista" : "Precio" },
                  { key: "genero", label: "Género" },
                  { key: "proveedor", label: "Proveedor" },
                  { key: "categoria", label: "Categoría" },
                ]
                  .filter(col => userRole === "admin" || col.key !== "proveedor") // Hide proveedor for revendedores
                  .map((col) => (
                    <div className="flex items-center space-x-2" key={col.key}>
                      <Checkbox
                        id={`ex-col-${col.key}`}
                        checked={exportColumns[col.key]}
                        onCheckedChange={(c) => setExportColumns(prev => ({ ...prev, [col.key]: !!c }))}
                      />
                      <label htmlFor={`ex-col-${col.key}`} className="text-sm cursor-pointer">{col.label}</label>
                    </div>
                  ))}
              </div>
            </div>


            {/* Proveedores Filter - Only for Admin */}
            {userRole === "admin" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-1">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-foreground/80">
                    Proveedores
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      // Toggle All
                      if (exportSelectedProviders.length === proveedores.length) {
                        setExportSelectedProviders([]);
                      } else {
                        setExportSelectedProviders(proveedores.map(p => p.id));
                      }
                    }}
                  >
                    {exportSelectedProviders.length === proveedores.length ? "Desmarcar todos" : "Marcar todos"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {proveedores.map((prov) => (
                    <div className="flex items-center space-x-2" key={prov.id}>
                      <Checkbox
                        id={`ex-prov-${prov.id}`}
                        checked={exportSelectedProviders.includes(prov.id)}
                        onCheckedChange={(checked) => {
                          setExportSelectedProviders(prev =>
                            checked
                              ? [...prev, prov.id]
                              : prev.filter(id => id !== prov.id)
                          );
                        }}
                      />
                      <label htmlFor={`ex-prov-${prov.id}`} className="text-sm cursor-pointer truncate" title={prov.nombre}>{prov.nombre}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categorías Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <h3 className="font-medium flex items-center gap-2 text-sm text-foreground/80">
                  Categorías
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    // Toggle All
                    if (exportSelectedCategories.length === insumosCategorias.length) {
                      setExportSelectedCategories([]);
                    } else {
                      setExportSelectedCategories(insumosCategorias.map(c => c.id));
                    }
                  }}
                >
                  {exportSelectedCategories.length === insumosCategorias.length ? "Desmarcar todos" : "Marcar todos"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {insumosCategorias.map((cat) => (
                  <div className="flex items-center space-x-2" key={cat.id}>
                    <Checkbox
                      id={`ex-cat-${cat.id}`}
                      checked={exportSelectedCategories.includes(cat.id)}
                      onCheckedChange={(checked) => {
                        setExportSelectedCategories(prev =>
                          checked
                            ? [...prev, cat.id]
                            : prev.filter(id => id !== cat.id)
                        );
                      }}
                    />
                    <label htmlFor={`ex-cat-${cat.id}`} className="text-sm cursor-pointer truncate">{cat.nombre}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Género Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <h3 className="font-medium flex items-center gap-2 text-sm text-foreground/80">
                  Género
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    // Toggle All
                    const all = ["masculino", "femenino", "ambiente", "otro"];
                    if (exportSelectedGenders.length === all.length) {
                      setExportSelectedGenders([]);
                    } else {
                      setExportSelectedGenders(all);
                    }
                  }}
                >
                  {exportSelectedGenders.length === 4 ? "Desmarcar todos" : "Marcar todos"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                {["Masculino", "Femenino", "Ambiente", "Otro"].map((label) => {
                  const val = label.toLowerCase();
                  return (
                    <div className="flex items-center space-x-2" key={val}>
                      <Checkbox
                        id={`ex-gen-${val}`}
                        checked={exportSelectedGenders.includes(val)}
                        onCheckedChange={(checked) => {
                          setExportSelectedGenders(prev =>
                            checked
                              ? [...prev, val]
                              : prev.filter(v => v !== val)
                          );
                        }}
                      />
                      <label htmlFor={`ex-gen-${val}`} className="text-sm cursor-pointer">{label}</label>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Download size={16} /> Descargar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Edita los detalles del producto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            {/* Costos Base */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precio_ars">Costo Base (ARS)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">ARS</span>
                  <Input
                    id="precio_ars"
                    type="number"
                    value={editPrecioArs}
                    onChange={(e) => setEditPrecioArs(e.target.value)}
                    className="pl-12"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio_usd">Costo Base (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">USD</span>
                  <Input
                    id="precio_usd"
                    type="number"
                    value={editPrecioUsd}
                    onChange={(e) => setEditPrecioUsd(e.target.value)}
                    className="pl-12"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Márgenes */}
            <div className="grid grid-cols-2 gap-4 border-t pt-6">
              <div className="col-span-2 flex items-center gap-2">
                <span className="font-semibold">Márgenes de Ganancia</span>
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">%</Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="margen_mayorista">Revendedor / Mayorista</Label>
                <Input
                  id="margen_mayorista"
                  type="number"
                  value={editMargenMayorista}
                  onChange={(e) => setEditMargenMayorista(e.target.value)}
                  placeholder="15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="margen_minorista">Venta Minorista</Label>
                <Input
                  id="margen_minorista"
                  type="number"
                  value={editMargenMinorista}
                  onChange={(e) => setEditMargenMinorista(e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>

            {/* Insumos */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Insumos Utilizados</div>
                {!isAddingInsumo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-primary hover:text-primary/80"
                    onClick={() => setIsAddingInsumo(true)}
                  >
                    + Agregar Insumo
                  </Button>
                )}
              </div>

              {isAddingInsumo && (
                <div className="flex flex-col gap-3 p-3 border rounded-lg bg-muted/30 mb-2 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Insumo</Label>
                    <Select value={selectedInsumoId} onValueChange={setSelectedInsumoId}>
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Seleccionar insumo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {insumos.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        value={newInsumoQty}
                        onChange={(e) => setNewInsumoQty(e.target.value)}
                        className="h-8"
                        type="number"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex-1 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsAddingInsumo(false)}>Cancelar</Button>
                      <Button size="sm" className="h-8" onClick={handleAddInsumo}>Agregar</Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border shadow-sm">
                {editInsumos.length > 0 ? (
                  <div className="divide-y">
                    {editInsumos.map((ins, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm">{ins.nombre}</span>
                          <div className="flex items-center text-xs text-muted-foreground gap-2">
                            <Badge variant="secondary" className="font-normal text-[10px] h-5 px-1.5">x{ins.cantidad_necesaria}</Badge>
                            <span>Lote: {ins.cantidad_lote}</span>
                            <span>•</span>
                            <span>${Math.round(unitCost(ins))}</span>
                          </div>
                        </div>
                        {ins.id !== "virtual-esencia" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const newIns = [...editInsumos];
                              newIns.splice(idx, 1);
                              setEditInsumos(newIns);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground bg-muted/10">
                    No hay insumos configurados para este producto.
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground pl-1">
                * El costo final se calcula sumando el costo base + costos de insumos.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
