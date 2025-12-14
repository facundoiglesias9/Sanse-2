
let cachedRates: any = null;
let lastFetch = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos en milisegundos

export async function GET() {
  if (cachedRates && Date.now() - lastFetch < CACHE_DURATION) {
    return Response.json(cachedRates);
  }

  try {
    const url = "https://dolarapi.com/v1/dolares/oficial";
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Failed to fetch from DolarApi");
    }

    const data = await res.json();
    const rates = { ARS: data.venta };

    cachedRates = rates;
    lastFetch = Date.now();

    return Response.json(cachedRates);
  } catch (error) {
    console.error("Error fetching dollar rate:", error);
    return new Response(JSON.stringify({ error: "API error" }), { status: 500 });
  }
}
