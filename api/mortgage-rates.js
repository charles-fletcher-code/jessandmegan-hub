const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

const FALLBACK = {
  rate30: 6.75,
  rate15: 6.10,
  rate5arm: 6.25,
};

async function fetchSeries(seriesId, apiKey) {
  const url = `${FRED_BASE}?series_id=${seriesId}&sort_order=desc&limit=1&api_key=${apiKey}&file_type=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FRED HTTP ${resp.status} for ${seriesId}`);
  const json = await resp.json();
  const value = json.observations?.[0]?.value;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) throw new Error(`FRED sentinel or missing for ${seriesId}`);
  return parsed;
}

export default async function handler(req, res) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(FALLBACK);
  }

  const [r30, r15, r5] = await Promise.allSettled([
    fetchSeries('MORTGAGE30US', apiKey),
    fetchSeries('MORTGAGE15US', apiKey),
    fetchSeries('MORTGAGE5US', apiKey),
  ]);

  const result = {
    rate30:  r30.status === 'fulfilled' ? r30.value  : FALLBACK.rate30,
    rate15:  r15.status === 'fulfilled' ? r15.value  : FALLBACK.rate15,
    rate5arm: r5.status === 'fulfilled' ? r5.value   : FALLBACK.rate5arm,
  };

  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
  return res.status(200).json(result);
}
