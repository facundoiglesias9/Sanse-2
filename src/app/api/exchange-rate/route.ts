
let cachedRates: any = null;
let lastFetch = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos en milisegundos

export async function GET() {
  if (cachedRates && Date.now() - lastFetch < CACHE_DURATION) {
    return Response.json(cachedRates);
  }

  const API_KEY = process.env.EXCHANGERATE_API_KEY;
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`;
  const res = await fetch(url);

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "API error" }), { status: 500 });
  }

  const data = await res.json();
  cachedRates = data.conversion_rates;
  lastFetch = Date.now();
  return Response.json(cachedRates);
}
