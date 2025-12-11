"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/app/helpers/formatDate";
import { Actividad } from "@/app/types/actividad";
import { Badge } from "@/components/ui/badge";

export const actividadColumns: ColumnDef<Actividad>[] = [
  {
    accessorKey: "created_at",
    header: "Fecha",
    cell: ({ row }) => {
      const fecha = row.getValue("created_at") as string;
      return (
        <p className="font-semibold whitespace-nowrap">
          {formatDate(new Date(fecha))}
        </p>
      );
    },
  },
  {
    accessorKey: "user_id",
    header: "Usuario",
    cell: ({ row }) => {
      const perfil = row.original.profiles as { nombre?: string; } | null;
      const shown = perfil?.nombre || (row.getValue("user_id") as string);
      return <p className="whitespace-normal break-words">{shown || "—"}</p>;
    },
  },
  {
    accessorKey: "action",
    header: "Actividad",
    cell: ({ row }) => {
      const action = row.getValue("action") as string;
      const extra = (row.original as any).extra_data as any | null;

      // solo usamos el nombre; NO mostramos la tabla porque ya está en `action`
      const etiquetaNombre = extra?.nombre as string | undefined;

      function renderCambios() {
        if (!extra) return null;

        // UPDATE: diferencias campo a campo
        if (extra.antes && extra.despues) {
          const cambios: React.ReactNode[] = [];
          for (const key in extra.antes) {
            if (extra.antes[key] !== extra.despues[key]) {
              cambios.push(
                <div
                  key={key}
                  className="text-xs leading-5 whitespace-normal break-words"
                >
                  <span className="font-semibold">{key}:</span>{" "}
                  <span className="line-through text-destructive">
                    {String(extra.antes[key])}
                  </span>{" "}
                  <span className="mx-1">→</span>
                  <span className="text-success">
                    {String(extra.despues[key])}
                  </span>
                </div>,
              );
            }
          }
          return (
            <div className="mt-1">
              {cambios.length > 0 ? (
                cambios
              ) : (
                <span className="italic text-neutral-400">
                  Sin cambios visibles
                </span>
              )}
            </div>
          );
        }

        // INSERT
        if (String(action).startsWith("INSERT")) {
          return (
            <div className="mt-1 text-xs text-neutral-300 whitespace-normal break-words">
              <span className="font-semibold">Datos creados:</span>
              <ul className="ml-3 list-disc">
                {Object.entries(extra).map(([key, value]) => (
                  <li key={key}>
                    <b>{key}:</b> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // DELETE
        if (String(action).startsWith("DELETE")) {
          return (
            <div className="mt-1 text-xs text-neutral-300 whitespace-normal break-words">
              <span className="font-semibold">Datos eliminados:</span>
              <ul className="ml-3 list-disc">
                {Object.entries(extra).map(([key, value]) => (
                  <li key={key}>
                    <b>{key}:</b> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // Fallback: JSON crudo (envuelto en líneas)
        return (
          <pre className="mt-1 text-xs bg-neutral-900 rounded p-2 whitespace-pre-wrap break-words text-neutral-200">
            {JSON.stringify(extra, null, 2)}
          </pre>
        );
      }

      return (
        <div className="whitespace-normal break-words">
          <p>{action}</p>

          {etiquetaNombre && (
            <div className="mt-1">
              <Badge
                variant="secondary"
                className="max-w-full whitespace-normal break-words"
              >
                {etiquetaNombre}
              </Badge>
            </div>
          )}

          {renderCambios()}
        </div>
      );
    },
  },
];
