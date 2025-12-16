"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, RefreshCw, Info, XCircle, Check, ChevronDown, PlusCircle, Layers } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EsenciaDialog } from "@/app/(app)/abm/esencias/components/esencia-dialog";

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

/** Filas skeleton para la tabla (se muestran mientras loading=true) */
function TableSkeleton({ rows = 8 }: { rows?: number; }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 items-center px-3 py-3 border-t text-sm">
          <div className="col-span-4 flex flex-col gap-2">
            <div className="h-4 w-3/5 bg-muted rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-muted rounded animate-pulse" />
          </div>
          <div className="col-span-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="col-span-2">
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          </div>
          <div className="col-span-1 flex justify-end">
            <div className="h-8 w-20 bg-muted rounded animate-pulse" />
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

  // Filtros
  const [onlyWithSuggestion, setOnlyWithSuggestion] = useState(false);
  const [genderFilter, setGenderFilter] = useState<"all" | "masculino" | "femenino" | "unisex">("all");

  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Diálogo de creación manual
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [orphanToCreate, setOrphanToCreate] = useState<Orphan | null>(null);

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
        const next = p + 8; // Incremento fijo en lugar de aleatorio
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
  }, []);

  const filtered = useMemo(
    () => orphans.filter((o) => {
      if (onlyWithSuggestion && !o.sugerido_esencia_id) return false;
      if (genderFilter !== "all") {
        const g = (o.genero || "").toLowerCase();
        // coincidencia simple
        if (g !== genderFilter) return false;
      }
      return true;
    }),
    [orphans, onlyWithSuggestion, genderFilter],
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

  const createFromOrphan = async (orphan: Orphan) => {
    // Consultar ID del proveedor Van Rossum
    const { data: provs } = await supabase.from("proveedores").select("id, nombre");
    const vanRossum = (provs ?? []).find((p) => (p.nombre || "").trim().toLowerCase() === "van rossum");

    // Consultar ID de categoría Perfumería Fina  
    const { data: cats } = await supabase.from("insumos_categorias").select("id, nombre");
    const perfumeriaFina = (cats ?? []).find((c) => (c.nombre || "").trim().toLowerCase() === "perfumería fina");

    setOrphanToCreate({
      ...orphan,
      vanRossumId: vanRossum?.id,
      perfumeriaFinaId: perfumeriaFina?.id,
    } as any);
    setCreateDialogOpen(true);
  };

  const handleCreateSuccess = async (newEsencia: any) => {
    if (!orphanToCreate) return;
    try {
      // Usar la lógica existente de acceptOrphan pero con el nuevo ID de esencia para vincularlos
      await acceptOrphan(orphanToCreate.id, newEsencia.id);
      setCreateDialogOpen(false);
      setOrphanToCreate(null);
      // Refrescar lista es manejado por acceptOrphan vía actualización de estado local normalmente,
      // pero acceptOrphan actualiza el estado de `orphans` directamente.
    } catch (_e) {
      toast.error("Error al vincular el huérfano con la nueva esencia");
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

  const clearSuggestion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // evitar click en fila
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
    <div className="p-4 max-w-7xl mx-auto pb-20">
      {/* Título */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Huérfanos del proveedor Van Rossum</h1>
      </div>

      {/* Controles superiores */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-card p-3 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="switch-only-suggestion"
              checked={onlyWithSuggestion}
              onCheckedChange={(v) => setOnlyWithSuggestion(Boolean(v))}
            />
            <label htmlFor="switch-only-suggestion" className="text-sm cursor-pointer select-none font-medium">
              Solo con sugerencia
            </label>
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Género:</span>
            <Select value={genderFilter} onValueChange={(v: any) => setGenderFilter(v)}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="femenino">Femenino</SelectItem>
                <SelectItem value="unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)} title="Ayuda">
            <Info className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Loader */}
      {progress > 0 && <LinearShimmer percent={Math.min(progress, 100)} />}

      {/* Tabla */}
      <div className="rounded-md border overflow-hidden bg-background">
        <div className="grid grid-cols-12 px-3 py-2 bg-muted/50 text-xs font-medium sticky top-0 z-10">
          <div className="col-span-4">Esencia</div>
          <div className="col-span-2">Precio 100g</div>
          <div className="col-span-3">Sugerencia</div>
          <div className="col-span-2">Actualizado</div>
          <div className="col-span-1 text-right">Acción</div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <div className="h-10 w-10 text-muted-foreground/30"><Info className="h-full w-full" /></div>
            No hay huérfanos que coincidan con los filtros.
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((o) => {
              const sug = o.sugerido_esencia_id ? suggestedMap.get(o.sugerido_esencia_id) : null;
              const precioTxt = o.precio_ars_100g === null ? "Consultar" : fmtARS(o.precio_ars_100g || 0);

              const generoBadge =
                o.genero === "masculino"
                  ? { text: "M", variant: "indigo" as const }
                  : o.genero === "femenino"
                    ? { text: "F", variant: "pink" as const }
                    : null;

              const isProcessing = acceptingId === o.id;


              return (
                <div
                  key={o.id}
                  className={`grid grid-cols-12 items-center px-3 py-3 text-sm transition-colors hover:bg-muted/30`}
                >
                  {/* Esencia */}
                  <div className="col-span-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{o.nombre}</span>
                      {generoBadge && (
                        <Badge variant={generoBadge.variant} className="px-1.5 text-[10px] h-5">
                          {generoBadge.text}
                        </Badge>
                      )}
                    </div>
                    {o.url && (
                      <Link href={o.url} target="_blank" className="text-xs text-muted-foreground hover:underline truncate max-w-[90%]">
                        Link producto
                      </Link>
                    )}
                  </div>

                  {/* Precio */}
                  <div className="col-span-2">
                    {o.precio_ars_100g === null ? (
                      <span className="text-destructive font-medium text-xs">Consultar</span>
                    ) : (
                      <span className="font-semibold">{precioTxt}</span>
                    )}
                  </div>

                  {/* Sugerencia */}
                  <div className="col-span-3 flex flex-col justify-center min-h-[2.5rem]">
                    {sug ? (
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1 w-full">
                          <span className="font-medium truncate text-primary/90" title={sug.nombre}>{sug.nombre}</span>
                          <button
                            onClick={(e) => clearSuggestion(o.id, e)}
                            title="Descartar sugerencia"
                            className="text-muted-foreground hover:text-destructive transition-colors ml-auto"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>

                        {o.sugerido_score !== null && (
                          <div className="flex items-center gap-2 text-xs">
                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${o.sugerido_score >= 0.9 ? "bg-emerald-500" : o.sugerido_score >= 0.7 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${o.sugerido_score * 100}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground">{Math.round(o.sugerido_score * 100)}%</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Sin sugerencia</span>
                    )}
                  </div>

                  {/* Fecha */}
                  <div className="col-span-2 text-xs text-muted-foreground">
                    {new Date(o.actualizado_en).toLocaleDateString("es-AR", {
                      day: "2-digit", month: "2-digit", year: "2-digit"
                    })}
                  </div>

                  {/* Acción */}
                  <div className="col-span-1">
                    <div className="flex justify-end gap-2">
                      {sug ? (
                        <Button
                          size="sm"
                          onClick={() => acceptOrphan(o.id)}
                          disabled={isProcessing}
                          className="h-8 px-3"
                        >
                          {acceptingId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => createFromOrphan(o)}
                          disabled={isProcessing}
                          title="Crear como nueva esencia"
                          className="h-8 px-3 gap-1"
                        >
                          <PlusCircle className="h-3.5 w-3.5" /> Crear
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => openChoose(o.id)}
                        title="Elegir manualmente..."
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EsenciaDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultValues={
          orphanToCreate
            ? {
              nombre: orphanToCreate.nombre,
              precio_ars: orphanToCreate.precio_ars_100g || 0,
              cantidad_gramos: 100, // Por defecto 100g
              genero:
                orphanToCreate.genero === "masculino" ||
                  orphanToCreate.genero === "femenino" ||
                  orphanToCreate.genero === "ambiente" ||
                  orphanToCreate.genero === "otro"
                  ? (orphanToCreate.genero as any)
                  : "otro",
              proveedor_id: (orphanToCreate as any).vanRossumId || "",
              insumos_categorias_id: (orphanToCreate as any).perfumeriaFinaId || "",
              is_consultar: !orphanToCreate.precio_ars_100g, // true si no hay precio
            }
            : {}
        }
        onSuccess={handleCreateSuccess}
        dolarARS={0}
        generoPorDefault="masculino"
      />

      {/* Modal de ayuda */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ayuda sobre Huérfanos</DialogTitle>
            <DialogDescription>
              Gestión de productos scrapeados que no se encontraron en tu base de datos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong>Sugerencia:</strong> El sistema intenta adivinar qué esencia es por el nombre.</li>
              <li><strong>Aceptar:</strong> Vincula el huérfano con la sugerencia detectada. Se crea un alias automáticamente.</li>
              <li><strong>Crear:</strong> Crea una <em>nueva esencia</em> en la base de datos con los datos del huérfano (Nombre, Precio, etc) y la asigna a Van Rossum.</li>
              <li><strong>Elegir manualmente:</strong> Si la sugerencia es incorrecta (o no hay), podés buscar manualmente la esencia correcta.</li>
            </ul>
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