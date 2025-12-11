"use client";

import React, { useMemo, useState } from "react";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";

type UsuarioOpt = { id: string; nombre: string; };

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  fechaFiltro: string;
  setFechaFiltro: React.Dispatch<React.SetStateAction<string>>;
  usuarioFiltro: string;
  setUsuarioFiltro: React.Dispatch<React.SetStateAction<string>>;
  usuariosOptions: UsuarioOpt[];
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  fechaFiltro,
  setFechaFiltro,
  usuarioFiltro,
  setUsuarioFiltro,
  usuariosOptions,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const [accionFiltro, setAccionFiltro] = useState<"todas" | "insert" | "update" | "delete">("todas");
  const [tablaFiltro, setTablaFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");

  const getAction = (row: any): string => String(row?.action ?? "");
  const getExtra = (row: any): any => row?.extra_data ?? null;

  const getTabla = (row: any): string => {
    const extra = getExtra(row);
    const fromExtra = (extra?.tabla ? String(extra.tabla) : "").toLowerCase();
    if (fromExtra) return fromExtra;

    const action = getAction(row).toLowerCase();
    // Formato esperado: "UPDATE en esencias"
    const parts = action.split(" en ");
    return parts.length > 1 ? parts[1].trim() : "";
  };

  const hasRealChanges = (row: any): boolean => {
    const extra = getExtra(row);
    if (!extra?.antes || !extra?.despues) return false;
    for (const k of Object.keys(extra.antes)) {
      if (extra.antes[k] !== extra.despues[k]) return true;
    }
    return false;
  };

  // Armamos opciones de "tabla" a partir de los datos actuales
  const tablaOptions: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const r of data as any[]) {
      const t = getTabla(r);
      if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [data]);

  // Filtrado local (se aplica sobre lo que ya llega filtrado por fecha/usuario desde el padre)
  const filteredData = useMemo(() => {
    const text = busqueda.trim().toLowerCase();

    return (data as any[]).filter((row) => {
      const action = getAction(row);
      const actionLower = action.toLowerCase();
      const tabla = getTabla(row);

      if (accionFiltro !== "todas" && !actionLower.startsWith(accionFiltro)) return false;
      if (tablaFiltro !== "todas" && tabla !== tablaFiltro.toLowerCase()) return false;

      // Búsqueda de texto (en action y extra_data)
      if (text) {
        const extra = getExtra(row);
        const hay =
          actionLower.includes(text) ||
          JSON.stringify(extra ?? {}).toLowerCase().includes(text);
        if (!hay) return false;
      }
      return true;
    }) as TData[];
  }, [data, accionFiltro, tablaFiltro, busqueda]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnFilters },
  });

  // Export helpers
  const shapeForExport = (row: any) => ({
    id: row.id ?? null,
    fecha: row.created_at ?? null,
    usuario: row?.profiles?.nombre ?? null,
    user_id: row.user_id ?? null,
    accion: row.action ?? null,
    tabla: getTabla(row) || null,
    datos: row.extra_data ?? null,
  });

  const handleCopyJSON = async () => {
    try {
      const payload = (filteredData as any[]).map(shapeForExport);
      const text = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(text);
      toast(`Copiado en formato JSON (${payload.length} registros)`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleDownloadJSON = () => {
    const payload = (filteredData as any[]).map(shapeForExport);
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `activity_logs-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por fecha (provisto por el padre) */}
          <Select value={fechaFiltro} onValueChange={(value) => setFechaFiltro(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los registros</SelectItem>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="ayer">Ayer</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="anio">Este año</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por usuario (provisto por el padre) */}
          <Select value={usuarioFiltro} onValueChange={(v) => setUsuarioFiltro(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los usuarios</SelectItem>
              {usuariosOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Acción */}
          <Select value={accionFiltro} onValueChange={(v: any) => setAccionFiltro(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las acciones</SelectItem>
              <SelectItem value="insert">INSERT</SelectItem>
              <SelectItem value="update">UPDATE</SelectItem>
              <SelectItem value="delete">DELETE</SelectItem>
            </SelectContent>
          </Select>

          {/* Tabla */}
          <Select value={tablaFiltro} onValueChange={(v) => setTablaFiltro(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tabla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las tablas</SelectItem>
              {tablaOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Búsqueda en texto */}
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en actividad o datos..."
            className="w-[260px]"
          />

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyJSON}>
              <Copy /> Copiar
            </Button>
            <Button size="icon" variant="secondary" onClick={handleDownloadJSON}>
              <Download />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top whitespace-normal break-words">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
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

      <DataTablePagination table={table} />
    </>
  );
}
