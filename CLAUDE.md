# CLAUDE.md — Jess & Megan Hub

Context for any Claude session working in this repository.

## What this is

Permanent marketing/lead-gen website for Jessica Hooley and Megan Fletcher, South Bay real estate agents at Coldwell Banker Realty. Aggregates SEO and lead generation across all their listings — replaces the old pattern of a one-off microsite per property with no persistent web presence between listings.

**Agents:** Jessica Hooley (SRES, CalRE# 01435942) · Megan Fletcher (CSA, SRES, CalRE# 02201698) · Coldwell Banker Realty, 1712 Meridian Ave, San Jose, CA 95125.

## Tech stack — deliberately minimal

Static HTML + one shared stylesheet + one shared nav script. No framework, no build step, no bundler.

- `assets/style.css` — the ONLY place shared CSS should live (design tokens, nav, footer, hero, buttons, cards, forms, market-trends). Every page links it.
- `assets/main.js` — injects the real nav markup into `<nav id="nav" aria-label="Main navigation"></nav>`. Every page uses that empty tag plus `<script src="/assets/main.js" defer></script>` at the bottom — never hardcode nav links directly in a page.
- Page-level `<style>` blocks should contain ONLY that page's genuinely unique CSS (e.g. the buyers page's mortgage calculator, FAQ accordion). If you're about to write `.btn-gold`, `.section-title`, `.agent-cta`, `.nb-index-card`, etc. inside a page's own `<style>` block — stop, it already exists in `style.css`. Duplicating it there silently overrides the shared version on that one page and causes drift. This exact bug shipped once already (see git history around 2026-09-26, the visual-refresh work) — it's the single biggest thing to avoid regressing.
- One Vercel serverless function per data source: `api/neighborhood-trends.js` (Parcl Labs market-data chart), `api/mortgage-rates.js` (buyer mortgage calculator).

## Design system

- Colors: Navy `#002B5C`, Blue `#1E5AB8`, Gold `#C9A84C`, light background `#F0F5FB`, border `#D8E4F0`, body text `#2D4A6A` — all CSS custom properties in `style.css`'s `:root`.
- Type: headings in **Cormorant** (weight 300 — light and elegant; don't go bolder without a real reason), body in **Jost** (chosen as the closest free approximation to Avenir Next, which is a licensed font unavailable on the web). Both loaded via a Google Fonts `@import` at the top of `style.css`.
- Buttons are pills (`border-radius: 999px`), not rectangles.
- Photography over flat color. Hero sections and neighborhood/listing cards use real photos (hotlinked from Cloudflare R2 buckets), not solid-color blocks. Never fabricate or stock-photo a "real" listing or neighborhood photo. If a real one isn't available yet, say so plainly and use an honest interim rather than something that could be mistaken for the real thing.

## Deploy — GitHub Actions only, never manual

`.github/workflows/deploy.yml` runs `vercel deploy --prod` automatically on every push to `main`. This is the **only** deploy path.

- **Never** run `vercel deploy` or `vercel link` manually as a deploy step — standing project preference.
- `main` has no branch protection. Any push to it deploys to production immediately (this is intentional, not an oversight — see `HANDOVER.md` for why). Treat every push to `main` accordingly.
- Required repo secrets are already configured: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Site map (as of 2026-09-26)

- `/` — homepage
- `/about/`, `/buyers/`, `/services/`, `/contact/`, `/blog/` (intentional empty-state shell, no posts yet)
- `/neighborhoods/` + 6 detail pages (Almaden Valley, Willow Glen, Blossom Valley, Campbell, Los Gatos, Los Altos) — reference data in `neighborhoods.json`
- `/listings/` — links OUT to the four separate property-microsite repos/deployments (`3813-mountcliffe`, `2746-impruneta-court`, `141-orchard-oak`, `2812-thrasher-lane` — sibling directories to this repo, each its own git repo and Vercel deployment). The hub does not duplicate their content by design (avoids drift between two copies of the same listing). Active/sold status is tracked by hand in `/listings/index.html` — update it there when a property's status changes.

## Known open gaps — don't assume these are finished

- **Formspree IDs are placeholders.** Both `/contact/` and `/buyers/` forms post to `FORMSPREE_CONTACT_ID` / `FORMSPREE_BUYER_ID` — neither delivers submissions until real Formspree form IDs are filled in.
- **Parcl Labs market-trends charts show a loading/error state**, not real data — `PARCL_LABS_API_KEY` isn't set yet and `scripts/lookup-parcl-ids.js` hasn't been run with real `parcl_id`s.
- **No content-management workflow yet.** `/blog/` is an intentional empty shell. See `HANDOVER.md` for the plan in progress.

## Where the design history lives

Full specs and implementation plans for past work are tracked one level up, at `../docs/superpowers/specs/` and `../docs/superpowers/plans/` relative to this repo (i.e. `real_estate_portfolio_sites/docs/...`). That parent folder is **not** itself a git repo, so it won't be present in a fresh clone of just `jessandmegan-hub` — if you need that history and don't have access to it, ask Charles.

## Testing

No automated test suite exists. Verify changes by serving the site locally (e.g. `npx serve .`) and checking in a browser: no console errors, no 404s on `/assets/style.css` or image requests, and the nav renders as a styled navy bar — not a raw bulleted link list. That specific failure mode (unstyled bullet nav) has happened before and means the stylesheet link is broken.
