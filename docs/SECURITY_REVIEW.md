# Security review before public exposure

Date: 2026-10-30. Scope: the self-hosted stack on m70q (web, worker,
PostgREST, Postgres) and the application code on branch `mathium-phase-1`.
Method: configuration and port checks on the server, database grants and
RLS coverage, a read of every route that uses the service role, targeted
code search (HTML rendering, filter construction, email templates), browser
checks with a content security policy, and `npm audit`.

## Findings and fixes

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | **Stored XSS in the LaTeX renderer.** When text contained any maths delimiter, everything outside the maths was written to the page unescaped. A question (shared to every workspace through the library) or a student answer shown to a tutor could run script. | Fixed: `src/lib/latex-html.ts` escapes all text and renders maths with KaTeX `trust: false`; tests in `latex-html.test.ts`. |
| 2 | Medium | **Views and functions bypassing RLS.** Five views ran with owner rights; `public.users` (every email), `mv_student_performance` and `schema_migrations` were readable by the API roles; three `rpc_*` dashboard functions, `log_audit_event` and `reconcile_question_stats` ran with elevated rights on caller-supplied ids; `update_question_stats` accepted any question; no elevated function pinned `search_path`. Not reachable from outside (PostgREST is internal and routes issue fixed queries), but open to any direct API caller. | Fixed: migration `0010_security_hardening.sql`. |
| 3 | Medium | **No browser hardening headers.** | Fixed: per-request nonce CSP in `src/proxy.ts` (enforcing; `CSP_MODE=report-only` to relax), `nosniff`, `DENY` framing, referrer and permissions policies. Every page checked headless with no violations. |
| 4 | Medium | **HTML injection in emails.** Names, workspace names and assignment text went into email HTML raw. | Fixed: escaped in every template; the assignment email moved to a template and the shared sender. |
| 5 | Medium | **Vulnerable dependencies.** nodemailer 7 (SMTP and address-parser advisories), mathlive 0.108 (XSS), lodash-es and nanoid inside Excalidraw. | Fixed: nodemailer 10.1.7, mathlive 0.111.1, overrides for lodash-es 4.18.1 and nanoid 3.3.20. No high or critical left in production dependencies. |
| 6 | Low | PostgREST `or()` filters built from unvalidated query parameters (`programId`, `gradeLevelId`). Other filters kept results inside the caller's workspace. | Fixed: UUID validation. |
| 8 | Medium | **AI spend open to anyone once public.** Any new sign-up becomes a tutor and could run generation on the platform's API key; one AI route (topic analysis, GET) also lacked a tutor check. Found after go-live preparation, 2026-10-30. | Fixed: `src/lib/ai-access.ts` gates every AI route to platform owners and `AI_ALLOWED_EMAILS` (or `AI_OPEN_TO_ALL=true`) with a per-workspace daily cap (`AI_DAILY_LIMIT`, default 300); tutor check added. |
| 9 | Medium | **Uploaded SVGs served inline from our origin.** Opened directly, an SVG with script would run on mathium.app. | Fixed: markup types are served with a no-script sandbox CSP and `nosniff`. |
| 7 | Low | Tutor-on-behalf Google calls read tokens through the caller's RLS, so student bookings could not create the tutor's event. | Fixed with the service role; call sites only pass ids derived server-side (documented in `getAuthenticatedClient`). |

## Checked and fine

- Only the web container is published, on the tailnet address; Postgres and PostgREST are internal. `.env` is mode 600; database password and both signing secrets are 48–64 characters.
- Every route using the service role checks the caller first and scopes to their workspace (invite lookup is public by design, keyed by an unguessable token).
- File downloads validate the key format and the workspace; uploads check type and size.
- Session rooms, board streams, notes and booking enforce access server-side; tested with a user from another workspace (404) and a student trying tutor actions (403).
- Calendar feed URLs carry 192-bit random tokens and can be replaced.
- Sign-in is rate limited by Better Auth in production (observed while testing).

## Before going public (checklist)

1. Rotate every secret that ever lived in `.env.local` or Supabase: OpenAI, Google OAuth client secret, SMTP password, Cloudflare R2, the old Supabase keys. Generate fresh `BETTER_AUTH_SECRET` and `PGRST_JWT_SECRET` for production.
2. DNS for `mathium.app` and a Caddy site with HTTPS; set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the HTTPS origin so cookies are `Secure`; add HSTS at Caddy. Keep `/api/sessions/*/board/stream` unbuffered.
3. Google OAuth consent screen and redirect URI on the HTTPS origin.
4. Set `AUTH_REQUIRE_EMAIL_VERIFICATION=true` once SMTP is configured.
5. Off-site backup with a tested restore (there is none yet).
6. Delete the Supabase and Vercel projects after two weeks of real use.

## Remaining, accepted for now

- Moderate advisories in development tooling (`drizzle-kit` → `esbuild`) and in Excalidraw's optional Mermaid importer; not reachable at runtime by users.
- `script-src` allows `unsafe-eval` because JSXGraph compiles plotted expressions with `Function()`. The nonce and `strict-dynamic` still block injected scripts.
