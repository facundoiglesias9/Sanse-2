import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SCRAPER_PROFILE_ID = process.env.SCRAPING_PROFILE_ID || null;

const supabase = createClient(url, serviceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orphanId = body?.orphan_id as string | undefined;

    if (!orphanId) {
      return NextResponse.json({ ok: false, error: "Falta orphan_id" }, { status: 400 });
    }

    // 1) Get Orphan
    const { data: orphan, error: eOrphan } = await supabase
      .from("precios_vanrossum_orphans")
      .select("*")
      .eq("id", orphanId)
      .maybeSingle();

    if (eOrphan) throw eOrphan;
    if (!orphan) return NextResponse.json({ ok: false, error: "Huérfano no encontrado" }, { status: 404 });

    // 2) Get Provider VR
    const { data: provs, error: eProv } = await supabase.from("proveedores").select("id, nombre");
    if (eProv) throw eProv;
    const vr = (provs ?? []).find((p) => (p.nombre || "").trim().toLowerCase() === "van rossum");
    if (!vr) return NextResponse.json({ ok: false, error: 'No existe el proveedor "Van Rossum"' }, { status: 400 });

    // 3) Create Essence
    const { data: newEssence, error: eCreate } = await supabase
      .from("esencias")
      .insert({
        nombre: orphan.nombre,
        genero: orphan.genero || null,
        proveedor_id: vr.id,
        // Initial values from orphan
        precio_ars: orphan.precio_ars_100g ?? null,
        precio_ars_100g: orphan.precio_ars_100g ?? null,
        cantidad_gramos: 100,
        is_consultar: orphan.precio_ars_100g === null,
        created_by: SCRAPER_PROFILE_ID,
        updated_by: SCRAPER_PROFILE_ID,
      })
      .select()
      .single();

    if (eCreate) throw eCreate;

    // 4) Create Alias (Self-reference for future matches)
    // Sometimes the orphan name might be slightly different from what we want as canonical, but here we just used it as name.
    // Let's add it as alias anyway to be safe for re-scraping logic.
    {
      const { error: aliasErr } = await supabase
        .from("esencias_alias")
        .insert({ esencia_id: newEssence.id, alias: orphan.nombre });

      if (aliasErr && !/duplicate/i.test(aliasErr.message)) {
        console.warn("Error creating alias (non-critical):", aliasErr.message);
      }
    }

    // 5) Insert Price History
    {
      const insertRow = {
        esencia_id: newEssence.id,
        genero: orphan.genero ?? null,
        external_code: orphan.external_code ?? null,
        url: orphan.url ?? null,
        precio_ars_100g: orphan.precio_ars_100g ?? null,
        fuente: "vanrossum",
        actualizado_en: new Date().toISOString(),
      };
      const { error: ePrecio } = await supabase.from("precios_vanrossum").insert(insertRow);
      if (ePrecio) throw ePrecio;
    }

    // 6) Resolve Orphan
    {
      const hasResolvedColumns = "resolved_at" in orphan || "resolved_by" in orphan;
      if (hasResolvedColumns) {
        const { error: eResolve } = await supabase
          .from("precios_vanrossum_orphans")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", orphanId);
        if (eResolve) throw eResolve;
      } else {
        const { error: eDelete } = await supabase.from("precios_vanrossum_orphans").delete().eq("id", orphanId);
        if (eDelete) throw eDelete;
      }
    }

    return NextResponse.json({
      ok: true,
      essence_created: true,
      essence_id: newEssence.id,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}