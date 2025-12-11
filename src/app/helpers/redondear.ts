// Redondea hacia arriba al número más cercano que sea múltiplo de 100
export function redondearAlCienMasCercano(valor: number): number {
  return valor % 100 === 0 ? valor : Math.ceil(valor / 100) * 100;
}

// Redondea hacia arriba al número más cercano que sea múltiplo de 1000
export function redondearAlMilMasCercano(valor: number): number {
  return valor % 1000 === 0 ? valor : Math.ceil(valor / 1000) * 1000;
}