
const { createClient } = require('@supabase/supabase-js');

// Configuración directa para script rápido
const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkStructure() {
    console.log("Consultando tabla 'esencias'...");

    // Intentamos seleccionar todo de una fila para ver las columnas
    const { data, error } = await supabase
        .from('esencias')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error al consultar:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columnas encontradas en la primera fila:");
        console.log(Object.keys(data[0]));
        console.log("Valor de 'custom_insumos':", data[0].custom_insumos);
    } else {
        console.log("No se encontraron filas en 'esencias', probando insertar una dummy para ver estructura si es posible, o revisa si la tabla está vacía.");
    }
}

checkStructure();
