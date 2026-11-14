# Money Tracker

Start with [TODO.md](TODO.md) for task IDs, dependencies, acceptance criteria, and session handoffs.

Next.js App Router + TypeScript + Astryx Matcha, with a same-origin Cloudflare Worker API, D1, and Workers AI. The new authentication implementation uses Better Auth and Google sign-in, with account-owned ledgers shared across devices and private to each user.

**Google authentication is deployed and configured** at https://money-tracker-poc.kaushik0976.workers.dev. Live health, anonymous-access rejection, and Google authorization initiation have been verified. Completing a real Google consent/callback flow is still pending user verification. See [Google auth setup](docs/google-auth-setup.md) for exact callback URLs, secret commands, and launch verification. Changes do not automatically attach anonymous test data to a Google account.

## Development

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run db:local
npm run build
npm run dev:worker -- --var AI_ENABLED:false
```

Open http://localhost:8787. Without OAuth credentials, the app shows the sign-in setup-pending state and private APIs reject anonymous requests. Configure ignored `.dev.vars` from `.dev.vars.example` to use real Google sign-in locally. Do not commit or share secrets.

`npm run dev` previews the frontend on port 3000 but does not supply Worker APIs or OAuth callbacks. Rebuild `out/` after frontend edits when testing through Wrangler. AI bindings invoke Cloudflare remotely when enabled, even in local development.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run ui:check
npm run deploy:dry
```

The static build is in `out/`. Type checking first generates Next.js route declarations, then checks frontend and Worker code.

`npm test` includes actual Better Auth signed-session integration checks with a local SQLite-backed D1 adapter, plus money/date/extraction tests. Tests create only synthetic identities and do not bypass production authentication or perform a real Google token exchange.

For browser tests, start the local Worker above, then in another terminal:

```sh
npx playwright install chromium
npm run test:ui
```

UI tests mock the account/API boundary, covering responsive routes, drafts, filters, signed-out gating, sign-out, and missing-configuration behavior. Real API ownership and session validation are tested separately in `npm test`. `PLAYWRIGHT_BASE_URL` selects a test server; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium executable. `node scripts/smoke.mjs http://localhost:8787` checks actual signed-out API protection and static routing without creating users or calling AI.

## Authentication and data

- Google OAuth is handled by the Worker under `/api/auth/*`; the static frontend has no provider secrets.
- Better Auth stores users, accounts, and revocable sessions in D1. OAuth tokens are encrypted using `BETTER_AUTH_SECRET`.
- Ledger records reference user IDs rather than browser sessions. Sessions can expire/sign out without deleting saved transactions.
- Anonymous cookies and session creation are rejected. The UI hides private views until a validated account session is available; each API independently checks ownership.
- Existing browser-demo tables remain for their original expiration cleanup. New account tables are additive migrations, not destructive replacements.
- INR and Asia/Kolkata remain the current fixed ledger defaults. Full onboarding, exports, deletion controls, charts, and durable chat history are backlog items.

## Theme and routes

Astryx's generated `src/astryx-themes.ts` imports Matcha's built theme, production CSS, and font CSS. `src/components/app-theme.tsx` provides the light theme, and `src/app/globals.css` loads the reset/base styles. The theme loads Google Fonts with system fallbacks; the build itself does not fetch fonts. Astryx packages are version-aligned and pinned.

Routes: `/chat/`, `/overview/`, `/transactions/`, `/settings/`, `/login/`, `/setup/`; `/` aliases Chat. Shared client state preserves unsaved entries during in-app navigation. Signing out clears account state; reloading discards unsaved client-only drafts.

Use `npm run astryx -- component Button` to inspect component APIs. Follow `AGENTS.md` for component-first authoring conventions.

## Deployment

Follow [Google auth setup](docs/google-auth-setup.md). Configure all OAuth secrets and approved redirect URIs before replacing the working demo, then apply remote migrations and deploy. Do not mark AUTH-01 complete until real Google login, same-account access from another browser, different-account isolation, and logout have been verified remotely.

Historical deployment details: [POC deployment](docs/poc-deployment.md). Design references: [UI](docs/ui-plan.md), [database](docs/database-architecture.md), [chat/AI](docs/chat-ai-flow.md).

The installation audit reports seven moderate development-tooling findings through TypeScript ESLint's transitive minimatch dependency. Compatible audit updates did not resolve them; no forced major override was applied. Astryx diagnostics also flag external font loading for manual review. Current auth overhead and quotas still require measurement before promising free production capacity.
