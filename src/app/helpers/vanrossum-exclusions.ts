// src/lib/vanrossum-exclusions.ts
export const VANROSSUM_EXCLUDED_CODES = new Set([
  "ESEPUR0497", // ML SIMIL BOTTLED MASCULINO
  "ESEPUR0498", // ML SIMIL BOTTLED NIGHT MASCULINO (HUGO BOSS)
  "ESEPUR0501", // ML SIMIL SAUVAGE MASCULINO
]);

const NAMES_NORMALIZED = new Set([
  "ml simil bottled masculino",
  "ml simil bottled night masculino (hugo boss)",
  "ml simil sauvage masculino",
  "bulgari (bulgari)",
]);

const norm = (s?: string | null) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

export function codeFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/producto\/([A-Z0-9]+)/i);
  return m?.[1]?.toUpperCase() ?? null;
}

export function isVanRossumExcluded(p: {
  external_code?: string | null;
  url?: string | null;
  nombre?: string | null;
  genero?: string | null;
}): boolean {
  const code = (p.external_code ?? codeFromUrl(p.url) ?? "").toUpperCase();
  if (code && VANROSSUM_EXCLUDED_CODES.has(code)) return true;

  // respaldo por nombre normalizado
  const name = norm(p.nombre);
  if (name && NAMES_NORMALIZED.has(name)) return true;

  return false;
}
