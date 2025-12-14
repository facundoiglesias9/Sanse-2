export type CurrencyRates = Record<string, number>;

export async function getCurrencies(): Promise<CurrencyRates | null> {
  try {
    const storedCurrenciesRaw = localStorage.getItem("currencies_v2");
    const storedTimestampRaw = localStorage.getItem("currenciesTimestamp_v2");

    if (storedCurrenciesRaw && storedTimestampRaw) {
      const storedCurrencies = JSON.parse(storedCurrenciesRaw) as CurrencyRates;
      const storedTimestamp = Number(storedTimestampRaw);
      const currentTime = Date.now();
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutos en milisegundos

      if (!Number.isNaN(storedTimestamp) && currentTime - storedTimestamp < thirtyMinutes) {
        return storedCurrencies;
      }
    }

    const res = await fetch("/api/dolar");
    if (!res.ok) throw new Error("Error al obtener tasas");
    const conversionRates = (await res.json()) as CurrencyRates;

    const currentTime = Date.now();
    localStorage.setItem("currenciesTimestamp_v2", currentTime.toString());
    localStorage.setItem("currencies_v2", JSON.stringify(conversionRates));

    return conversionRates;
  } catch (error) {
    // Si hay error, simplemente reintentar o mostrar error amigable
    console.error("Error al obtener las monedas:", error);
    localStorage.removeItem("currencies_v2");
    localStorage.removeItem("currenciesTimestamp_v2");
    return null;
  }
}