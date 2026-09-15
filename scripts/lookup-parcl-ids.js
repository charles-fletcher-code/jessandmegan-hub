#!/usr/bin/env node
// scripts/lookup-parcl-ids.js
// One-time CLI script to find Parcl IDs for all hub site neighborhoods.
//
// USAGE:
//   PARCL_LABS_API_KEY=your_key_here node scripts/lookup-parcl-ids.js
//
// OUTPUT:
//   Prints a config block you can paste directly into api/neighborhood-trends.js
//
// NOTE: Search calls are FREE (no credit cost). Run this as many times as needed.
//
// SIGN UP: https://app.parcllabs.com (free tier: 100 credits/month)

const BASE = 'https://api.parcllabs.com';

// Neighborhoods to look up.
// "queries" = search terms to try in order of preference (more specific first).
// "prefer_type" = prefer this location_type if found (CDP for San Jose neighborhoods,
//                 CITY for incorporated cities, TOWN for Los Gatos).
const NEIGHBORHOODS = [
  {
    slug: 'almaden-valley',
    label: 'Almaden Valley',
    queries: ['Almaden Valley', 'Almaden'],
    prefer_type: 'CDP',
    state: 'CA',
    note: 'If no CDP found, fall back to San Jose (CITY)',
  },
  {
    slug: 'willow-glen',
    label: 'Willow Glen',
    queries: ['Willow Glen'],
    prefer_type: 'CDP',
    state: 'CA',
    note: 'If no CDP found, fall back to San Jose (CITY)',
  },
  {
    slug: 'blossom-valley',
    label: 'Blossom Valley',
    queries: ['Blossom Valley'],
    prefer_type: 'CDP',
    state: 'CA',
    note: 'If no CDP found, fall back to San Jose (CITY)',
  },
  {
    slug: 'campbell',
    label: 'Campbell',
    queries: ['Campbell'],
    prefer_type: 'CITY',
    state: 'CA',
    note: 'Incorporated city in Santa Clara County',
  },
  {
    slug: 'los-gatos',
    label: 'Los Gatos',
    queries: ['Los Gatos'],
    prefer_type: 'TOWN',
    state: 'CA',
    note: 'Incorporated town in Santa Clara County',
  },
  {
    slug: 'los-altos',
    label: 'Los Altos',
    queries: ['Los Altos'],
    prefer_type: 'CITY',
    state: 'CA',
    note: 'Incorporated city in Santa Clara County',
  },
];

// San Jose fallback — use this parcl_id for any neighborhood whose CDP isn't found
const SAN_JOSE_FALLBACK_QUERY = { query: 'San Jose', state: 'CA', prefer_type: 'CITY' };

const API_KEY = process.env.PARCL_LABS_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set PARCL_LABS_API_KEY environment variable before running.\n');
  console.error('  PARCL_LABS_API_KEY=your_key_here node scripts/lookup-parcl-ids.js\n');
  process.exit(1);
}

async function searchMarkets(query, state, locationType = 'ALL') {
  const url = new URL(`${BASE}/v1/search/markets`);
  url.searchParams.set('query', query);
  if (state) url.searchParams.set('state_abbreviation', state);
  if (locationType !== 'ALL') url.searchParams.set('location_type', locationType);
  url.searchParams.set('limit', '5');

  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json', Authorization: API_KEY },
  });
  if (!resp.ok) {
    throw new Error(`Search failed: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  return json.items || [];
}

function pickBest(results, preferType) {
  // Prefer exact location_type match, then fall back to first result
  const exact = results.find((r) => r.location_type === preferType);
  return exact || results[0] || null;
}

async function main() {
  console.log('Looking up Parcl IDs for JessAndMegan.com neighborhoods...\n');

  const results = {};

  for (const hood of NEIGHBORHOODS) {
    let best = null;
    let usedQuery = null;

    for (const q of hood.queries) {
      const items = await searchMarkets(q, hood.state);
      const candidate = pickBest(items, hood.prefer_type);
      if (candidate) {
        best = candidate;
        usedQuery = q;
        break;
      }
    }

    if (!best) {
      console.warn(`  [!] ${hood.label}: no results found — will need manual lookup`);
      results[hood.slug] = { parcl_id: null, found: false, note: hood.note };
    } else {
      console.log(
        `  ✓ ${hood.label}: parcl_id=${best.parcl_id} | ${best.name} | ${best.location_type} | pricefeed=${best.pricefeed_market}`
      );
      if (best.pricefeed_market === 0) {
        console.log(`    ⚠ pricefeed_market=0 — housing_event_prices endpoint still works for sales data`);
      }
      results[hood.slug] = {
        parcl_id: best.parcl_id,
        found: true,
        name: best.name,
        location_type: best.location_type,
        pricefeed_market: best.pricefeed_market,
        query: usedQuery,
        note: hood.note,
      };
    }

    // Small delay to avoid rate-limiting (search is free but still rate-limited)
    await new Promise((r) => setTimeout(r, 200));
  }

  // Also look up San Jose as a fallback for CDP-based neighborhoods
  const sjResults = await searchMarkets('San Jose', 'CA', 'CITY');
  const sjBest = pickBest(sjResults, 'CITY');
  console.log(
    `\n  ℹ San Jose fallback: parcl_id=${sjBest?.parcl_id} (${sjBest?.name})`
  );

  // ── Print the paste-ready config block ──────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('PASTE THIS INTO api/neighborhood-trends.js → NEIGHBORHOOD_CONFIG:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const lines = NEIGHBORHOODS.map((hood) => {
    const r = results[hood.slug];
    const id = r?.parcl_id ?? 'null /* TODO: look up manually */';
    const cdpNote = ['almaden-valley', 'willow-glen', 'blossom-valley'].includes(hood.slug)
      ? `  //   CDP → ${r?.name || '?'} (${r?.location_type || '?'}). fallback_label: 'San Jose' if CDP missing`
      : '';
    const pfNote = r?.pricefeed_market === 0
      ? '  //   pricefeed_market=0 — uses housing_event_prices (monthly sales, no daily feed)'
      : '';

    return [
      `  '${hood.slug}': {`,
      `    parcl_id: ${id},${r?.found ? `   // ${r.name}` : ''}`,
      `    label: '${hood.label}',`,
      `    fallback_label: ${['almaden-valley', 'willow-glen', 'blossom-valley'].includes(hood.slug) && r?.location_type === 'CDP' ? "null" : `null   // set to 'San Jose' if using city-level fallback`},`,
      cdpNote,
      pfNote,
      `  },`,
    ].filter(Boolean).join('\n');
  }).join('\n');

  console.log(`const NEIGHBORHOOD_CONFIG = {\n${lines}\n};`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
