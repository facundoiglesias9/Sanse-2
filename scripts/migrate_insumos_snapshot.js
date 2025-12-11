
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// DRY RUN: cambie a false para aplicar cambios reales
const DRY_RUN = false;

async function migrate() {
    console.log(`=== INICIANDO MIGRACIÓN (Dry Run: ${DRY_RUN}) ===`);

    try {
        // 1. Fetch Data
        const { data: insumos, error: errInsumos } = await supabase.from("insumos").select("*");
        if (errInsumos) throw errInsumos;

        const { data: esencias, error: errEsencias } = await supabase.from("esencias").select(`
            *,
            insumos_categorias:insumos_categorias_id(id, nombre)
        `);
        if (errEsencias) throw errEsencias;

        if (!insumos || !esencias) {
            console.error("Error fetching data (arrays null)");
            return;
        }

        // Find Special Insumos
        const frascoFemenino = insumos.find(i => i.nombre === "Frascos femeninos");
        const frascoMasculino = insumos.find(i => i.nombre === "Frascos masculinos");

        console.log(`Total insumos: ${insumos.length}`);
        console.log(`Total esencias a procesar: ${esencias.length}`);

        // 2. Process Each Esencia
        for (const esencia of esencias) {
            let newCustomInsumos = [];

            // A. Frascos Logic
            if (esencia.genero === "femenino" && frascoFemenino) {
                newCustomInsumos.push({
                    id: frascoFemenino.id,
                    nombre: frascoFemenino.nombre,
                    cantidad: 1,
                    cantidad_necesaria: frascoFemenino.cantidad_necesaria,
                    unidad: 'un',
                    type: 'insumo',
                    moneda: 'ARS'
                });
            } else if (esencia.genero === "masculino" && frascoMasculino) {
                newCustomInsumos.push({
                    id: frascoMasculino.id,
                    nombre: frascoMasculino.nombre,
                    cantidad: 1,
                    cantidad_necesaria: frascoMasculino.cantidad_necesaria,
                    unidad: 'un',
                    type: 'insumo',
                    moneda: 'ARS'
                });
            }

            // B. General Insumos Logic
            if (esencia.insumos_categorias) {
                const insumosGenerales = insumos.filter(ins =>
                    ins.is_general &&
                    ins.insumos_categorias_id === esencia.insumos_categorias.id
                );

                for (const insGen of insumosGenerales) {
                    newCustomInsumos.push({
                        id: insGen.id,
                        nombre: insGen.nombre,
                        // Store quantity used
                        cantidad: 1 * insGen.cantidad_necesaria,
                        unidad: 'un',
                        type: 'insumo'
                    });
                }
            }

            // 3. Compare and Log
            if (newCustomInsumos.length > 0) {
                console.log(`[${esencia.nombre}] (${esencia.genero}) - Categoría: ${esencia.insumos_categorias?.nombre}`);
                console.log(`   -> Snapshot Insumos: ${newCustomInsumos.map(i => `${i.nombre} (cant: ${i.cantidad})`).join(', ')}`);

                if (esencia.custom_insumos && esencia.custom_insumos.length > 0) {
                    console.log(`   !! YA TIENE custom_insumos: ${esencia.custom_insumos.length} items. Se Omitirá.`);
                } else {
                    if (!DRY_RUN) {
                        const { error } = await supabase
                            .from('esencias')
                            .update({ custom_insumos: newCustomInsumos })
                            .eq('id', esencia.id);

                        if (error) console.error(`Error actualizando ${esencia.nombre}:`, error);
                        else console.log("   -> ACTUALIZADO OK");
                    } else {
                        console.log("   -> DRY RUN: Pending Update");
                    }
                }
            }
        }
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
}

migrate();
