# TutorAssist: product plan (v2)

Status: **proposal**, written 2026-10-30, updated the same day with Oscar's decisions (§7). Nothing is started. The hub page `Projects/TutorAssist.md` tracks status.

Goal: turn the dormant 2025 prototype into a polished, sellable maths practice and tutoring product that works for (a) students on their own, (b) teachers with classes, (c) tutors with tutees, and (d) schools buying seats. IB first (MYP + DP), other curricula second. Backend self-hosted on m70q.

---

## 1. Where the project stands (verified 2026-10-30)

**Code.** ~44k lines of TypeScript (Next.js 16 / React 19 / Tailwind 4), ~3.7k lines of SQL across `schema.sql`, `rls.sql`, `functions.sql` and 24 migrations. 12 Jest suites: 356 tests pass, 14 fail (all in `attempts-api.test.ts`: server-side answer validation never marks attempts correct; a real regression, not a flaky test). `tsc` fails only because of stray macOS duplicate files (`src/app/page 2.tsx`, `.next/types/routes.d 2.ts`). Dependencies are ~10 months stale but nothing is on an unsupported major.

**What already works (per code, not re-tested live).** Workspaces with `platform_owner / tutor / student` roles; invite-token student onboarding; question bank with 8 answer types (`short_answer, long_answer, numeric, expression, multiple_choice, true_false, fill_blank, matching`), LaTeX via KaTeX, MathLive input, hints, worked solutions, difficulty 1–5; programs and grade levels seeded per workspace (IB MYP M6–M10, DP AA/AI SL/HL, AP, GCSE, A-Level, General); topics with `curriculum_code`; AI generation (GPT-4o-mini) for questions, variants, syllabi and assignments, with an OpenAI Batch path; pgvector similarity search; assignments (incl. repeatable); attempts, SM-2 spaced repetition, streaks, flags with tutor review; sessions with Google Calendar OAuth (event + Meet link creation, listing); PDF worksheets; source-material upload to Cloudflare R2 with text extraction; a Postgres-table job queue triggered by cron hitting `/api/jobs/process`; transactional email via SMTP (nodemailer) with Resend also present.

**Coupling to Supabase.** 85 source files import the Supabase client; RLS policies use `auth.uid()` 128 times; every user FK points at `auth.users`; the job worker and admin paths use the service-role key. Auth, DB access and authorization are all Supabase-shaped. This is the cost centre of the move.

**Hosting.** No deploy config in the repo. The Supabase project referenced in `supabase/.temp/project-ref` was paused (free-tier inactivity) and restored on 2026-10-30. Contents (counted 2026-10-30 with the service role, counts only): 1 workspace, 4 users, 3 student profiles, 23 topics, **296 questions** (all AI-generated, all `active`; 211 tagged IB/M9, 5 IB/AAHL, 80 untagged; 277 `short_answer`, 13 multiple choice, 4 with the undocumented type `exact`, 2 true/false), 12 assignments, 62 attempts, 52 spaced-repetition rows, 16 flags, 0 sessions, 0 materials, 0 embeddings. Small enough to migrate wholesale. A full JSON export of all 27 tables plus auth users was taken on 2026-10-30 through the service role and stored at `/srv/storage/backups/server/tutorassist-supabase-export-20261030T105147Z/` (0600). A full `pg_dump` (custom format, public + auth schemas: 54 tables, 34 functions, 84 RLS policies, plus a schema-only SQL file) was taken the same day from a `postgres:17` container on m70q into the same folder. Vercel status unknown.

**Secrets.** A pattern scan of the full git history found no OpenAI keys or Supabase JWTs committed. `.env.local` (never read, keys only listed) holds Supabase, OpenAI, R2, Google OAuth, SMTP and an app encryption secret; rotate all of them before the new deployment regardless, since the repo is public.

**Server (m70q).** i5-10400T 6c/12t, 15 GiB RAM (4 used), NVMe 158 GB free, HDD 5.9 TB free. Docker Compose stacks under `/opt/stacks`, Caddy on the host with public `media.`, `requests.`, `photos.` sites. Postgres already runs for Immich (separate instance; TutorAssist gets its own). Plenty of headroom. Constraints from the hub: security review before any new public site; no off-site backup exists; DNS and Caddy changes need explicit approval.

**Content on hand.** `~/Documents/Work/Tutoring/Resources` holds 16 files: IB AI SL/HL formula booklets and a workbook, AA SL notes, MYP M8/M9 decks and mocks, Year 6/7 worksheets. These are copyrighted textbooks and school materials: usable to seed Oscar's *private* workspace and to calibrate style, never to ship in a shared bank.

---

## 2. Product definition

### 2.1 Who it is for

| Persona | Buys | Core loop |
|---|---|---|
| **Solo student** (IB DP/MYP, GCSE, A-level, AP) | Free tier → Student Plus | Pick course and topics → adaptive practice → see weak areas → spaced review before exams |
| **Tutor** (Oscar first) | Tutor / Tutor Pro | Manage tutees → assign practice → run live sessions (whiteboard, shared question) → schedule and bill |
| **Teacher** | Via school licence (or Teacher plan) | Classes → assignments and quizzes → class analytics → export marks |
| **School** | Seats per year | Teachers + students in one organisation, SSO, admin reporting, DPA |
| **Parent** (later) | Included with student | Progress digest, session schedule |

### 2.2 Positioning

"Curriculum-exact practice plus live tutoring tools." Competitors are either question banks (Revision Village, RevisionDojo, Mathspace, Dr Frost) or tutoring ops tools (TutorCruncher, Cal.com + Zoom + Notion). Nobody does both with a self-serve price. The defensible parts are: syllabus-node tagging down to IB sub-points and command terms, honest difficulty calibration from real attempt data, and the tutor session room.

### 2.3 Languages (decision 2026-10-30: English only for now; the model must leave room for more)

- UI strings through `next-intl` with locale files; English is the source, Swedish the first translation.
- Question content is translatable, not duplicated: a `question_translations` table (`question_id, locale, prompt, hints, solution_steps, choices`) beside the language-neutral fields (LaTeX, figure spec, answers, marks, syllabus node). A question's canonical locale is stored; other locales are AI-translated into a review queue, and the UI shows the canonical text when a translation is missing.
- Grading must be locale-aware: Swedish uses a decimal comma and spaces as thousands separators, and the Swedish curriculum (Matematik 1–5, Gy25) uses different notation in places. Normalise input per locale before the CAS check.
- Curriculum trees are language-neutral with translated labels, so one syllabus node serves both languages.
- Do this in the data model from phase 2 (locale columns, translation table, locale-aware grading hooks); ship no second language until a user needs it. Swedish is the likely first addition, not a commitment.

### 2.4 Tenancy model (replaces "one workspace per tutor")

```
organization  (school, tutoring business, or "personal")
 └─ workspace (a class, a tutor's roster, or a solo student's own space)
     └─ membership (user × workspace × role)
roles: owner · admin · teacher · tutor · student · parent (later)
```

- A user can belong to many workspaces (today: first membership wins, which breaks "student of two tutors").
- Content ownership: **global library** (platform-curated, licensed) + **org library** (shared across an org) + **workspace** (private). Today everything is per workspace, so curricula and questions get duplicated.
- Billing attaches to the organization.

---

## 3. Target architecture on m70q

```
Caddy (host)  ──►  web (Next.js, :3100)  ──►  PostgREST (data API, RLS)  ──►  Postgres 17 + pgvector
                   worker (same image, tsx src/worker.ts) ──►  PostgREST / Postgres
                   Better Auth (in web) ──►  Postgres `identity` schema (never exposed by PostgREST)
                   realtime (ws: whiteboard/session rooms)            [phase 5]
                   storage: local volume (/srv/appdata/mathium/files) via adapter
                   outbound: OpenAI/Claude, Google Calendar, email provider, Stripe
```

**Implemented 2026-10-30 (branch `mathium-phase-1`).** One deliberate change from the first draft: the
application's 82 data-access files keep talking to **PostgREST** (one static binary) instead of being
rewritten onto Drizzle. The app mints a short-lived HS256 JWT per request from the Better Auth session
(`role` authenticated/anon/service_role, `sub` = user id), so the 84 existing row-level-security policies
keep working unchanged. Drizzle is used for the identity schema and new code; old routes migrate to it
incrementally. This cut the port from weeks of rewriting to days, with no behaviour change to verify.

Stack lives at `/opt/stacks/tutorassist/` (compose + `.env` 0600), state at `/srv/appdata/tutorassist/` (NVMe), file uploads mirrored to HDD by the backup job. Two environments: `staging` (tailnet only, `100.88.107.120:3100`) and `prod` (public via Caddy once the security review is done).

### 3.1 Decisions (recommendations)

| Concern | Recommendation | Why |
|---|---|---|
| Database | **Plain Postgres 17 + pgvector** in Docker, not self-hosted Supabase | Self-hosted Supabase is ~10 containers (PostgREST, GoTrue, Realtime, Storage, Studio, gateway, pooler…) with painful upgrades and a patched Postgres image; we use none of PostgREST/Realtime/Storage from the app server. Plain Postgres is one container and portable to any VPS. |
| Data access | **PostgREST v16** behind the existing query-builder calls (`@supabase/postgrest-js`), JWT minted from the session; **Drizzle** for identity tables and new code | Zero-rewrite port with RLS intact; PostgREST is a single stable binary. Plain SQL migrations in `db/migrations/` applied by `scripts/db-migrate.ts`. |
| Auth | **Better Auth**: email+password, Google and magic-link invites now; Microsoft Entra (built-in social provider) when a school asks; the SSO plugin (per-organisation OIDC/SAML) for school identity providers later | Official Supabase migration guide; sessions in our DB; organisations and invitations built in; Microsoft and SAML verified in its docs (2026-10-30). Alternative: Auth.js. Avoid Keycloak (too heavy). |
| Authorization | Postgres RLS unchanged (`auth.uid()` now reads PostgREST's `request.jwt.claims`), plus app-layer checks in routes | The policies were already written; keeping them cost nothing. |
| Background jobs | The existing Postgres job table, polled by a long-running **worker container** (`src/worker.ts`); Graphile Worker later if the queue needs priorities or cron | Smallest change that removes the "cron hits an API route" design. |
| File storage | Storage adapter with **local-disk** and **S3** backends; local on m70q | Removes the R2 dependency; the S3 backend remains for a future VPS. Serve via signed app URLs, never a public directory. |
| Realtime | Small **WebSocket service** (y-websocket or excalidraw-room) proxied by Caddy | Needed only for the session room; keep it separate so the web container stays stateless. |
| Email | Transactional provider (Resend or Postmark) with SMTP fallback | Deliverability from a residential IP is poor; don't send from m70q directly. |
| AI | **Anthropic first, OpenAI second**, behind one `lib/ai/` abstraction with a per-task model table (no "smart router" yet). Oscar is on **Max 5x**, which includes **$100/month** of Claude API credit (official docs, 2026-10-30; covers the API and Batches, expires at the end of each billing cycle with no rollover, claimed by linking a Console organisation under Settings → Billing). Start with Claude Opus 5.5 at low/medium effort for generation and verification, Claude Haiku 5.5 ($0.10/$0.50 per MTok) for translation, tagging and classification, and the Batch API (50 % off) for bulk runs. Measure quality and cost per task before adding tiers; the docs' own advice is that one capable model at lower effort usually beats a cascade. **Local models on m70q**: no GPU, so generation is impractical, but embeddings (e.g. `nomic-embed-text` or `bge-m3` via Ollama on CPU) are viable and would replace the OpenAI embedding dependency for pgvector. | Free credit covers the MVP's entire AI spend; per-org usage metering still needed later for pricing. |
| Monitoring | Uptime Kuma check + Beszel (exist), structured logs, Sentry-compatible error reporting (self-hosted GlitchTip or Sentry free tier) | A paid product needs alerting to the phone. |
| Backups | Nightly `pg_dump` + file sync to `/srv/storage/backups/tutorassist/`, and **off-site** (the Restic/B2 plan in `Home Server/Backups`) **before the first paying customer** | No off-site backup exists today. Selling seats without one is not acceptable. |

### 3.2 Production hosting caveat

m70q is fine for development, staging, Oscar's own tutoring and a beta with friendly users. For schools paying per seat, a residential server with one HDD, no UPS and no off-site backup is a real liability (uptime SLA, GDPR/nFADP data-processing obligations, incident response). The architecture above is a plain Compose stack, so prod can move to a small VPS (Hetzner, EU) with the same files when the first contract is near. Decide then; build portable now.

---

## 3.3 Design system (started 2026-10-30)

Direction: a maths workbook, not a SaaS dashboard. Warm paper canvas (`#f6f5f0`), deep ink text (`#17202f`), one teal for every action and active state (`#0f7a77`), amber "spark" for progress, streaks and highlights (`#f2a541`), green/red reserved for right/wrong. One typeface, Manrope, with weight contrast (800 display, 600 interface, 500 body) and tabular numerals wherever numbers line up. Radii 12–20 px, hairline warm borders instead of drop shadows, graph paper as the signature texture behind hero bands and the auth panel. Motion: one rise-in on page load, nothing on hover beyond colour; `prefers-reduced-motion` respected. Accessibility floor: visible focus rings, 44 px targets, skip link, labelled icon buttons, mobile bottom tab bar for students on phones.

Done (reviewed in the browser 2026-10-30): tokens, brand mark and icons, app shell, auth shell and pages, landing, both dashboards, the shared question player (`src/components/question-player/`) used by practice and assignments, practice modes with topic accuracy rings, pick-questions screen, student assignments (progress rings, due chips) and progress (12-week activity heat map), students list, a Flags page reduced to one filtered list with icon actions, `InfoTip` for short explanations, emoji replaced by line icons. Still on the old layouts (but on the new tokens): tutor assignment detail, question editor, generate studio, sessions, materials, settings forms.

### 3.4 Shared question library (built 2026-10-30)

Every question lives in a workspace bank. A tutor can **propose** a question for the shared library; a **platform owner** (the `platform_owner` role or an address in `PLATFORM_OWNER_EMAILS`) approves or rejects it with a note in `/tutor/library` → Review queue. Approval creates a **read-only global copy** (`library = 'global'`, `review_status = 'approved'`, `source_question_id` pointing at the original, topic/program/grade recorded as metadata) that every workspace can browse and **import** into its own bank; the import recreates the topic by name and is guarded against duplicates. Workspace banks and practice queries exclude global copies. Columns `license` and `attribution` exist on every question for the content-licensing rules in WS3. This is the mechanism WS3's curated bank will fill. **Decision 2026-10-30:** every question a tutor or teacher creates is submitted automatically (database default); there is no proposing step. The queue supports bulk approve/reject.

### 3.5 Figures and images (built 2026-10-30, first slice of WS2)

`questions.figure_json` holds a declarative spec (`src/lib/figures.ts`): visible x/y ranges and a list of elements (function of x, point, segment, line, circle, polygon, vector, text). It is rendered in the browser with JSXGraph, authored in the question editor with a live preview, returned optionally by the AI generator, and shown under the prompt in practice and assignments. Images use the existing storage key column through the storage adapter and `/api/files`. Multi-part questions with marks shipped the same day (`questions.parts_json`, `src/lib/parts.ts`): parts (a), (b), … with their own answer types and marks, one attempt per question with marks stored as partial credit, editor and generator support. Still to do from WS2: markscheme lines (M/A/R) and command terms per part, interactive "sketch the graph" answers, server-side SVG for PDF worksheets, CAS-backed grading.

## 4. Workstreams

### WS0: Stabilise (1–2 weeks) — done in the working tree 2026-10-30 except secret rotation and the commit

- [x] Fix the 14 failing validation tests (stale mocks used `correct_answer` instead of `correct_answer_json`); delete stray ` 2` files; `tsc` and `lint` clean (13 lint errors fixed: prefer-const, a `Math.random` in render, two declaration-order issues in the search selects, a set-state-in-effect in the tutor nav replaced by `useSyncExternalStore`; ops scripts excluded from lint).
- [x] Upgrade dependencies: in-range `npm update`, plus `next` 16.4.3, `katex` 0.18.10 and `sharp` 0.35.5 for audit CVEs. Remaining audit items are transitive and low.
- [x] GitHub Actions: typecheck, lint, test and build on every push and PR (`.github/workflows/ci.yml`). Docker image build comes with phase 1.
- Rotate every secret in `.env.local`; move to a `.env` template with no real values.
- As soon as the restored Supabase project is up: `pg_dump` the database (roles, schema, data) and export any R2 files; store under `/srv/storage/backups/tutorassist/supabase-export-<date>/`. This is the seed for the m70q database.
- [x] Product renamed to Mathium in UI strings, emails, prompts, README and `package.json`; fallback URLs point at `https://mathium.app`. The GitHub repository keeps its name until Oscar renames it.

### WS1: Port the backend to m70q — done 2026-10-30 except the public exposure

1. [x] Identity schema (`identity.users/sessions/accounts/verifications`) with Better Auth; users and bcrypt hashes migrated from `auth.users`; all 25 application foreign keys re-pointed (`db/migrations/0001_identity.sql`).
2. [x] Better Auth: email/password, password reset, email verification (off by default), Google sign-in when configured. Organisation plugin deferred to WS4.
3. [x] Data access through PostgREST with session-minted JWTs; `@supabase/*` packages removed; every auth call site (28 files) rewritten; RLS verified (anonymous sees nothing, a new workspace sees only its own rows).
4. [x] Worker container polling the jobs table.
5. [x] Storage adapter (local disk, served by `/api/files/<key>` with a workspace check; S3 still supported).
6. [x] Compose stack at `/opt/stacks/mathium/` (db, postgrest, web, worker), state in `/srv/appdata/mathium/`, bound to the tailnet at `100.88.107.120:3100`; dump restored into it.
7. [x] `deploy/backup.sh` (nightly pg_dump + file sync to `/srv/storage/backups/server/mathium/`, 14-day retention). **Cron entry still to be added by Oscar** (`15 3 * * * /opt/stacks/mathium/backup.sh`); restore drill done for the Supabase dump, repeat for the first nightly dump.
8. [ ] Security review, secret rotation, DNS record for `mathium.app`, Caddy site, rebuild with the public URL (`deploy/README.md` → Going public). Needs an explicit go.

Verified locally: typecheck, lint (0 errors), 370 tests, `next build`, and an HTTP walk through sign-up → onboarding → every tutor page and API (all 200), anonymous redirect to login, sign-in.

Exit criterion unchanged: Oscar tutors a real student on staging for two weeks without touching Supabase or Vercel. Then delete the Supabase and Vercel projects.

### WS2: Question engine v2 (4–6 weeks)

**Built 2026-10-30:** figures (JSXGraph spec) and images; multi-part questions with marks and partial credit; command terms per part (detected from the prompt) and markscheme lines shown after checking; server-side symbolic grading with the Compute Engine (equivalent forms, surds, equations, identities by sampling) with optional required form (factorised, expanded, exact); opt-in 3 s.f. rounding; author tolerance honoured. Still open below: paper styles, M/A marks awarded per line (needs working capture), interactive graph answers, server-side SVG for PDFs, difficulty_observed.

The current model is "one prompt, one answer". IB-style assessment needs more.

- **Multi-part questions**: `question` → `parts[]` (a, b, c…) each with its own answer type, marks and markscheme lines (M/A/R marks). Total marks per question; paper style (`paper1_no_calc`, `paper2_calc`, `paper3_hl`, `myp_criterion_a/b/c/d`).
- **Command terms** (IB: *find, show that, hence, determine, sketch, justify…*) as a field used by grading and generation.
- **Figures**:
  - *Spec-driven diagrams*: a JSON `figure` field rendered client-side with **JSXGraph** (LGPL/MIT dual licence, commercial use allowed) or **Mafs** (MIT) for function graphs, geometry, vectors, box plots; same spec rendered to SVG server-side for PDF worksheets.
  - *Images*: upload/paste PNG/SVG per question and per part, stored via the storage adapter with alt text.
  - *Interactive answers*: "sketch the graph", "mark the point", "shade the region" answered on a JSXGraph board and graded against tolerances.
  - Avoid GeoGebra (commercial licence required) and Desmos API (licence + key) in v1.
- **Grading**: replace ad-hoc string normalisation with a CAS-backed equivalence check (MathLive's **Compute Engine**, MIT, already in the dependency family) for `expression`/`equation`; numeric with significant-figure rules (IB: 3 s.f. unless exact); unit-aware answers; partial credit by markscheme line for multi-part.
- **Question metadata for grade-level accuracy**: `curriculum_version` (e.g. `IB-DP-2021`, `IB-DP-2027`), `syllabus_node` (e.g. `AA.SL.2.6`), `difficulty_target` (author) vs `difficulty_observed` (from attempts), `calculator`, `estimated_minutes`, `license`, `source`, `attribution`, `review_status`.
- **Generation pipeline**: syllabus node + exemplar style + constraints → draft → automatic checks (solve independently, numeric re-check, LaTeX lint, duplicate check via embeddings) → human review queue → publish. Every published question records who approved it.

### WS3: Curriculum library and content at scale (4–6 weeks, overlaps WS2)

**Built 2026-10-30:** platform tables `curricula` / `curriculum_nodes` (migration 0007) with IB DP Math AA and AI (first assessment 2021) seeded from `db/curricula/` as **draft** (structure from memory, to be checked against the guides); syllabus tagging on questions and topics; generation scoped to a topic's syllabus point; library filters and a coverage view (target 30 reviewed per point). Open: verify outlines, the 2027 guides, MYP and other frameworks, importers, credit sweep, calibration.

- **Credit sweep (decision 2026-10-30).** The $100 of monthly API credit expires unused, so a worker cron runs three days before the billing-cycle end: read month-to-date spend from `ai_usage_log` (the table and `lib/ai-usage.ts` exist), take `remaining = 100 − spend − 5` dollars of margin, and submit Batch API generation jobs (50 % off, results within 24 h) sized to that amount against the syllabus nodes with the fewest reviewed questions. Output lands in the review queue, never straight into the bank. Rough yield at Opus 5.5 batch prices: $0.02–0.04 per question, so $50–80 left over is 1,500–3,000 draft questions a month. Guard rails: a Console workspace spend limit at $100 so purchased credit is never touched, and a per-run cap in the job payload. Needs the billing-cycle day (unknown; Oscar).

- **Global curriculum trees**, versioned, maintained by the platform (not per workspace):
  - IB DP AA SL/HL and AI SL/HL, current guides (first assessment 2021, valid through Nov 2028 sessions) **and** the revised guides (first teaching Aug 2027, first assessment May 2029). Model both from day one; the overlap period is exactly when schools will buy.
  - IB MYP 1–5 (criteria A–D, levels 1–8 as the grading scale).
  - Skeletons for GCSE (Edexcel/AQA), A-level, AP Calculus AB/BC and Statistics, Swiss Matura (later), "General" by grade 6–12.
  - Syllabus structure, topic names and command terms are facts and can be encoded; never copy guide prose or past-paper questions.
- **Sources for a large bank, by licence class**:
  - *Ship in the global library (commercial use allowed, attribution kept per question)*: OpenStax (CC BY 4.0: Prealgebra → Calculus, Statistics), Illustrative Mathematics 6–12 from illustrativemathematics.org (CC BY 4.0; **not** the Open Up Resources K–5 edition, which is CC BY-NC), Siyavula (CC BY, verify per book), GSM8K (MIT), MATH / Hendrycks (MIT, competition level, for HL extension), OpenMathInstruct-2 (CC BY 4.0, synthetic, use as style seeds), MathOdyssey (CC BY 4.0).
  - *Excluded for a paid product*: Khan Academy (CC BY-NC-SA), CK-12 (CC BY-NC), Eureka/EngageNY (CC BY-NC-SA), Corbettmaths and Dr Frost (copyright), textbooks.
  - *IB past papers*: not available to us. The IB's licensing policy (ibo.org, 2026-10-30) explicitly excludes "use of IB material for a for-fee tutoring service", excludes the two most recent exam sessions, caps IB material at 25 % of any licensed work, usually charges a fee, and states the IB is under no obligation to grant a licence. Conclusion: don't apply. Write original IB-style questions, use specimen papers for style only, carry a "not endorsed by the IB" disclaimer, and never put "IB" in the product name or domain (trademark).
  - *Original generation*: the main volume driver. Target per syllabus sub-node and level: ≥ 30 reviewed questions across difficulty bands, plus 5 exam-style multi-part. For IB DP alone that is roughly 4 courses × ~60 sub-nodes × 35 ≈ 8,000 questions; batch generation at 4o-mini/Haiku prices is tens of dollars, review time is the real cost.
- **Importers**: CSV/JSON/Markdown with LaTeX, plus a PDF → structured-question extractor for Oscar's private materials (workspace-private, flagged `license: private`).
- **Difficulty calibration**: after enough attempts, a simple 1-parameter IRT fit per question; expose "observed difficulty" to teachers; drift alerts when author and observed disagree.
- **Quality loop**: student flags (exists) + teacher "report" + automatic retirement of questions with pathological stats.

### WS4: Roles, classes and solo mode (4–6 weeks)

**Built 2026-10-31 (solo students):** onboarding offers "practising on my own" next to the invite code. Each solo student gets their own workspace (`workspaces.kind = 'solo'`) filled from the approved shared library for their course and kept in step by `syncSoloLibrary` (new, edited and withdrawn questions, at most every 10 minutes). Courses without approved questions show as "Coming soon"; with no approved questions at all, solo sign-up says it opens soon. Under 16: a parent or guardian confirms by an emailed link before the student can start (`parental_consents`). Students change their own course in Settings. Open: study plan, exam countdown, mock papers.

- Organizations, multi-workspace membership, admin console (seats, teachers, classes, CSV roster import, Google Classroom roster import later).
- Teacher views: class list, assignment with per-student status, question-level heatmap, mark export (CSV, later Google Sheets).
- Solo student: self sign-up, pick course + exam session, auto-generated study plan (syllabus coverage × exam date), daily review queue, exam countdown, "mock paper" mode with timer and calculator rules.
- Student UX polish: mobile-first practice, keyboard-only maths entry on desktop, offline-tolerant attempt submission.
- Onboarding, empty states, help centre, marketing site with pricing.

### WS5: Live tutoring tools (3–4 weeks)

**Built 2026-10-30:** `/session/<id>` with Excalidraw 0.18.1 synced live through an in-process event bus and Server-Sent Events (no extra service; one web container), live cursors, board saved per session, tutor panel to show a bank question and keep notes, start/end recorded. Open: canvas snapshot to the student timeline, follow-up assignment from a session, math-specific tools, multi-replica bus.

- **Session room** at `/session/<id>`: shared canvas, a "push question to student" panel, a shared scratch MathLive line, timer, and a notes pane that saves to the session record.
- **Canvas decision (2026-10-30):** start with **Excalidraw** (MIT) embedded via `@excalidraw/excalidraw`, restyled with its theme and `UIOptions` and a custom toolbar so it reads as this product, with collaboration through a self-hosted `excalidraw-room` (MIT). Budget: one week. If the canvas becomes the signature feature, replace it with a **custom canvas** built on `perfect-freehand` (MIT, the stroke algorithm tldraw itself uses), a thin SVG/Canvas renderer, Yjs for multiplayer and maths-specific tools (grid paper, LaTeX stickers, function plot insert, pointer/laser). That is 3–4 weeks and no licence. Nothing needs reverse-engineering: the hard parts are open source. **tldraw rejected**: no public price, the free hobby licence is non-commercial and watermarked, so it becomes a trap the day the product sells.
- Video stays on Google Meet (link already created by the calendar integration); building WebRTC is not worth it.
- Session artefacts: canvas snapshot (SVG) and notes attached to the student's timeline; "questions missed in session" become a follow-up assignment in one click.
- Async tools: tutor comments on attempts (table exists, no UI), audio/voice-note feedback later.

### WS6: Scheduling (3–4 weeks)

**Built 2026-10-30:** availability rules (weekly windows in the tutor's zone, length, breaks, notice, horizon, cancel window), Google free/busy merged in when connected, student self-booking and cancellation, Google event + Meet and emails on booking, double-booking guard, private ICS feed per user. Open: public booking page for new students, rescheduling, reminders, two-way sync, packages and payments.

- Tutor availability rules (weekly windows, buffers, min notice, timezone), Google free/busy merge, public booking page per tutor, student self-booking and rescheduling within policy, reminders (email, later push).
- Two-way Google Calendar sync (webhooks + periodic reconcile) instead of today's create-only; ICS feed per user; Outlook later.
- Packages and no-show policy; invoices for sessions via Stripe (WS7).
- Cal.com was evaluated: its core LICENSE file is MIT today and it self-hosts, but it is a ~900 MB-RAM app with its own user model, so embedding it means a second identity system. Build native; keep Cal.com as the fallback if the native booking page isn't enough.

### WS7: Monetisation and compliance (3–4 weeks, parallel with WS4+)

**Built 2026-10-31 (student plans):** Free (20 new practice questions a day, every topic of the course, hints and marking, progress; no worked solutions, spaced review, weak-area or pick-your-own modes; a sponsor message) and Plus (CHF 9/month or 69/year: everything, no sponsor messages), defined in `lib/plans.ts` and enforced on the server (`/api/questions`, `/api/attempts`). Students with a tutor are never limited. Stripe Checkout, Customer Portal and a signed webhook write `entitlements`; billing stays off until the four `STRIPE_*` variables are set, and a platform owner can give Plus by hand at /tutor/admin/plans. Deleting an account cancels the subscription. **Ads decision:** no ad network. Sponsor messages are text-only, written and switched on by a platform owner at /tutor/admin/sponsors, shown only to Free students on Home, Practice and the daily-limit screen (never during a question), with total views and clicks counted and nothing per person; without an active sponsor a note about Plus shows instead. Reason: networks that serve children (e.g. AdSense with child-directed tagging) still load third-party scripts and cookies, need a consent banner in the EU and Switzerland, and give no control over the creative. A third tier is not built. Terms and privacy policy updated the same day.

- **Plans (proposal, CHF, to be validated)**:

| Plan | Price | Includes |
|---|---|---|
| Free | 0 | Solo student, 1 course, 20 questions/day, no AI explanations |
| Student Plus | 9/month or 69/year | All courses, unlimited practice, study plan, mock papers, AI explanations |
| Tutor | 29/month | Up to 15 tutees, assignments, session room, scheduling, 500 AI credits |
| Tutor Pro | 59/month | Unlimited tutees, booking page + payments, own question bank import, 2,000 credits |
| School | from 6/student/year, min 100 seats | Org admin, SSO (Google/Microsoft), classes, reporting, DPA, priority support |

- Stripe Checkout + Customer Portal + webhooks → `entitlements` table; feature gates read entitlements, never Stripe directly. Schools: invoice billing, seat counts, renewal reminders.
- AI usage metering per org (credits), hard caps on the free tier.
- Legal: Terms, Privacy, DPA template; Swiss nFADP + GDPR (EU students); minors (parental consent flows where required; schools act as controller); data export and deletion per user; audit log (table exists).
- Operational readiness before the first paid seat: off-site backups with a tested restore, status page, on-call alert to the phone, documented incident process.

### WS8 (idea, to do): "Learn maths" self-directed path, Duolingo style

**Requested by Oscar 2026-10-30.** For people who want to learn or refresh maths on their own, for example adults filling gaps.

- **Onboarding quiz** (5 minutes): what they want (everyday maths, help a child, return to study, a specific exam), then a short adaptive placement test that walks a prerequisite graph up and down to estimate their level per skill.
- **Skill graph**, not a syllabus: small skills (fractions → ratios → percentages → …) with prerequisite edges, mapped onto the existing curriculum nodes where they overlap so the question bank is shared.
- **Dynamic lesson plan**: daily 5–10 minute lessons (short explanation, worked example, practice) chosen from skills whose prerequisites are mastered, with spaced review of earlier skills; the plan re-plans after every session from mastery estimates.
- **Motivation**: streaks, daily goal, progress map of the skill graph; no ads, no dark patterns; friendly to older learners (large type, plain language, no timer by default).
- **Reuses** what exists: question engine, symbolic grading, figures, spaced repetition, student dashboard patterns. New: skill graph, placement algorithm (start with a simple Elo/IRT-lite estimate per skill), explanation content per skill, solo sign-up without a tutor.

**Separate product or not (recommendation):** build it inside Mathium first as a "Learn" mode with its own landing page, because it shares almost all of the machinery and its learners can later book a tutor through the same platform. Keep the skill graph and learner model subject-agnostic (the data model already is). A broader "Duolingo for everything" is a separate brand and a much bigger bet: the engine generalises, but each subject needs its own answer types, grading and, above all, reviewed content. Decide after the maths version shows retention (for example, a share of learners still active after four weeks).

---

## 5. Sequencing and effort

Part-time alongside the thesis (realistic ~8–12 h/week). Order chosen so that each phase is usable on its own.

| Phase | Weeks | Outcome |
|---|---|---|
| 0 Stabilise | 1–2 | Green CI, clean repo, secrets rotated, name chosen |
| 1 Port to m70q | 3–4 | Self-hosted staging; Oscar tutors on it |
| 2 Question engine v2 | 4–6 | Multi-part, marks, figures, CAS grading |
| 3 Curriculum + content | 4–6 | IB DP/MYP trees (2021 + 2027), ≥ 5k reviewed questions, importers |
| 4 Roles + solo mode | 4–6 | Orgs, classes, teacher dashboards, self-serve students |
| 5 Session room | 3–4 | Whiteboard + shared question in live sessions |
| 6 Scheduling | 3–4 | Booking page, two-way calendar sync |
| 7 Monetise | 3–4 | Stripe plans, school licences, legal, ops readiness |

Total: roughly 7–9 months part-time. Phases 2–3 are the product; 5–7 can be reordered by what early users ask for. Phase 7's operational items (off-site backup, alerting) gate any paid launch regardless of order.

Quick wins that can land during phase 1: image-on-question (field exists, no UI), tutor comments on attempts (table exists), multi-workspace membership.

---

## 6. Risks

- **Content legality**: the bank must be original or CC BY. Enforce `license` on every question at the schema level and block publishing to the global library without it.
- **Grade-level accuracy**: generation without a strong syllabus spec drifts. The curriculum tree with exemplar constraints per node, plus observed-difficulty calibration, is the mitigation. Budget reviewer time.
- **IB 2027 guide**: the revised AA/AI guides publish before Aug 2027. Keep curriculum versioned; plan a content delta when the guides are out.
- **Home-server production**: see §3.2.
- **Scope**: seven workstreams is a company's roadmap. Phases 0–3 alone make a product Oscar can use and sell to individual tutors; ship those before promising school features.

---

## 7. Decisions (Oscar, 2026-10-30) and what is still open

| # | Topic | Decision |
|---|---|---|
| 1 | Name | **Mathium** (Oscar, 2026-10-30). `mathium.com` is held by an expired-domain registrar (NameBright, auto-renewed 2026-10-02, no public price); `mathium.app`, `.io`, `.ch`, `.se` and `getmathium.com` / `trymathium.com` are free. Plan: `mathium.app` as the product domain (free first year via the GitHub Student Pack's Name.com offer, ~USD 15/yr after), optionally `mathium.ch` and a `.com` redirect variant. `.io` rejected: ~USD 52/yr renewal. |
| 2 | Old data | Supabase project restored; migrate it wholesale (296 questions, 3 students, 62 attempts). |
| 3 | Production | m70q until there are paying customers; portable Compose stack so a VPS move stays cheap. |
| 4 | Subjects | Maths only; model stays subject-agnostic (answer types, figures, curricula). |
| 5 | Languages | English only for now, data model designed for more (§2.3). International schools are the first market. |
| 6 | First customers | Oscar's own tutees, then schools and agencies. So the order is phases 0–3, then 5 and 6 (session room, scheduling), then 4 (orgs/classes) when a school is in sight. |
| 7 | AI | Anthropic first (Max 5x: $100/month API credit), OpenAI second, per-task model table, local embeddings on m70q (§3.1). End-of-cycle credit sweep generates questions with whatever is left (WS3). |
| 8 | Auth | Google + email + magic link now; Microsoft and per-school SSO later via Better Auth. |
| 9 | Budget | ≤ CHF 10–20/month. Fits: domain ~1–3/month, transactional email free tier, AI inside the Max credits, no tldraw licence. |
| 10 | Legal and billing | Deferred; non-commercial MVP. Licence discipline on content stays, so nothing has to be purged later. |
| 11 | IB licence | Not pursued: the IB excludes for-fee tutoring services (WS3). |

### 7.1 Name shortlist (registrability checked 2026-10-30 against each registry's RDAP/whois; trademarks not checked)

Every plain dictionary word is taken on `.com`, so the realistic cheap homes are `.app` (~USD 15–20/yr), `.ch` (~CHF 10–15/yr), `.se` (~SEK 150–250/yr) or `.io` (~USD 35–50/yr).

| Name | Meaning | Free on | Notes |
|---|---|---|---|
| **Mathein** | Greek *mathein*, "to learn"; the root of *mathematics* | `.app` `.io` `.se` `.ch` | Best meaning fit; easy to say in English and Swedish. |
| **Kluring** | Swedish for a brain-teaser; *klura* = to figure out | `.app` `.io` `.ch` | Swedish identity, friendly, memorable; `.se` taken. |
| **Scholium** | A marginal explanatory note in a mathematical text (Euclid's commentators) | `.io` `.se` `.ch` | Erudite, tutoring-flavoured; `.app` taken. |
| **Didaxis** | Greek "teaching" | `.app` `.io` `.se` | Clean, teacher-oriented; `.ch` taken. |
| **Paedia** | Greek *paideia*, education | `.io` `.se` `.ch` | Slightly generic. |
| Klurio / Klurium / Kluro | Coined from *klura* | `.app` `.io` (`.ch` for Klurio/Klurium) | Brandable variants if Kluring is too Swedish. |
| Surdly / Radixa / Axiomo / Mathly | Coined from maths terms | `.io` `.se` `.ch` (Surdly also `.app`) | Playful; Mathly risks sounding like a dozen others. |

**Coined names (second sweep, 2026-10-30; `.ch` unchecked where the registry rate-limited):**

| Name | Built from | Free on |
|---|---|---|
| **Heuriko** | *heuristic* / *eureka* | `.app` `.io` `.se` |
| **Mathium** | maths + -ium (an element) | `.app` `.io` `.se` `.ch` |
| **Lemmify** | lemma + -ify | `.app` `.io` `.se` `.ch` |
| **Thetica** | theta + -ica | `.app` `.io` `.se` `.ch` |
| **Numoria** / **Mathoria** | number, maths + -oria | `.app` `.io` `.se` |
| **Pondrix** | ponder + -ix | `.app` `.io` `.se` |
| **Tangento** | tangent + -o | `.app` `.io` `.se` |
| **Kalkylo** | Swedish *kalkyl* (calculation) + -o | `.app` `.io` `.ch` |
| Sigmify, Numium, Heurika, Eurekly | sigma, number, eureka | `.app` `.io` `.se` (`.ch` for the first two) |
| Rootio, Sigmio | root, sigma + -io | `.app` `.se` `.ch` |
| Mathora, Mathix, Kalkio, Derivio, Mathera, Graspio, Fermio, Gaussly, Tuteo | various | `.io` only (plus `.se`) |

Recommendation from both lists: **Heuriko** (distinctive, says "the moment it clicks"), **Mathium** (obvious category, premium feel) or **Mathein** (best etymology). Before buying: check EU/CH/SE trademark registers (EUIPO eSearch, Swissreg, PRV) and app-store name collisions.

### 7.2 Still open

- Buy `mathium.app` (Oscar; DNS record later needs approval). Optionally backorder `mathium.com` at NameBright/DropCatch if it ever drops.
- Link the Console organisation to the Max plan to claim the $100/month, and set a $100 workspace spend limit.
- Billing-cycle day of the Max plan (for the credit sweep schedule).

## 8. Sources

- Repo inspection, `npm test`, `tsc`, `npm outdated`, git history scan: 2026-10-30. Supabase host did not resolve on 2026-10-30; Oscar confirmed the project was paused and is restoring it (2026-10-30).
- Hub pages `Projects/TutorAssist`, `Home Server`, `Home Server/Access and Security`, `Websites and Domains`, `Roadmap`: 2026-10-29.
- IB curriculum update schedule (first teaching Aug/Sep 2027, first assessment May 2029): ibo.org/university-admission/latest-curriculum-updates (2026-10-30).
- IB licensing policy for third parties and paid tutoring: ibo.org "Licensing IB materials" (2026-10-30).
- tldraw licence model (watermark with hobby licence, paid business licence for production): tldraw.dev legal and pricing pages (2026-10-30).
- Cal.com `LICENSE` on GitHub main: MIT (2026-10-30); enterprise features separately licensed.
- excalidraw-room: MIT, self-hostable (2026-10-30).
- JSXGraph: LGPL/MIT dual licence; GeoGebra: commercial use needs a special licence (2026-10-30).
- OpenStax CC BY 4.0; Illustrative Mathematics CC BY 4.0 vs Open Up Resources K–5 CC BY-NC; GSM8K and MATH MIT; OpenMathInstruct-2 and MathOdyssey CC BY 4.0 (secondary sources, 2026-10-30; verify per dataset before import).
- Better Auth "Migrating from Supabase Auth" guide, Microsoft provider page and SSO plugin page (2026-10-30).
- Anthropic docs "API credits for Max and Team plans" (platform.claude.com, 2026-10-30); model prices from the Claude API reference (cached 2026-10-06).
- IB "Licensing policies" page (ibo.org; via search snippets 2026-10-30, the page itself blocks fetching): for-fee tutoring excluded, 25 % cap, two-session embargo, no obligation to grant.
- Domain registrability: Verisign (.com), Google Registry (.app), Identity Digital (.io), nic.ch (.ch) RDAP and whois.iis.se (.se), 2026-10-30.
