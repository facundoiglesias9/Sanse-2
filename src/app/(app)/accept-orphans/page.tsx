"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, RefreshCw, Info, XCircle, Check, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);

type Orphan = {
  id: string;
  nombre: string;
  genero: string | null;
  external_code: string | null;
  url: string | null;
  precio_ars_100g: number | null;
  sugerido_esencia_id: string | null;
  sugerido_score: number | null; // 0..1
  actualizado_en: string;
};

type EsenciaLite = { id: string; nombre: string; genero: string | null; };
type EsenciaLiteNorm = EsenciaLite & { norm: string; };

function normQuery(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    // @ts-ignore unicode property escape
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Barra de carga con “barberpole” animado + porcentaje */
function LinearShimmer({ percent }: { percent: number; }) {
  return (
    <div className="mb-4 w-full select-none">
      <div className="relative h-2 w-full overflow-hidden rounded bg-muted">
        <div
          className="absolute inset-0 -translate-x-1/2 w-[200%]"
          style={{
            background:
              "repeating-linear-gradient(45deg, hsl(var(--primary)) 0 10px, hsl(var(--primary)/.7) 10px 20px)",
            animation: "shimmer 1.2s linear infinite",
          }}
        />
      </div>
      <div className="text-right text-xs text-muted-foreground mt-1">{percent.toFixed(0)}%</div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0%);
          }
        }
      `}</style>
    </div>
  );
}

/** Bloque skeleton reutilizable */
function Skeleton({ className = "" }: { className?: string; }) {
  return (
    <div className={`relative overflow-hidden rounded bg-muted ${className}`}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.25) 50%, transparent 100%)",
          animation: "skfade 1.2s infinite linear",
        }}
      />
      <style jsx>{`
        @keyframes skfade {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

/** Filas skeleton para la tabla (se muestran mientras loading=true) */
function TableSkeleton({ rows = 8 }: { rows?: number; }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 items-center px-3 py-3 border-t text-sm">
          <div className="col-span-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="col-span-2">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
          </div>
          <div className="col-span-2">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="col-span-1 flex justify-end">
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrphansPage() {
  const supabase = createClient();

  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [suggestedMap, setSuggestedMap] = useState<Map<string, EsenciaLite>>(new Map());
  const [loading, setLoading] = useState(false);
  const [onlyWithSuggestion, setOnlyWithSuggestion] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const [showHelp, setShowHelp] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<number | null>(null);

  const [chooseOpen, setChooseOpen] = useState(false);
  const [chooseForId, setChooseForId] = useState<string | null>(null);
  const [vrOptions, setVrOptions] = useState<EsenciaLiteNorm[]>([]);
  const [vrSelected, setVrSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // tiempo mínimo visible del loader (ms)
  const MIN_LOADING_MS = 900;

  const startProgress = () => {
    setProgress(0);
    if (progressTimer.current !== null) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 12;
        return next < 90 ? next : 90;
      });
    }, 300);
  };
  const stopProgress = () => {
    if (progressTimer.current !== null) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  };

  const fetchData = async () => {
    const t0 = performance.now();
    try {
      setLoading(true);
      startProgress();

      const { data: rows, error } = await supabase
        .from("precios_vanrossum_orphans")
        .select(
          "id, nombre, genero, external_code, url, precio_ars_100g, sugerido_esencia_id, sugerido_score, actualizado_en",
        )
        .order("actualizado_en", { ascending: false });
      if (error) throw error;
      const list = (rows ?? []) as Orphan[];
      setOrphans(list);

      const ids = Array.from(new Set(list.map((o) => o.sugerido_esencia_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: ess, error: e2 } = await supabase.from("esencias").select("id, nombre, genero").in("id", ids);
        if (e2) throw e2;
        const mp = new Map<string, EsenciaLite>();
        for (const e of ess ?? []) mp.set(e.id, { id: e.id, nombre: e.nombre, genero: e.genero });
        setSuggestedMap(mp);
      } else {
        setSuggestedMap(new Map());
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar huérfanos");
    } finally {
      // asegura que el loader/skeleton se vea al menos MIN_LOADING_MS
      const elapsed = performance.now() - t0;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      window.setTimeout(() => {
        stopProgress();
        setLoading(false);
      }, remaining);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line

  const filtered = useMemo(
    () => orphans.filter((o) => (onlyWithSuggestion ? Boolean(o.sugerido_esencia_id) : true)),
    [orphans, onlyWithSuggestion],
  );

  const acceptOrphan = async (id: string, overrideEsenciaId?: string) => {
    try {
      setAcceptingId(id);
      const res = await fetch("/api/vanrossum/accept-orphan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          overrideEsenciaId ? { orphan_id: id, esencia_id: overrideEsenciaId } : { orphan_id: id },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || "No se pudo aceptar el huérfano");
      toast.success("Huérfano aceptado correctamente");
      setOrphans((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message || "Error al aceptar");
    } finally {
      setAcceptingId(null);
    }
  };

  const openChoose = async (orphanId: string) => {
    setChooseForId(orphanId);
    setVrSelected(null);
    setQuery("");
    setIsExpanded(false); // cerrado al abrir
    setChooseOpen(true);

    const { data: provs, error: eProv } = await supabase.from("proveedores").select("id, nombre");
    if (eProv) {
      toast.error("No se pudo cargar proveedor");
      return;
    }
    const vr = (provs ?? []).find((p) => (p.nombre || "").trim().toLowerCase() === "van rossum");
    if (!vr) {
      toast.error('Proveedor "Van Rossum" no encontrado');
      return;
    }
    const { data: ess, error: eEss } = await supabase
      .from("esencias")
      .select("id, nombre, genero")
      .eq("proveedor_id", vr.id)
      .order("nombre", { ascending: true });
    if (eEss) {
      toast.error("No se pudieron cargar esencias de Van Rossum");
      return;
    }
    const normed = (ess ?? []).map((e) => ({
      ...(e as EsenciaLite),
      norm: normQuery(`${(e as EsenciaLite).nombre} ${(e as EsenciaLite).genero ?? ""}`),
    }));
    setVrOptions(normed);
  };

  const clearSuggestion = async (id: string) => {
    try {
      const { error } = await supabase
        .from("precios_vanrossum_orphans")
        .update({ sugerido_esencia_id: null, sugerido_score: null })
        .eq("id", id);
      if (error) throw error;

      setOrphans((prev) =>
        prev.map((o) => (o.id === id ? { ...o, sugerido_esencia_id: null, sugerido_score: null } : o)),
      );
      toast.success("Sugerencia eliminada");
    } catch (e: any) {
      toast.error(e?.message || "Error al quitar la sugerencia");
    }
  };

  const visibleOptions = useMemo(() => {
    const q = normQuery(query);
    if (q) {
      const tokens = q.split(" ");
      return vrOptions.filter((o) => tokens.every((t) => o.norm.includes(t))).slice(0, 200);
    }
    return isExpanded ? vrOptions.slice(0, 200) : [];
  }, [query, vrOptions, isExpanded]);

  const selectedObj = useMemo(
    () => (vrSelected ? vrOptions.find((o) => o.id === vrSelected) ?? null : null),
    [vrSelected, vrOptions],
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Título */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Huérfanos del proveedor Van Rossum</h1>
      </div>

      {/* Controles superiores */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="switch-only-suggestion"
              checked={onlyWithSuggestion}
              onCheckedChange={(v) => setOnlyWithSuggestion(Boolean(v))}
            />
            <label htmlFor="switch-only-suggestion" className="text-sm cursor-pointer select-none">
              Solo con sugerencia
            </label>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)} title="¿Qué es Sugerencia y Score?">
            <Info className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Loader fachero (visible al menos 900ms) */}
      {progress > 0 && <LinearShimmer percent={Math.min(progress, 100)} />}

      {/* Tabla */}
      <div className="rounded-md border overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 bg-muted text-xs font-medium">
          <div className="col-span-4">Esencia</div>
          <div className="col-span-2">Precio 100g</div>
          <div className="col-span-3">Sugerencia</div>
          <div className="col-span-2">Actualizado</div>
          <div className="col-span-1 text-right">Acción</div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No hay huérfanos para mostrar.</div>
        ) : (
          filtered.map((o) => {
            const sug = o.sugerido_esencia_id ? suggestedMap.get(o.sugerido_esencia_id) : null;
            const precioTxt = o.precio_ars_100g === null ? "Consultar" : fmtARS(o.precio_ars_100g || 0);

            const generoBadge =
              o.genero === "masculino"
                ? { text: "M", variant: "indigo" as const }
                : o.genero === "femenino"
                  ? { text: "F", variant: "pink" as const }
                  : null;

            return (
              <div key={o.id} className="grid grid-cols-12 items-center px-3 py-3 border-t text-sm">
                {/* Esencia */}
                <div className="col-span-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{o.nombre}</span>
                    {generoBadge && (
                      <Badge variant={generoBadge.variant} className="px-1.5">
                        {generoBadge.text}
                      </Badge>
                    )}
                  </div>
                  {o.url && (
                    <Link href={o.url} target="_blank" className="text-xs text-muted-foreground hover:underline">
                      {o.url}
                    </Link>
                  )}
                </div>

                {/* Precio */}
                <div className="col-span-2">
                  {o.precio_ars_100g === null ? (
                    <span className="text-destructive font-medium">Consultar</span>
                  ) : (
                    <span className="font-semibold">{precioTxt}</span>
                  )}
                </div>

                {/* Sugerencia */}
                <div className="col-span-3 flex flex-col">
                  {sug ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sug.nombre}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Quitar sugerencia"
                          onClick={() => clearSuggestion(o.id)}
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                      {o.sugerido_score !== null && (
                        <Badge
                          variant={
                            o.sugerido_score >= 0.85 ? "success" : o.sugerido_score >= 0.7 ? "warning" : "destructive"
                          }
                          className="w-fit mt-1"
                        >
                          {`Score: ${(o.sugerido_score * 100).toFixed(0)}%`}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin sugerencia</span>
                  )}
                </div>

                {/* Fecha */}
                <div className="col-span-2">
                  {new Date(o.actualizado_en).toLocaleString("es-AR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

                {/* Acción */}
                <div className="col-span-1">
                  <div className="flex justify-end gap-2">
                    {sug ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openChoose(o.id)}>
                          Elegir…
                        </Button>
                        <Button size="sm" onClick={() => acceptOrphan(o.id)} disabled={acceptingId === o.id}>
                          {acceptingId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar"}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => openChoose(o.id)} disabled={acceptingId === o.id}>
                        {acceptingId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Elegir…"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de ayuda */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué significan “Sugerencia” y “Score”?</DialogTitle>
            <DialogDescription>
              Breve explicación de cómo matcheamos productos scrapeados con tu base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Sugerencia</p>
              <p className="text-muted-foreground">
                Cuando el nombre del esencia no coincide exacto (ni por alias), proponemos la esencia más parecida
                según el nombre y el género. Esa coincidencia candidata es la <strong>Sugerencia</strong>.
              </p>
            </div>

            <div>
              <p className="font-medium">Score</p>
              <p className="text-muted-foreground">
                Es el porcentaje (0–100%) que indica qué tan parecidos son los nombres. Se calcula con un algoritmo de
                similitud de texto (tipo Dice/bigramas). Un score alto sugiere que probablemente sea la misma esencia.
              </p>
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Consejo: aceptá primero las sugerencias con score alto (&gt;= 85%). Si no coincide, podés quitar la
              sugerencia o elegir otra.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Elegir esencia (Van Rossum) */}
      <Dialog
        open={chooseOpen}
        onOpenChange={(o) => {
          setChooseOpen(o);
          if (!o) {
            setVrSelected(null);
            setQuery("");
            setIsExpanded(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Elegir esencia (Van Rossum)</DialogTitle>
            <DialogDescription>Seleccioná la esencia correcta para aceptar este huérfano.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div
              className="rounded-md border bg-background"
              onClick={() => {
                if (!isExpanded) {
                  setIsExpanded(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (!isExpanded && (e.key === "Enter" || e.key === " ")) {
                  setIsExpanded(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }
              }}
            >
              <div className="relative">
                {selectedObj && !isExpanded && !query && (
                  <div className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <Check className="h-4 w-4" />
                      <span className="truncate">
                        <span className="font-medium">{selectedObj.nombre}</span>{" "}
                        <span className="text-muted-foreground">{selectedObj.genero ?? "Otro"}</span>
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </div>
                )}

                <Command shouldFilter={false} className="h-auto shadow-none border-0">
                  <CommandInput
                    ref={inputRef}
                    placeholder="Escribí para buscar…"
                    value={query}
                    onValueChange={(v) => {
                      setQuery(v);
                      if (v.trim().length > 0) setIsExpanded(true);
                    }}
                    onFocus={() => setIsExpanded(true)}
                    className={
                      selectedObj && !isExpanded && !query
                        ? "opacity-0 h-0 absolute -z-10 pointer-events-none"
                        : ""
                    }
                  />
                </Command>
              </div>

              {/* Lista con animación */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                  }`}
              >
                <div
                  className="overflow-hidden"
                  onMouseDown={(e) => {
                    e.preventDefault(); // no perder foco del input
                  }}
                  onMouseMove={() => {
                    if (document.activeElement !== inputRef.current) {
                      inputRef.current?.focus({ preventScroll: true });
                    }
                  }}
                >
                  <Command shouldFilter={false} className="h-auto shadow-none border-0">
                    <CommandList className="max-h-72 overflow-y-auto overscroll-contain pr-1">
                      <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                      <CommandGroup>
                        {visibleOptions.map((e) => {
                          const selected = vrSelected === e.id;
                          return (
                            <CommandItem
                              key={e.id}
                              value={`${e.nombre} ${e.genero ?? ""}`}
                              onMouseDown={(ev) => {
                                ev.preventDefault(); // preserva foco
                              }}
                              onSelect={() => {
                                setVrSelected(e.id);
                                setQuery("");
                                setIsExpanded(false); // colapsa
                                inputRef.current?.blur();
                              }}
                              className="flex items-start gap-2"
                            >
                              <Check className={`mt-1 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                              <div className={selected ? "bg-accent/60 rounded px-1 -mx-1 w-full" : "w-full"}>
                                <div className="font-medium">{e.nombre}</div>
                                <div className="text-xs text-muted-foreground">{e.genero ?? "N/A"}</div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setChooseOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!chooseForId || !vrSelected) {
                    toast.info("Elegí una esencia");
                    return;
                  }
                  await acceptOrphan(chooseForId, vrSelected);
                  setChooseOpen(false);
                }}
              >
                Aceptar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
