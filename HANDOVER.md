# Handover: Content-Publishing Setup for Megan

**Audience:** whichever Claude Code session is helping Megan Fletcher get set up in this repo and design her content-publishing workflow.

**Read `CLAUDE.md` first** — it covers the site's architecture, design system, and deploy rules. This document doesn't repeat that; it's specifically about Megan's onboarding and the content-publishing capability that still needs to be designed and built.

## Who you're talking to

Megan Fletcher is not a hired contractor — she's one of the two real estate agents this entire site is built for (CalRE# 02201698), and she's married to Charles, who's done the engineering work on this site so far. She'll be the one drafting and publishing real content about her own business: market updates, listing status changes, neighborhood notes. Write and design for a co-owner using her own tools, not for an external content contributor.

## Where things stand as of 2026-09-26

- Megan has **write access** to this repo (`jessandmegan-hub`) as a GitHub collaborator (`meganfletcherus-blip`).
- The repo is public, `main` has no branch protection, and `.github/workflows/deploy.yml` deploys to production on every push to `main`. **This is deliberate** — Charles explicitly confirmed he wants her commits to go straight to `main` and auto-deploy, with no PR review gate in between. Don't introduce one unless he asks for it.
- A project-level `.mcp.json` is already committed here, so Claude Code prompts to connect two MCP servers when opened in this project:
  - **`github`** — GitHub's official remote MCP server. Needs a `GITHUB_PAT` environment variable set locally: a **fine-grained** personal access token scoped to just this repo, with Contents: Read and write permission (created at github.com/settings/personal-access-tokens/new). Walk her through creating this if she hasn't already.
  - **`cloudflare`** — Cloudflare's official Workers Bindings MCP server, which includes `r2_put_object` for uploading photos straight into R2. She authenticates via **Charles's** Cloudflare login (his explicit choice) — which means this connection can reach his entire Cloudflare account, not just a photo bucket. Don't reach for it for anything beyond uploading site photos without checking with him first.

## The actual task: design and build her content-publishing skill(s)

There's no publishing workflow yet — `/blog/` is an intentional empty shell, not a bug. The plan (Charles's idea) is: instead of building a custom admin UI, Megan uses her own Claude Code — with the MCP access above — guided by one or more Claude Skills that walk her through drafting and publishing content. Think of it as a `/realpost`-style workflow.

**Use the `superpowers:brainstorming` skill for this.** It's a real design task with genuinely open questions, and Megan is the actual end user of whatever gets built — work through it with her directly rather than assuming answers. Things to resolve together:

- **What does she actually want to publish?** Blog posts / market updates? Flipping a listing's status on `/listings/` when it goes pending or sold? Editing a neighborhood page? Some combination, and does the skill need to handle all of them or just start with one?
- **What does the drafting flow feel like?** Does she type rough notes and the skill turns them into on-brand, structured copy — or does she bring finished copy and the skill just handles the technical publish (file creation, commit, push)?
- **Photo uploads need explicit bucket logic.** Each property/neighborhood currently uses its own separate R2 bucket (see the listing table in `docs/superpowers/specs/2026-09-26-jessandmegan-hub-remaining-pages-design.md`, one level up from this repo, if that folder is available to you). `r2_put_object` has no idea which bucket a given photo belongs to — the skill needs to ask or infer that explicitly, not guess.
- **Legal/compliance guardrails.** This is a licensed real estate business. Every page carries CalRE# numbers and Equal Housing Opportunity language in the footer, and market-related claims elsewhere on the site consistently carry a "deemed reliable but not guaranteed" disclaimer. Whatever publishing skill you build should never let a new page skip that footer, and should flag — not silently allow — anything reading like a specific, unhedged market or pricing claim.

## After the skill is designed

Follow the normal flow: brainstorm → write spec → `superpowers:writing-plans` → implement. Since this changes how content gets published going forward (and Megan, not Charles, may be the one running it day-to-day), it's worth having Charles review the spec before treating it as final, even though Megan is the one being onboarded.

## Known gaps that are NOT your job unless asked

- Formspree IDs on `/contact/` and `/buyers/` are still placeholders (`FORMSPREE_CONTACT_ID`, `FORMSPREE_BUYER_ID`) — neither form delivers submissions yet.
- Parcl Labs API key isn't configured yet — market-trend charts show a loading/error state, not real data.

Both are tracked, both are Charles's to resolve (they need his accounts/credentials), and neither blocks the content-publishing work above.
