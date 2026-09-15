// /api/neighborhood-trends.js
// Vercel Serverless Function — Phase 2: Parcl Labs neighborhood price trend data
//
// GET /api/neighborhood-trends?neighborhood=almaden-valley
// Returns: { neighborhood, parcl_id, label, property_type, data: [{date, price_per_sqft, median_price}], updated_at }
//
// SETUP (one-time before deploying):
//   1. Sign up at https://app.parcllabs.com — free tier gives 100 credits/month
//   2. Copy your API key into Vercel env var: PARCL_LABS_API_KEY
//   3. Run: node scripts/lookup-parcl-ids.js
//   4. Paste the resulting parcl_ids into NEIGHBORHOOD_CONFIG below
//
// CACHING: Vercel CDN caches responses for 7 days (s-maxage=604800).
// Credit math: 12 credits × 6 neighborhoods = 72 credits per cold-cache week.
// Free tier (100 credits/month) supports roughly 1 refresh/month.
// Starter tier needed for weekly refresh. Ref: https://docs.parcllabs.com/docs/credits
//
// DATA SOURCE: Parcl Labs uses public records (county assessor/recorder) — no MLS/IDX.
// Display note: "Source: Parcl Labs public records data"

// ── Neighborhood → Parcl ID configuration ────────────────────────────────────
// Parcl IDs are permanent — look them up once with scripts/lookup-parcl-ids.js.
// "fallback_label" appears in the chart subtitle when the parcl_id is city-level
// (i.e., Almaden Valley uses San Jose data because no CDP-level pricefeed exists).
const NEIGHBORHOOD_CONFIG = {
  'almaden-valley': {
    parcl_id: null,         // Run lookup-parcl-ids.js to get this
    label: 'Almaden Valley',
    fallback_label: null,   // e.g. 'San Jose' if falling back to city level
  },
  'willow-glen': {
    parcl_id: null,
    label: 'Willow Glen',
    fallback_label: null,
  },
  'blossom-valley': {
    parcl_id: null,
    label: 'Blossom Valley',
    fallback_label: null,
  },
  'campbell': {
    parcl_id: null,
    label: 'Campbell',
    fallback_label: null,
  },
  'los-gatos': {
    parcl_id: null,
    label: 'Los Gatos',
    fallback_label: null,
  },
  'los-altos': {
    parcl_id: null,
    label: 'Los Altos',
    fallback_label: null,
  },
};

const PARCL_BASE = 'https://api.parcllabs.com';
const MONTHS_TO_FETCH = 13; // 13 months gives a clean trailing-12 chart with one month to anchor YoY

// Simple in-memory cache (survives within the same function instance / warm Lambda)
const memCache = new Map();

export default async function handler(req, res) {
  const { neighborhood, action } = req.query;

  // ── Discovery helper (admin only, not cached) ─────────────────────────────
  // Usage: GET /api/neighborhood-trends?action=lookup&q=Campbell&state=CA
  // Returns Parcl search results so you can find the right parcl_id.
  // Search calls are free (no credit cost).
  if (action === 'lookup') {
    return handleLookup(req, res);
  }

  // ── Normal data request ───────────────────────────────────────────────────
  if (!neighborhood) {
    return res.status(400).json({ error: 'Missing required param: neighborhood' });
  }

  const config = NEIGHBORHOOD_CONFIG[neighborhood];
  if (!config) {
    return res.status(404).json({ error: `Unknown neighborhood: ${neighborhood}` });
  }

  if (!config.parcl_id) {
    return res.status(503).json({
      error: 'parcl_id not configured for this neighborhood',
      setup: 'Run node scripts/lookup-parcl-ids.js and add the parcl_id to api/neighborhood-trends.js',
    });
  }

  const apiKey = process.env.PARCL_LABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PARCL_LABS_API_KEY env var not set' });
  }

  // Check in-memory cache (TTL: 6 hours)
  const cacheKey = `trends:${neighborhood}`;
  const cached = memCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 6 * 60 * 60 * 1000) {
    setCacheHeaders(res);
    return res.status(200).json(cached.data);
  }

  try {
    const data = await fetchTrends(config.parcl_id, apiKey);
    const payload = {
      neighborhood,
      parcl_id: config.parcl_id,
      label: config.label,
      fallback_label: config.fallback_label,
      property_type: 'SINGLE_FAMILY',
      data,
      updated_at: new Date().toISOString(),
      source: 'Parcl Labs public records data',
    };

    memCache.set(cacheKey, { data: payload, ts: Date.now() });
    setCacheHeaders(res);
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Parcl Labs fetch error:', err);
    return res.status(502).json({ error: 'Failed to fetch market data', detail: err.message });
  }
}

async function fetchTrends(parclId, apiKey) {
  // Endpoint: /v1/market_metrics/{parcl_id}/housing_event_prices
  // property_type=SINGLE_FAMILY, limit=13 (trailing 13 months), sorted newest first
  const url = new URL(`${PARCL_BASE}/v1/market_metrics/${parclId}/housing_event_prices`);
  url.searchParams.set('property_type', 'SINGLE_FAMILY');
  url.searchParams.set('limit', String(MONTHS_TO_FETCH));
  url.searchParams.set('offset', '0');
  // No start/end_date — the API returns the most recent N months by default

  const resp = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Parcl API ${resp.status}: ${body}`);
  }

  const json = await resp.json();

  // items are newest-first; reverse so chart shows oldest→newest left→right
  const items = (json.items || []).reverse();

  return items.map((item) => ({
    date: item.date,                                           // "YYYY-MM-01"
    price_per_sqft: item.price_per_square_foot?.median ?? null, // USD/sqft
    median_price: item.price?.median ?? null,                  // USD absolute
    // Optionally expose percentile band for a confidence ribbon
    price_per_sqft_p20: item.price_per_square_foot?.percentile_20th ?? null,
    price_per_sqft_p80: item.price_per_square_foot?.percentile_80th ?? null,
  }));
}

async function handleLookup(req, res) {
  const { q, state = 'CA', location_type = 'ALL' } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Missing param: q (search query)' });
  }

  const apiKey = process.env.PARCL_LABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PARCL_LABS_API_KEY not set' });
  }

  const url = new URL(`${PARCL_BASE}/v1/search/markets`);
  url.searchParams.set('query', q);
  url.searchParams.set('state_abbreviation', state);
  url.searchParams.set('location_type', location_type);
  url.searchParams.set('limit', '10');

  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json', Authorization: apiKey },
  });
  const json = await resp.json();

  return res.status(resp.status).json(json);
}

function setCacheHeaders(res) {
  // 7-day CDN cache, 1-day stale-while-revalidate
  // Vercel Edge will serve cached responses without hitting this function
  res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
}
