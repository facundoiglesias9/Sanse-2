"use client";

import { useState, useEffect, useMemo } from "react";
import { Actividad } from "@/app/types/actividad";
import { createClient } from "@/utils/supabase/client";
import { DataTable } from "@/app/(app)/registro_de_actividad/components/data-table";
import { actividadColumns } from "@/app/(app)/registro_de_actividad/components/columns";
import { LoaderTable } from "@/app/(app)/components/loader-table";

type UsuarioOpt = { id: string; nombre: string; };

export default function ActividadPage() {
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState<string>("todas");
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>("todos");
  const [loadingTableActivityLogs, setLoadingTableActivityLogs] = useState(false);

  const supabase = createClient();

  async function fetchActividad() {
    setLoadingTableActivityLogs(true);

    type RawActividad = Omit<Actividad, "profiles"> & {
      profiles: { nombre: string | null; }[] | { nombre: string | null; } | null;
    };

    const { data, error } = await supabase
      .from("activity_logs")
      .select(`
        id,
        action,
        created_at,
        extra_data,
        user_id,
        profiles:profiles!activity_logs_user_id_fkey ( nombre )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando activity_logs:", error);
      setActividad([]);
      setLoadingTableActivityLogs(false);
      return;
    }

    const rows = (data ?? []) as RawActividad[];

    // Normalizamos profiles: si viene array, tomamos el primero; si no hay, null.
    const normalizadas: Actividad[] = rows.map((r) => ({
      ...r,
      profiles: Array.isArray(r.profiles)
        ? r.profiles[0] ?? null
        : (r.profiles as { nombre: string | null; } | null),
    }));

    setActividad(normalizadas);
    setLoadingTableActivityLogs(false);
  }

  useEffect(() => {
    fetchActividad();
  }, []);

  const usuariosOptions: UsuarioOpt[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of actividad) {
      const id = row.user_id ?? "";
      const nombre = row.profiles?.nombre || "Desconocido";
      if (id) map.set(id, nombre);
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [actividad]);

  function filtrarPorFecha(items: Actividad[], filtro: string): Actividad[] {
    const ahora = new Date();
    switch (filtro) {
      case "hoy": {
        return items.filter((v) => {
          const d = new Date(v.created_at);
          return (
            d.getFullYear() === ahora.getFullYear() &&
            d.getMonth() === ahora.getMonth() &&
            d.getDate() === ahora.getDate()
          );
        });
      }
      case "ayer": {
        const ayer = new Date(ahora);
        ayer.setDate(ahora.getDate() - 1);
        return items.filter((v) => {
          const d = new Date(v.created_at);
          return (
            d.getFullYear() === ayer.getFullYear() &&
            d.getMonth() === ayer.getMonth() &&
            d.getDate() === ayer.getDate()
          );
        });
      }
      case "semana": {
        const inicio = new Date(ahora);
        inicio.setDate(ahora.getDate() - ahora.getDay());
        inicio.setHours(0, 0, 0, 0);
        return items.filter((v) => {
          const d = new Date(v.created_at);
          return d >= inicio && d <= ahora;
        });
      }
      case "mes": {
        return items.filter((v) => {
          const d = new Date(v.created_at);
          return (
            d.getFullYear() === ahora.getFullYear() &&
            d.getMonth() === ahora.getMonth()
          );
        });
      }
      case "anio": {
        return items.filter((v) => {
          const d = new Date(v.created_at);
          return d.getFullYear() === ahora.getFullYear();
        });
      }
      case "todas":
      default:
        return items;
    }
  }

  function filtrarPorUsuario(items: Actividad[], userId: string): Actividad[] {
    if (userId === "todos") return items;
    return items.filter((row) => row.user_id === userId);
  }

  const actividadFiltrada = useMemo(() => {
    const porFecha = filtrarPorFecha(actividad, fechaFiltro);
    const porUsuario = filtrarPorUsuario(porFecha, usuarioFiltro);
    return porUsuario;
  }, [actividad, fechaFiltro, usuarioFiltro]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Registro de actividad</h1>

      {loadingTableActivityLogs ? (
        <LoaderTable />
      ) : (
        <div className="overflow-x-auto">
          <DataTable
            columns={actividadColumns}
            data={actividadFiltrada}
            isLoading={loadingTableActivityLogs}
            fechaFiltro={fechaFiltro}
            setFechaFiltro={setFechaFiltro}
            usuarioFiltro={usuarioFiltro}
            setUsuarioFiltro={setUsuarioFiltro}
            usuariosOptions={usuariosOptions}
          />
        </div>
      )}
    </div>
  );
}
