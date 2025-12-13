export function getLowStockMeta(it: { tipo: string; nombre: string; cantidad: number; }) {
    const tipo = (it.tipo || "").trim();
    const name = (it.nombre || "").trim().toLowerCase();

    if (tipo === "Perfume") return { low: false, threshold: null };
    if (tipo === "Frasco") return { low: it.cantidad <= 4, threshold: 4 };
    if (tipo === "Etiqueta") return { low: it.cantidad <= 4, threshold: 4 };
    if (tipo === "Esencia") return { low: it.cantidad <= 15, threshold: 15 };

    if (tipo === "Insumo") {
        if (name.includes("alcohol")) return { low: it.cantidad <= 500, threshold: 500 };
        if (name.includes("bolsas de madera")) return { low: it.cantidad <= 10, threshold: 10 };
    }

    return { low: false, threshold: null };
}
