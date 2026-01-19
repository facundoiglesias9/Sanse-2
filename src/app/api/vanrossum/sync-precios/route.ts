// curl -sS -X POST http://localhost:3000/api/vanrossum/sync-precios
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scrapeVanRossumBoth,
  debugCatalogFirstPage,
  extractDetail,
  VANROSSUM,
  norm as baseNorm,
} from "@/lib/scrape.vanrossum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------
 * UTIL / HELPERS
 * ----------------------------------------------------------- */
const codeFromUrl = (u?: string | null) => {
  if (!u) return null;
  const m = u.match(/producto\/([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : null;
};



/* -------------------------------------------------------------
 * CANON / NORMALIZACIÓN
 * ----------------------------------------------------------- */
const NAME_CANON_REPLACERS: Array<[RegExp, string]> = [
  [/[`´’]/g, "'"],
  [/[/\\]/g, " "],
  [/\bINTHE\b/gi, "in the"],
  [/\bL[’']?EAU\b/gi, "l eau"],
  [/\bD[’']\b/gi, "d "],
  [/\bN[º°]\s*/gi, "no 5 "],
  [/\(\s*[fm]\s*\)/gi, ""],
  [/\bgodness\b/gi, "goddess"],
  [/\bspeel\b/gi, "spell"],
  [/\bd\/ete\b/gi, "d ete"],
  [/\bin\s*2u\b/gi, "in2u"],
  [/\bnoair\b/gi, "noir"],
  [/\s{2,}/g, " "],
];

function canonText(s: string): string {
  let t = s;
  for (const [re, rep] of NAME_CANON_REPLACERS) t = t.replace(re, rep);
  return t.trim();
}

const TITLE_CANON: Record<string, string> = {
  flowers: "flower",
  ultraviolet: "ultra violet",
};

const norm = (s: string) =>
  baseNorm(
    canonText(s)
      .replace(/\b(edp|edt|edc)\b/gi, "")
      .replace(/\btester\b/gi, "")
      .replace(/\s+\(\s*[fm]\s*\)\s*$/i, "")
  );

function applyTitleCanon(n: string): string {
  let out = n;
  for (const [k, v] of Object.entries(TITLE_CANON)) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, v);
  }
  return out;
}

/* -------------------------------------------------------------
 * SIMILITUD (DICE)
 * ----------------------------------------------------------- */
function diceSimilarity(a: string, b: string) {
  const bigrams = (t: string) => {
    const s = ` ${t} `;
    const arr: string[] = [];
    for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
    return arr;
  };
  const A = bigrams(a), B = bigrams(b);
  const map = new Map<string, number>();
  for (const g of A) map.set(g, (map.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of B) {
    const c = map.get(g) ?? 0;
    if (c > 0) { overlap++; map.set(g, c - 1); }
  }
  return (2 * overlap) / (A.length + B.length);
}

/* -------------------------------------------------------------
 * CANON DE MARCAS + INFERENCIAS
 * ----------------------------------------------------------- */
const BRAND_CANON: Record<string, string> = {
  channel: "chanel",
  lamcome: "lancome",
  "luis vuitton": "louis vuitton",
  "louis vuiton": "louis vuitton",
  miyaque: "issey miyake",
  miyake: "issey miyake",
  bulgary: "bulgari",
  bvlgari: "bulgari",
  "ralaph laurent": "ralph lauren",
  "ralph laurent": "ralph lauren",
  "paco rabbane": "paco rabanne",
  "paco rabane": "paco rabanne",
  "victoria secret": "victoria's secret",
  "victoria´s secret": "victoria's secret",
  "victoria s secret": "victoria's secret",
  "therry mugler": "thierry mugler",
  "thiery mugler": "thierry mugler",
  "giongio armani": "giorgio armani",
  "giogio armani": "giorgio armani",
  armany: "armani",
  cccharel: "cacharel",
  "d. karan": "donna karan",
  ch: "carolina herrera",
  "c. herrera": "carolina herrera",
  ck: "calvin klein",
  "c. dior": "christian dior",
  "r. laurent": "ralph lauren",
  "p. rabanne": "paco rabanne",
  "g. armani": "giorgio armani",
  "d.gabbana": "dolce gabbana",
  "d gabbana": "dolce gabbana",
  "y s l": "yves saint laurent",
  "y. saint laurent": "yves saint laurent",
};

function normalizeBrandName(s: string): string {
  const n = norm(s);
  for (const [k, v] of Object.entries(BRAND_CANON)) {
    const kk = norm(k);
    if (n === kk || n.endsWith(` ${kk}`) || n.startsWith(`${kk} `) || n.includes(` ${kk} `)) {
      return v;
    }
  }
  return n;
}

/** Marca por paréntesis final (ignorando el último (M)/(F)) o inferida por título. */
function extractBrand(raw: string): string | null {
  let s = raw.trim();
  s = s.replace(/\(\s*[FM]\s*\)\s*$/i, "").trim();

  const m = s.match(/\(([^)]*)\)\s*$/);
  if (m && m[1]) {
    const inside = normalizeBrandName(m[1]);
    if (/^[fm]$/i.test(inside)) return null;
    for (const kw of ["intense", "intenso", "intensa", "noir", "extreme", "elixir", "absolute", "absolu", "le parfum", "parfum", "eau de parfum", "nuit", "black", "rouge", "blue", "very", "vip", "sport", "light", "fresh", "aqua", "cool", "royal", "pure", "fusion", "legend", "rose", "red", "heroes", "dylan", "profondo", "intensement", "florale", "goddess", "blossom", "toy", "nova", "neon", "glam", "tease"]) {
      if (inside.includes(kw)) return null;
    }
    return inside;
  }
  const main = applyTitleCanon(norm(s.replace(/\s*\([^)]*\)?\s*$/, "")));
  const mainNoCK = main.replace(/^ck\s+/i, "").trim();
  const TITLE_TO_BRAND: Record<string, string> = {
    "alien goddess": "thierry mugler",
    "angel nova": "thierry mugler",
    "black opium neon": "yves saint laurent",
    "black xs": "paco rabanne",
    "coeur battant": "louis vuitton",
    gabrielle: "chanel",
    "nina rouge": "nina ricci",
    in2u: "calvin klein",
    si: "giorgio armani",
    "toy 2": "moschino",
  };
  if (TITLE_TO_BRAND[mainNoCK]) return TITLE_TO_BRAND[mainNoCK];
  for (const key of Object.keys(TITLE_TO_BRAND)) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(mainNoCK)) return TITLE_TO_BRAND[key];
  }
  const tail = s.match(/\b([A-Z][A-Z0-9\s&.'-]{2,})\s*$/);
  if (tail) {
    const chunk = tail[1].trim();
    if (/[A-Z]{3,}/.test(chunk.replace(/[^A-Z]/g, ""))) {
      const b = normalizeBrandName(chunk);
      for (const kw of ["intense", "intenso", "intensa", "noir", "extreme", "elixir", "absolute", "absolu", "le parfum", "parfum", "eau de parfum", "nuit", "black", "rouge", "blue", "very", "vip", "sport", "light", "fresh", "aqua", "cool", "royal", "pure", "fusion", "legend", "rose", "red", "heroes", "dylan", "profondo", "intensement", "florale", "goddess", "blossom", "toy", "nova", "neon", "glam", "tease"]) {
        if (b.includes(kw)) return null;
      }
      return b;
    }
  }
  return null;
}

function stripBrandFromMain(main: string, brand: string | null): string {
  if (!brand) return main;
  const b = normalizeBrandName(brand);
  if (b.length <= 2) return main;
  const re = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return main.replace(re, "").replace(/\s{2,}/g, " ").trim();
}

function extractMain(raw: string): string {
  let noBrand = raw.replace(/\s*\([^)]*\)?\s*$/, "");
  noBrand = noBrand.replace(/^CK\s+/i, "");
  const brand = extractBrand(raw);
  let main = norm(applyTitleCanon(noBrand));
  main = stripBrandFromMain(main, brand);
  return main;
}

function tokenizeBase(raw: string): string[] {
  return extractMain(raw)
    .replace(/[^a-z0-9\s']/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function stem(t: string): string {
  if (t.length >= 5 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function tokens(raw: string): string[] {
  return tokenizeBase(raw).map(stem);
}

const STOP = new Set([
  "for", "de", "of", "the", "and", "&", "le", "la", "el", "los", "las", "pour", "by",
  "homme", "femme", "men", "man", "women", "woman", "her", "him", "girl", "boy", "good",
  "eau", "toilette", "perfume", "edp", "edt", "edc", "no", "chanel", "channel"
]);

function strongTokens(raw: string): string[] {
  return tokens(raw).filter(t => t.length >= 3 && !STOP.has(t));
}

const VARIANT_KEYWORDS = new Set([
  "intense", "intenso", "intensa", "noir", "extreme", "elixir", "absolute", "absolu",
  "le parfum", "parfum", "eau de parfum", "nuit", "black", "rouge", "blue", "very", "vip",
  "sport", "light", "fresh", "aqua", "cool", "royal", "pure", "fusion", "legend",
  "rose", "red", "heroes", "dylan", "profondo", "intensement", "florale",
  "goddess", "blossom", "toy", "nova", "neon", "glam", "tease",
]);
const VARIANT_PHRASES = new Set(["le male"]);

function variantKeywordsIn(raw: string): string[] {
  const n = extractMain(raw);
  const found: string[] = [];
  for (const k of VARIANT_KEYWORDS) if (n.includes(k)) found.push(k);
  for (const p of VARIANT_PHRASES) if (n.includes(p)) found.push(p);
  return found;
}
function variantsCompatible(sourceName: string, candidateName: string): boolean {
  const src = new Set(variantKeywordsIn(sourceName));
  if (src.size === 0) return true;
  const cand = new Set(variantKeywordsIn(candidateName));
  for (const k of src) { if (!cand.has(k)) return false; }
  return true;
}

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter(x => b.has(x)));
  const uni = new Set([...a, ...b]);
  return inter.size / (uni.size || 1);
}

function strongTokenRule(sourceName: string, candidateName: string): boolean {
  const src = new Set(strongTokens(sourceName));
  const cand = new Set(strongTokens(candidateName));
  if (src.size === 0) return true;

  const interCount = [...src].filter(t => cand.has(t)).length;
  if (src.size >= 2 && interCount < 2) return false;

  const j = jaccard(src, cand);
  if (src.size <= 3 && j < 2 / Math.max(3, (src.size + cand.size - interCount))) return false;

  for (const must of ["king", "rouge", "intense", "noir", "elixir", "rose", "red", "heroes", "dylan", "profondo", "goddess", "nova", "neon", "glam", "tease"]) {
    if (src.has(must) && !cand.has(must)) return false;
  }
  return true;
}

function brandsClose(b1: string | null, b2: string | null): boolean {
  if (!b1 || !b2) return true;
  const n1 = normalizeBrandName(b1);
  const n2 = normalizeBrandName(b2);
  if (n1 === n2) return true;
  return diceSimilarity(n1, n2) >= 0.80;
}

/* -------------------------------------------------------------
 * RESCATE POR URL
 * ----------------------------------------------------------- */
const RESCUE_URLS: Record<string, string> = {
  ESEPUR0218: "https://vanrossum.com.ar/producto/ESEPUR0218",
  ESEPUR0551: "https://vanrossum.com.ar/producto/ESEPUR0551",
};

/* -------------------------------------------------------------
 * HANDLER
 * ----------------------------------------------------------- */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SCRAPER_PROFILE_ID = process.env.SCRAPING_PROFILE_ID || null;

  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falla de configuración de Supabase" }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey);

  const u = new URL(req.url);
  const isDebug = u.searchParams.get("debug") === "1";

  try {
    if (isDebug) {
      const fem = await debugCatalogFirstPage(VANROSSUM.CATALOG_F);
      const mas = await debugCatalogFirstPage(VANROSSUM.CATALOG_M);
      let sampleDetail: any = null;
      if (fem.sample) {
        try { sampleDetail = await extractDetail(fem.sample); }
        catch (e: any) { sampleDetail = { error: `No se pudo parsear sample: ${e.message}` }; }
      }
      return NextResponse.json({ ok: true, debug: { femenino: fem, masculino: mas, sampleDetail } });
    }

    // limpieza total (corrida completa)
    await supabase.from("precios_vanrossum").delete().gte("actualizado_en", "1900-01-01T00:00:00Z");
    await supabase.from("precios_vanrossum_orphans").delete().gte("actualizado_en", "1900-01-01T00:00:00Z");

    const t0 = Date.now();
    let scraped = await scrapeVanRossumBoth();

    // RESCATE POR URL
    let rescued = 0;
    const seenCodes = new Set(
      scraped.map((it: any) => (it.externalCode ?? codeFromUrl(it.productUrl) ?? "").toUpperCase())
    );
    for (const [code, urlStr] of Object.entries(RESCUE_URLS)) {
      if (!seenCodes.has(code)) {
        try {
          const det: any = await extractDetail(urlStr);
          if (det) {
            const detCode = (det.externalCode ?? codeFromUrl(det.productUrl) ?? "").toUpperCase();
            if (detCode === code) {
              scraped.push(det);
              seenCodes.add(code);
              rescued++;
            }
          }
        } catch { }
      }
    }



    // proveedor VR
    const { data: provs, error: eProv } = await supabase.from("proveedores").select("id, nombre");
    if (eProv) throw eProv;
    const vanRossum = (provs ?? []).find(p => (p.nombre || "").trim().toLowerCase() === "van rossum");
    if (!vanRossum) throw new Error('No se encontró el proveedor "Van Rossum"');
    const vanRossumId = vanRossum.id as string;

    // esencias + alias
    const [{ data: esencias, error: eEs }, { data: alias, error: eAl }] = await Promise.all([
      supabase.from("esencias").select("id, nombre, genero, proveedor_id"),
      supabase.from("esencias_alias").select("esencia_id, alias"),
    ]);
    if (eEs) throw eEs;
    if (eAl) throw eAl;

    // índices (solo VR)
    const byNameGender = new Map<string, { id: string; label: string; }>();
    const byAliasGender = new Map<string, { id: string; label: string; }>();
    const byMainTitleBrand = new Map<string, { id: string; label: string; genero: string; }[]>();
    const byNameNoGender = new Map<string, { id: string; label: string; genero: string; }>();
    const candidatesVR: Array<{ id: string; label: string; genero: string; }> = [];

    const addIndex = (id: string, label: string, genero: string) => {
      const key = `${norm(label)}|${(genero || "").toLowerCase()}`;
      byNameGender.set(key, { id, label });

      const keyNG = norm(label);
      if (!byNameNoGender.has(keyNG)) byNameNoGender.set(keyNG, { id, label, genero });
      else byNameNoGender.set(keyNG, { id: "", label: "", genero: "" });

      const main = extractMain(label);
      const brand = extractBrand(label);
      const mbKey = `${main}||${brand ?? ""}`;
      const arr = byMainTitleBrand.get(mbKey) ?? [];
      arr.push({ id, label, genero });
      byMainTitleBrand.set(mbKey, arr);
    };

    for (const e of esencias ?? []) {
      if (e.proveedor_id !== vanRossumId) continue;
      const genero = (e.genero || "").toLowerCase();
      addIndex(e.id, e.nombre, genero);
      candidatesVR.push({ id: e.id, label: e.nombre, genero });
    }

    for (const a of alias ?? []) {
      const ess = (esencias ?? []).find(e => e.id === a.esencia_id);
      if (!ess || ess.proveedor_id !== vanRossumId) continue;
      const genero = (ess.genero || "").toLowerCase();
      addIndex(ess.id, a.alias, genero);
      const key = `${norm(a.alias)}|${genero}`;
      byAliasGender.set(key, { id: ess.id, label: a.alias });
    }

    const now = new Date().toISOString();
    const inserts: any[] = [];
    const orphans: any[] = [];
    const updates: Array<{ id: string; precio: number | null; cantidadGramos: number | null; precio30: number | null; precio100: number | null; when: string; isConsultar: boolean; }> = [];
    let autoAccepted = 0;

    const FUZZY_THRESH = 0.70;


    const findBestVR = (nombre: string, genero: string): { id: string; score: number; } | null => {
      const sameGender = candidatesVR.filter(c => c.genero === genero);
      const pool = sameGender.length ? sameGender : candidatesVR;
      let best: { id: string; score: number; } | null = null;

      const bSrc = extractBrand(nombre);

      for (const c of pool) {
        if (!variantsCompatible(nombre, c.label)) continue;
        if (!strongTokenRule(nombre, c.label)) continue;

        if (!brandsClose(bSrc, extractBrand(c.label))) {
          if (bSrc) continue;
        }

        const mSrc = applyTitleCanon(extractMain(nombre));
        const mCand = applyTitleCanon(extractMain(c.label));
        let score = diceSimilarity(mSrc, mCand);

        if (brandsClose(bSrc, extractBrand(c.label)) && bSrc) {
          score = Math.min(1, score + 0.05);
        }

        const srcStrong = new Set(strongTokens(nombre));
        const candStrong = new Set(strongTokens(c.label));
        const missingInCand = [...srcStrong].filter(t => !candStrong.has(t));
        if (missingInCand.length > 0) {
          score = Math.min(score, 0.91);
        }

        if (!best || score > best.score) best = { id: c.id, score };
      }
      return best;
    };

    for (const it of scraped) {
      const genero = (it.genero || "").toLowerCase();
      const nameKey = `${norm(it.nombre)}|${genero}`;

      // 1) exacto nombre+género o por alias
      let hit = byNameGender.get(nameKey) ?? byAliasGender.get(nameKey);

      // 1.b) exacto sin género (si unívoco y compatible en género)
      if (!hit) {
        const ng = byNameNoGender.get(norm(it.nombre));
        if (ng && ng.id) {
          // Verify gender compatibility if both exist
          const g1 = (it.genero || "").toLowerCase();
          const g2 = (ng.genero || "").toLowerCase();
          const p1 = g1 === "masculino" || g1 === "femenino";
          const p2 = g2 === "masculino" || g2 === "femenino";

          if (p1 && p2 && g1 !== g2) {
            // Mismatch gender (e.g. Scraped=Male vs DB=Female) -> do NOT match
            hit = undefined;
          } else {
            hit = ng;
          }
        }
      }

      // 1.c) alternativa por título principal + marca (si unívoco)
      if (!hit) {
        const main = extractMain(it.nombre);
        const brand = extractBrand(it.nombre);
        const mbKey = `${main}||${brand ?? ""}`;
        const arr = byMainTitleBrand.get(mbKey);

        if (arr) {
          // Filter by gender compatibility
          const g1 = (it.genero || "").toLowerCase();
          const compatible = arr.filter(cand => {
            const g2 = (cand.genero || "").toLowerCase();
            const p1 = g1 === "masculino" || g1 === "femenino";
            const p2 = g2 === "masculino" || g2 === "femenino";
            if (p1 && p2 && g1 !== g2) return false;
            return true;
          });

          if (compatible.length === 1) {
            hit = compatible[0];
          }
        }
      }

      // 2) difuso (fuzzy)
      let best: { id: string; score: number; } | null = null;
      if (!hit) best = findBestVR(it.nombre, genero);

      // 3) acción
      if (hit) {
        inserts.push({
          esencia_id: hit.id,
          genero: it.genero,
          external_code: it.externalCode,
          url: it.productUrl,
          // precio_ars_100g legado: usamos el que exista, prefiriendo 100 si hay, sino 30 (o ambos)
          // En realidad, solo guardemos campos válidos
          precio_ars_100g: it.precioArs100 ?? null, // ¿uso de columna heredada? ¿o nueva?
          // Nuevas columnas:
          precio_30g: it.precioArs30 ?? null,
          precio_100g: it.precioArs100 ?? null,

          fuente: "vanrossum",
          actualizado_en: now,
        });
        updates.push({
          id: hit.id,
          precio30: it.precioArs30 ?? null,
          precio100: it.precioArs100 ?? null,
          // Para lógica heredada/por defecto: ¿usar 30g como primaria si está disponible? ¿O mantener lógica existente?
          // El usuario quiere alternancia dinámica. Solo actualicemos las columnas específicas.
          // Pero precio y cantidadGramos pueden ser usados por el sistema como "por defecto".
          // Establezcamos el precio por defecto a 30g si está disponible, si no 100g.
          precio: it.precioArs30 ?? it.precioArs100 ?? null,
          cantidadGramos: it.precioArs30 ? 30 : (it.precioArs100 ? 100 : null),

          when: now,
          isConsultar: it.isConsultar,
        });
        continue;
      }


      if (best) {
        if (best.score >= FUZZY_THRESH) {
          orphans.push({
            nombre: it.nombre,
            genero: it.genero,
            external_code: it.externalCode,
            url: it.productUrl,
            precio_ars_100g: it.precioArs100 ?? null, // legacy compat
            precio_30g: it.precioArs30 ?? null,
            precio_100g: it.precioArs100 ?? null,
            sugerido_esencia_id: best.id,
            sugerido_score: best.score,
            actualizado_en: now,
          });
        } else {
          orphans.push({
            nombre: it.nombre,
            genero: it.genero,
            external_code: it.externalCode,
            url: it.productUrl,
            precio_ars_100g: it.precioArs100 ?? null,
            precio_30g: it.precioArs30 ?? null,
            precio_100g: it.precioArs100 ?? null,
            sugerido_esencia_id: null,
            sugerido_score: null,
            actualizado_en: now,
          });
        }
      } else {
        orphans.push({
          nombre: it.nombre,
          genero: it.genero,
          external_code: it.externalCode,
          url: it.productUrl,
          precio_ars_100g: it.precioArs100 ?? null,
          precio_30g: it.precioArs30 ?? null,
          precio_100g: it.precioArs100 ?? null,
          sugerido_esencia_id: null,
          sugerido_score: null,
          actualizado_en: now,
        });
      }
    }

    // persistencia
    if (inserts.length) {
      const { error: e1 } = await supabase.from("precios_vanrossum").insert(inserts);
      if (e1) throw e1;
    }
    if (orphans.length) {
      const { error: e2 } = await supabase.from("precios_vanrossum_orphans").insert(orphans);
      if (e2) throw e2;
    }

    // actualizar precios en esencias (toca siempre la fila => trigger set_updated_at)
    if (updates.length) {
      for (const u of updates) {
        const values: Record<string, any> = {
          precio_ars: u.precio,
          cantidad_gramos: u.cantidadGramos,
          // Nuevas columnas en esencias
          precio_ars_30g: u.precio30,
          precio_ars_100g: u.precio100,

          is_consultar: u.isConsultar,
          ...(SCRAPER_PROFILE_ID ? { updated_by: SCRAPER_PROFILE_ID } : {}),
        };
        const { error: eUpd } = await supabase.from("esencias").update(values).eq("id", u.id);
        if (eUpd) throw eUpd;
      }
    }

    const dur_ms = Date.now() - t0;

    return NextResponse.json({
      ok: true,
      dur_ms,
      scraped_total: scraped.length,
      rescued,
      excluded: 0,
      scraped: scraped.length,
      inserted: inserts.length,
      orphans: orphans.length,
      autoAccepted,
      esencias_updated: updates.length,
      skipped: Math.max(0, scraped.length - inserts.length - orphans.length),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-precios error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Permitir que el Cron de Vercel (que hace GET) dispare la misma lógica
export async function GET(req: Request) {
  // reutilizamos exactamente el mismo handler
  return POST(req);
}