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
    const overrideEsenciaId = body?.esencia_id as string | undefined;

    if (!orphanId) {
      return NextResponse.json({ ok: false, error: "Falta orphan_id" }, { status: 400 });
    }

    // 1) Huérfano
    const { data: orphan, error: eOrphan } = await supabase
      .from("precios_vanrossum_orphans")
      .select("*")
      .eq("id", orphanId)
      .maybeSingle();
    if (eOrphan) throw eOrphan;
    if (!orphan) return NextResponse.json({ ok: false, error: "Huérfano no encontrado" }, { status: 404 });

    // 2) Esencia destino
    const targetEsenciaId = overrideEsenciaId || orphan.sugerido_esencia_id || null;
    if (!targetEsenciaId) {
      return NextResponse.json(
        { ok: false, error: "No hay esencia sugerida ni override proporcionado" },
        { status: 400 }
      );
    }

    // 3) Validaciones proveedor
    const [{ data: ess, error: eEss }, { data: provs, error: eProv }] = await Promise.all([
      supabase.from("esencias").select("id, proveedor_id, nombre, genero").eq("id", targetEsenciaId).maybeSingle(),
      supabase.from("proveedores").select("id, nombre"),
    ]);
    if (eEss) throw eEss;
    if (!ess) return NextResponse.json({ ok: false, error: "Esencia destino no existe" }, { status: 400 });
    if (eProv) throw eProv;

    const vr = (provs ?? []).find((p) => (p.nombre || "").trim().toLowerCase() === "van rossum");
    if (!vr) return NextResponse.json({ ok: false, error: 'No existe el proveedor "Van Rossum"' }, { status: 400 });
    if (ess.proveedor_id !== vr.id) {
      return NextResponse.json(
        { ok: false, error: "La esencia de destino no pertenece al proveedor Van Rossum (rechazado por seguridad)." },
        { status: 400 }
      );
    }

    // 4) Alias idempotente
    {
      const { error: aliasErr } = await supabase
        .from("esencias_alias")
        .insert({ esencia_id: ess.id, alias: orphan.nombre })
        .select()
        .single();
      if (aliasErr && !/duplicate/i.test(aliasErr.message)) throw aliasErr;
    }

    // 5) Insertar precio en precios_vanrossum (NULL => Consultar)
    {
      const insertRow = {
        esencia_id: ess.id,
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

    // 6) ✨ Actualizar ESENCIAS con precio actual
    {
      const precio = orphan.precio_ars_100g ?? null;
      const values: Record<string, any> = {
        precio_ars: precio,
        cantidad_gramos: 100,
        is_consultar: precio === null,
      };
      if (SCRAPER_PROFILE_ID) values.updated_by = SCRAPER_PROFILE_ID;

      const { error: eUpd } = await supabase.from("esencias").update(values).eq("id", ess.id);
      if (eUpd) throw eUpd;
    }

    // 7) Resolver huérfano
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
      alias_created: true,
      price_inserted: true,
      esencia_updated: true,
      orphan_resolved: true,
      esencia_id: ess.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}