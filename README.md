# AI Engineering Developer Assessment

A single-attempt screening instrument for developers working with AI coding agents. A candidate
answers 21 moves — 20 scenario decisions scored server-side on a 1–4 proficiency scale across seven
sections, then Question 21, a 319-tool developer-tooling inventory with four follow-up fields. Any
move can also be explicitly skipped: a skip is a recorded decision that scores the one-point floor
of the scale and counts as skipped on the record, and never blocks filing — answering a skipped
move afterwards replaces the skip. Staff read the records, evidence, and scores from an admin side
that shares no surface with the candidate side, including a per-section radar graph and a
strongest-skill callout on each candidate record.

The visual world is "The Tournament Scoresheet": bond-paper ground, a white sheet inset, hairline
rules, federation navy for structure, ochre for the current move. Design tokens and rationale are
documented in `DESIGN.md`; product truth lives in `PRODUCT.md`.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, **TypeScript** strict
- **Tailwind CSS 4** (tokens in `app/globals.css`), self-hosted Archivo / Chivo Mono
- **Drizzle ORM** + **Neon PostgreSQL** (`serverless-friendly pg` pool; migrations in `drizzle/`)
- **Zod 4** for every boundary; **Vitest** (unit) + **Playwright** (e2e)

## Getting started

Requires Node 20+ and a PostgreSQL (Neon) database.

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run db:migrate           # apply migrations
npm run db:seed              # seed the admin user and catalog versions
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string. Server-only — never exposed to the client or logs. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Staff credentials, seeded into `admin_users` (hashed with argon2id) on first run. |
| `SESSION_SIGNING_KEY` | 32-byte hex key; sessions are stored only as keyed hashes. `openssl rand -hex 32`. |
| `ASSESSMENT_VERSION` | Bump when the question bank or rubric changes, so stored records stay interpretable. |
| `TOOL_CATALOG_VERSION` | Bump when the Question 21 catalog changes, so stored selections keep their revision. |

The app refuses to boot in production with placeholder values for `ADMIN_EMAIL` or
`SESSION_SIGNING_KEY`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` / `npm start` | Production build and serve. |
| `npm test` / `npm run test:watch` | Vitest unit + component tests. |
| `npm run test:e2e` | Playwright end-to-end (needs `.env.local` and the database; reuses a running dev server). |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` and ESLint. |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` | Drizzle schema → migration → apply / seed / browse. |
| `npm run db:clear-rate-limits` | Empties the rate-limit buckets. The e2e suite registers several candidates per run, and the per-connection session-start limit (5 / 10 min) is shared across runs — clear this when a re-run trips the limit. |

## Routes

Candidate (cookie-session): `/` → `/assessment?move=1…21` → `/assessment/confirm` →
`/assessment/submitted`. Staff: `/admin/login` → `/admin` (filter, sort, CSV export at
`/api/admin/export`) → `/admin/candidates/[id]`. The admin side is `noindex` and unreachable
without a session. The admin header carries a **Reset** button — it ends the candidate session
held by that browser and returns to the entry screen, touching no stored records, which is the
quick way to start a fresh candidate while testing.

## Scoring and the question bank

- **Proficiency scale.** Each of the 80 answer options in the bank carries one defined level —
  4 Outstanding, 3 Good, 2 Intermediate, 1 Developing — from the authored key in
  `lib/assessment/rubric.ts`. Option order is randomized per question in the source content, so the
  level cannot be guessed from the letter. The rubric is `server-only` and appears only on the
  admin record page.
- **Total and bands.** The total is the raw sum of the twenty chosen levels (20–80) and lands in
  one of four screening bands: Strong 68–80, Good 52–67, Intermediate 36–51, Developing 20–35.
  These are preliminary screening bands, not validated benchmarks, and are admin-only.
- **Sections.** The twenty questions measure seven sections; each is normalized to 0–100 from its
  own earned/available points so the two-question LSP section compares fairly against the
  three-question sections. The admin record page draws these as the section radar and names the
  strongest section(s) — the graph is inline SVG with no chart library and no client JavaScript.
- **Versioned bank.** Question text lives in the database keyed by `(question_key, version)`; every
  assessment pins the version it began on, and the admin editor publishes edits by copying the
  whole bank forward to a new version. A candidate always reads the wording they were shown, and
  the finished report is frozen into `result_detail` at submission. Reports filed under the
  retired weighted-competency model still render in full on the record page.

## Security model

- **Identity is the cookie, never the URL.** A candidate's session is a high-entropy token in an
  HttpOnly cookie; only a keyed hash of the token is stored, and no browser-supplied id is ever
  accepted as identity. Progress lives server-side (localStorage is only a draft cache, never the
  source of truth).
- **No public candidate surface.** There is no listing, no results endpoint, and no way for a
  candidate to see another candidate's data or any scoring rule: the rubric, section model and
  screening bands live in `server-only` modules and never appear in client bundles, API responses,
  HTML, or static files.
- **Rate limits** (fixed windows, hashed client subject): session start 5/10 min, admin login
  8/15 min, submit 10/5 min, answer autosave 240/10 min.
- **Migrations only.** All schema changes go through Drizzle migrations; nothing is altered by hand.

## Known limitations and deliberate choices

- **Cookie-only resume.** Per the product decision, the cookie is the sole proof of identity:
  knowing an email address never grants access to an assessment (no email enumeration, no
  recovery-by-email). The trade-off is that clearing browser storage abandons an in-progress
  attempt. If recovery is ever required, the upgrade path is a magic-link email delivering a
  signed, single-use resume token — deliberately not implemented here.
- **Neutral progress messages.** The begin flow answers identically whether a live session already
  exists or the rate limit tripped, so it cannot be used as an oracle.
- **Local QA values.** The committed `.env.local` on this machine carries
  `ADMIN_EMAIL=hiring@screening.example` and a QA password. Replace both, and regenerate
  `SESSION_SIGNING_KEY`, before any real deployment.
- The e2e specs create real records in the configured database (candidate emails are prefixed
  `qa.`) for testability; remove them if the database carries real candidates:
  `delete from candidates where normalized_email like 'qa.%@example.com';` cascades through
  assessments, answers, the tool inventory and sessions.
  Because session starts are rate-limited per connection (5 / 10 min) and that budget is shared
  across runs, back-to-back suite runs may need `npm run db:clear-rate-limits` first.
- `scripts/capture-review.ts` is a development tool for the design-review screenshot round; it is
  not part of the app runtime.
