# Cloudflare-only feasibility review

Researched 13 November 2026. Supersedes the earlier Supabase/Vercel recommendation. This is an architecture review, not a deployed performance benchmark.

## Verdict

The application in idea.md is feasible on Cloudflare without Supabase. Its workload—small transaction writes, per-user monthly SQL aggregates, authentication, and short text extraction—fits Workers, D1, and Workers AI. A free pilot is credible. Unlimited users and unlimited AI at $0 are not.

The main constraints are per-request CPU, shared AI quota, and application-enforced ownership. A database fitting within the storage quota does not prove the app will fit all other quotas.

## Recommended components

| Need | Choice | MVP role |
| --- | --- | --- |
| Frontend | Next.js static export + Astryx Matcha | Browser-rendered authenticated dashboard and chat |
| Hosting | Workers Static Assets | Serve exported HTML, JS, and CSS |
| Backend | Small TypeScript Worker; Hono is an optional router | Auth callbacks, transaction CRUD, parsing, dashboard queries |
| Database | D1 + Drizzle | Transactions, categories, profiles; schema migrations |
| Authentication | Better Auth using its native D1 integration | Google OAuth; persistent users/accounts/sessions in D1 |
| Extraction | Workers AI binding + server-side Zod validation | Convert a message into a proposed transaction |
| Charts | Recharts | Category totals and daily/monthly trends |
| Bot protection | Turnstile where needed | Protect susceptible public entry points; always validate tokens server-side |
| Recovery | D1 Time Travel + periodic independent exports | Recover mistakes; retain longer-lived copies |
| Files later | Private R2 bucket | Receipt images or retained exports when required |
| Tooling | Wrangler, local D1, Vitest/Playwright | Local development, migrations, production-build checks, deployment |

Better Auth is an application library, not a Cloudflare managed customer-auth service. Its [official release documentation](https://better-auth.com/blog/1-5) confirms native D1 binding support and use of D1 batch operations. Start with that supported integration rather than an extra community adapter. Drizzle can still manage application tables; keep one reviewed migration workflow covering auth and application schemas.

Google OAuth means an external identity provider, but no external hosted application database or auth backend. If every identity dependency must also avoid Google, that is a different requirement needing a password/passkey and recovery design. For now, Google login avoids password hashing and email verification/reset infrastructure.

## Architecture

```text
Browser: Next.js static frontend
    |
    | same origin /api/*, secure session cookie
    v
Worker API + Better Auth
    |-- D1: users, sessions, profiles, categories, transactions
    |-- Workers AI: extract draft fields
    `-- R2: optional private files/exports later

Static page/asset requests go directly to Workers Static Assets.
```

Configure routing so only API paths invoke Worker code. Serve the Next.js exported route files correctly, including direct navigation/refresh. Run auth callbacks under the API path with a stable configured origin. Client-side redirects improve usability but every API request must independently validate the session. Use secure HttpOnly cookies, trusted-origin/CSRF protections, and never embed secrets in the exported frontend.

For entry, parse first, show an editable preview, then save on confirmation. The model must not write SQL or determine the user ID. Store money as integer paise; derive dates using the user's timezone; assign stable categories from an allowlist. Use a unique per-user request ID for idempotent saves. Keep manual entry usable during AI failures.

## Next.js choices

**Recommended for the free-first MVP:** standard Next.js with `output: "export"`, fetching private data from the Worker API after login. The dashboard has little need for search indexing or request-time HTML rendering. [Next.js documents static export](https://nextjs.org/docs/app/guides/static-exports), and [Cloudflare serves static assets free](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). This saves runtime rendering work, but API/auth execution still needs benchmarking.

This choice excludes request-time Next.js server features: API handlers and OAuth callbacks live in the Worker, not in exported Next.js routes. Avoid relying on Server Actions, request cookies in server components, or dynamic server rendering. One repository and one same-origin deployment can still contain both frontend and API.

**If full-stack Next.js is preferred:** Cloudflare's [current guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) recommends vinext, a beta Vite-based reimplementation of the Next.js API surface; it also documents an OpenNext path for existing compatibility gaps. Validate dependencies and production behavior early. Do not conflate vinext with the standard Next.js server runtime. SSR is possible, but its CPU cost makes $0 less predictable.

If Next.js is merely a preference, React/Vite + the same Worker API is another straightforward frontend option. There is no need to change frameworks just to implement this idea.

## Free allowances and limitations

| Service | Current relevant allowance | Practical consequence |
| --- | --- | --- |
| Workers Free | 100,000 dynamic requests/day; 10 ms CPU/invocation | CPU-heavy auth/rendering can be the first limit even with few users |
| Static Assets | Free unlimited static asset requests | Preserve the direct asset-serving route; Worker-first routing changes invocation behavior |
| D1 Free | 5 million rows read/day; 100,000 rows written/day | Scanned rows and index maintenance matter, not just returned records |
| D1 storage | 500 MB per free database; 5 GB total across account | A single shared database does not get the full 5 GB |
| D1 recovery | 7-day Time Travel on Free; 30 days on Paid | Add independent exports for longer retention |
| Workers AI | 10,000 neurons/day across account | Model/token-dependent; not a guaranteed message count |
| Turnstile Free | Unlimited challenges; up to 20 widgets | Useful bot defense, not authentication or a spending cap |
| R2 Standard, optional | 10 GB-month storage; 1 million Class A and 10 million Class B operations/month | Has metered overages; enable only when needed and check billing setup |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Waiting for D1 or AI is different from Worker CPU execution: a multi-second AI call does not necessarily consume seconds of Worker CPU. Rendering, library initialization, cryptography, and validation still consume CPU. Free quota exhaustion causes errors rather than unlimited free capacity.

Workers Paid starts at **$5/month**, including 10 million requests and 30 million CPU milliseconds/month, with usage overages. D1's paid allowances are part of that plan; a separate fixed database subscription is not required. AI usage above its daily free allowance is separately metered on Paid. This is a credible low-cost upgrade path, not a guaranteed $5 total bill.

## Database suitability and capacity

D1's relational model is sufficient for this tracker. Start with one shared database, explicit user ownership, and an index on `(user_id, transaction_date)`. Keep session and account lookup indexes too. Paginate transaction lists; compute dashboard totals in SQL over a bounded date range. Avoid loading the complete ledger into the browser for totals.

D1 does not provide Supabase's Postgres RLS model. Every read/update/delete must include the user ID from the validated session, including ID-based lookups, exports, and account deletion. Centralize data access and test with two users. This is the principal responsibility gained by removing a managed backend.

D1 supports atomic [batch operations](https://developers.cloudflare.com/d1/worker-api/d1-database/), but not arbitrary interactive SQL transactions. Use its native atomic patterns and constraints. A [D1 database processes queries serially](https://developers.cloudflare.com/d1/platform/limits/); large unindexed analytics queries can delay other requests. That is manageable for an MVP with small, indexed queries, not a claim of unlimited scale.

Illustrative sizing, not measured capacity: 100 daily users recording 10 transactions each produce 1,000 transactions/day and about 365,000/year. At an assumed 1 KB per transaction including indexes, that is roughly 365 MB/year before auth data and other overhead. It could approach the free database's 500 MB limit. Measure actual growth; do not shard across ten databases just to postpone a $5 upgrade.

For the same pilot, if each user triggers 50 API requests/day, that is 5,000 dynamic requests/day. Index updates and auth/session writes mean the D1 write count is higher than the transaction count. Dashboard scan volume and AI allowance must be estimated separately.

## AI feasibility and cost controls

Workers AI can handle short structured extraction. Benchmark a currently available Cloudflare-hosted instruction model supporting the required JSON/schema format. Check deprecation and paid-only restrictions before selection; do not choose a model solely because an old tutorial uses it. Accuracy for Indian amounts, relative dates, refunds, transfers, and Hinglish must be evaluated with your examples.

Use a short prompt, fixed categories, limited input/output size, and no conversation-history replay. Rules may handle explicit unambiguous inputs; the model handles flexible phrasing. Schema-valid output still requires confirmation. An exhausted allowance should return a usable manual-entry fallback.

Measure average neurons per extraction, including retries. A rough daily capacity estimate is `10,000 / measured average neurons per extraction`, with headroom for variation and other account usage. For example, if measurements show 10 neurons/extraction, the theoretical ceiling is 1,000/day—not a promised capacity and not a measured result. Add persistent per-user quotas and a conservative global application budget. Such token/request controls approximate model spend; reconcile them against Cloudflare usage and avoid uncontrolled retries.

## Email and optional services

Cloudflare [Email Service](https://developers.cloudflare.com/email-service/) now supports transactional sending in beta, but sending to arbitrary recipients requires Workers Paid. Free sending to verified destination addresses is not a solution for general user signup/reset emails. Google OAuth avoids needing this in the MVP. Custom domain registration is also separate from free hosting; a workers.dev address can serve the initial prototype.

Do not add KV, Durable Objects, Queues, Workflows, Vectorize, Hyperdrive, or R2 merely because they are available. The current app needs no vector search, WebSocket session, external Postgres connection, or background job pipeline. Add Cron/Queues for reminders/imports later when there is a concrete workload. Do not use an eventually consistent cache as the authoritative transaction ledger or session-revocation store.

## Implementation sequence and decision gates

1. Deploy the static frontend and Worker API on one origin; validate exported route refreshes and Google OAuth login/logout with D1 sessions.
2. Measure deployed CPU for login callbacks, session checks, writes, and dashboard queries. If those cannot fit Free reliably, optimize or move to Workers Paid before adding users.
3. Implement manual entry, ownership checks, integer money, duplicate prevention, CSV export, and monthly SQL summaries.
4. Add extraction, preview/confirmation, an evaluation set, quotas, and AI timeout/quota fallback. Record measured neurons and latency.
5. Test two-user isolation, retry behavior, dashboard/export reconciliation, account deletion, and D1 restore. Use separate development and production databases and reviewed migrations.

Recommendation: proceed with **Next.js static export + Workers API + D1 + Better Auth/Google login + Workers AI**. A personal/small pilot can plausibly remain free, subject to deployed measurements. Keep Workers Paid as the first upgrade rather than adding a managed database subscription.
