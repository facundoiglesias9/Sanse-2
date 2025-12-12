import * as cheerio from "cheerio";

const CATALOG_F = "https://vanrossum.com.ar/productos/00021";
const CATALOG_M = "https://vanrossum.com.ar/productos/00022";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SanseScraper/1.0" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const norm = (s: string) =>
  s.normalize("NFKD").replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim().toLowerCase();


async function load$(url: string) {
  const res = await fetch(url, {
    headers: {
      ...UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Upgrade-Insecure-Requests": "1",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} al cargar ${url}`);
  const html = await res.text();
  return cheerio.load(html);
}

function productLinks($: cheerio.CheerioAPI, base: string) {
  const links = new Set<string>();

  // A) lo normal
  $('a[href^="/producto/"]').each((_, a) => {
    const href = $(a).attr("href");
    if (href) links.add(new URL(href, base).toString());
  });

  // B) cualquier anchor que contenga /producto/
  if (links.size === 0) {
    $('a[href*="/producto/"]').each((_, a) => {
      const href = $(a).attr("href");
      if (href) links.add(new URL(href, base).toString());
    });
  }

  // C) texto “ver más” que apunte a /producto/
  if (links.size === 0) {
    $("a").each((_, a) => {
      const href = $(a).attr("href") || "";
      const txt = ($(a).text() || "").toLowerCase();
      if (/\/producto\/[A-Z0-9_-]+/i.test(href) || (txt.includes("ver más") && href.includes("/producto/"))) {
        links.add(new URL(href, base).toString());
      }
    });
  }

  return [...links];
}

// Paginación: rel="next", símbolo › o .pagination .next a
// Pagina siguiente (mejorada)
function nextPageUrl($: cheerio.CheerioAPI, base: string) {
  const cands = [
    $('a[rel="next"]').attr("href"),
    $("a").filter((_, a) => ($(a).text() || "").trim() === "›").attr("href"),
    $(".pagination .next a").attr("href"),
    // A veces la flecha es un icono
    $(".pagination li.active + li a").attr("href"),
  ];

  const found = cands.find(Boolean);
  return found ? new URL(found, base).toString() : null;
}

export type VRDetail = {
  productUrl: string;
  nombre: string;
  genero: "femenino" | "masculino" | "";
  externalCode: string | null;
  precioArs30: number | null;
  precioArs100: number | null;
  isConsultar: boolean;
};

export async function extractDetail(productUrl: string, catalogGender?: "femenino" | "masculino"): Promise<VRDetail> {
  const $ = await load$(productUrl);

  const title = $("h1,h2,h3").first().text().trim() || $("title").text().trim();

  // Try to extract gender from multiple sources
  let genero: VRDetail["genero"] = "";

  // Method 1: Use catalog gender if provided (most reliable - based on catalog URL)
  if (catalogGender) {
    genero = catalogGender;
  }

  // Method 2: Title-based detection as fallback
  if (!genero && /\(F\)\s*$/.test(title)) {
    genero = "femenino";
  } else if (!genero && /\(M\)\s*$/.test(title)) {
    genero = "masculino";
  }

  // Method 3: Breadcrumb as last resort
  if (!genero) {
    const breadcrumbText = $(".breadcrumb, nav ol, nav ul, .breadcrumbs, nav")
      .text()
      .toUpperCase()
      .replace(/\s+/g, " ");

    if (breadcrumbText.includes("FEMENINO")) {
      genero = "femenino";
    } else if (breadcrumbText.includes("MASCULINO")) {
      genero = "masculino";
    }
  }

  const codeLine = $("body").text().match(/Cod:\s*([A-Z0-9]+)/i);
  const externalCode = codeLine ? codeLine[1] : null;
  const nombreLimpio = title.replace(/\((F|M)\)\s*$/, "").trim();

  // ---------- PRECIOS (30g y 100g) ----------

  const parseARSnum = (s: string) => {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const findPrecioFor = (gramos: number) => {
    const gramosTxt = String(gramos);
    const afterLabelRegex = new RegExp(
      `botella\\s*de\\s*${gramosTxt}\\s*gram(?:os)?[^$]*\\$\\s*([\\d\\.\\,]+)`,
      "i"
    );

    const filas = $('tr, li, .row, article, section, div').filter((_, el) => {
      const t = ($(el).text() || "").toLowerCase().replace(/\s+/g, " ");
      return t.includes("botella") && t.includes(gramosTxt) && (t.includes("gramos") || t.includes("gram"));
    });

    let precio: number | null = null;
    filas.each((_, el) => {
      if (precio != null) return;
      const txt = $(el).text().replace(/\s+/g, " ");
      const m = txt.match(afterLabelRegex);
      if (m) {
        const n = parseARSnum(m[1]);
        if (n != null && n >= 1000) precio = n;
      }
    });

    if (precio == null) {
      const body = $("body").text().replace(/\s+/g, " ");
      const m = body.match(afterLabelRegex);
      if (m) {
        const n = parseARSnum(m[1]);
        if (n != null && n >= 1000) precio = n;
      }
    }

    return precio;
  };

  const p30 = findPrecioFor(30);
  const p100 = findPrecioFor(100);

  return {
    productUrl,
    nombre: nombreLimpio,
    genero,
    externalCode,
    precioArs30: p30,
    precioArs100: p100,
    isConsultar: p30 == null && p100 == null,
  };
}

// Recorre todas las páginas del catálogo: 20 por página, sigue “Siguiente”
export async function scrapeVanRossumCatalog(startUrl: string) {
  const out: VRDetail[] = [];
  let url: string | null = startUrl;
  let page = 1;

  // Determine gender from catalog URL
  const catalogGender: "femenino" | "masculino" | undefined =
    startUrl.includes("/00021") ? "femenino" :
      startUrl.includes("/00022") ? "masculino" :
        undefined;

  while (url) {
    console.log(`[Scraper] Page ${page}: ${url}`);
    const $ = await load$(url);
    const links = productLinks($, url);
    console.log(`[Scraper] Found ${links.length} products on page ${page}`);

    for (const href of links) {
      try {
        const d = await extractDetail(href, catalogGender);
        // Guardamos si tiene al menos alguno de los dos precios, o si es consultar (ambos null)
        out.push(d);
        await sleep(120);
      } catch (e: any) {
        console.error(`[Scraper] Error extracting ${href}: ${e.message}`);
      }
    }

    url = nextPageUrl($, url);
    if (url) await sleep(500); // un poco más de pausa entre páginas
    page++;
  }
  return out;
}

// Scrapea ambos catálogos (F y M), con paginación completa
export async function scrapeVanRossumBoth(): Promise<VRDetail[]> {
  const [f, m] = await Promise.all([
    scrapeVanRossumCatalog(CATALOG_F),
    scrapeVanRossumCatalog(CATALOG_M),
  ]);
  return [...f, ...m];
}

/** Utilidad de diagnóstico: solo primera página (para debug=1) */
export async function debugCatalogFirstPage(url: string) {
  const $ = await load$(url);
  const links = productLinks($, url);
  return { count: links.length, sample: links[0] ?? null };
}

export const VANROSSUM = { CATALOG_F, CATALOG_M };
