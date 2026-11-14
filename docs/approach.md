# Money Tracker: technical approach and research

Researched 13 November 2026. Recommendations below are engineering judgments; linked documentation supports platform capabilities and quotas. Free tiers can change.

## Recommendation

Build a mobile-first application hosted entirely on Cloudflare: Next.js frontend, Workers API, D1 database, Better Auth, and Workers AI for constrained transaction extraction. Supabase is excluded by the project owner’s preference. Use chat for fast entry and SQL for analytics.

For the strongest chance of staying free, statically export the Next.js frontend and serve it through Workers Static Assets, with same-origin `/api/*` requests handled by a small Worker. Authenticated data loads in the browser. This avoids per-page server rendering and the full-stack Next.js runtime adapter. If server rendering or Server Actions become requirements, evaluate Cloudflare’s full-stack Next.js deployment path and budget for Workers Paid if CPU use exceeds Free. See [Cloudflare feasibility](cloudflare-feasibility.md) for the researched limits, tradeoffs, and capacity assumptions.

The idea's value is reducing the effort of recording spending. The main product risk is incorrect extraction silently damaging the user's records. Prioritize fast correction, predictable categorization, and trustworthy totals over a conversational financial assistant.

## MVP user experience

1. Sign in, choose currency and timezone. Initially support INR with Asia/Kolkata as the suggested timezone, but store the user's choice.
2. Enter a message such as “Spent 30 Rs on Rickshaw to work”.
3. Show an editable preview: Expense · ₹30 · Transport · Today · Rickshaw to work.
4. User confirms; save the transaction and show a receipt with edit/delete controls.
5. Show monthly income, expenses, net cash flow, category breakdown, daily spending, and a searchable transaction list.

Include a manual entry form from the start. It remains usable when AI is unavailable or the message is ambiguous. Net cash flow means recorded income minus recorded expenses; it is not a bank balance.

For the first version, accept one transaction per message. Ask users to split messages with multiple transactions rather than partially saving them. Use a small fixed category list with Other/Uncategorized, plus a category correction control.

Defer bank integrations, receipt OCR, voice entry, WhatsApp integration, recurring payments, shared households, multiple account balances, and AI-generated financial advice. Add CSV export before inviting users to depend on the app.

## Proposed stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Application | Next.js App Router + TypeScript | One application for pages, authentication callbacks, and server endpoints |
| Interface | Astryx + Matcha theme | Chat, forms, tables, and feedback components; see the [UI plan](ui-plan.md) |
| Charts | Recharts | React charts for monthly trends and category totals |
| Authentication | Better Auth + Google OAuth initially | Auth code runs in Workers; users and sessions live in D1; no email delivery initially |
| Database | Cloudflare D1 | SQLite-compatible relational data, SQL aggregates, and managed recovery |
| Database access | Drizzle for application tables; Better Auth native D1 support | Typed application queries and SQL migrations; auth uses its supported D1 integration |
| Validation | Zod | Validate requests and model output on the server |
| Text extraction | Rules for explicit patterns; small hosted language model for flexible phrasing | Keep extraction replaceable and measurable |
| Verification | Vitest and Playwright | Money/date/parser tests, tenant isolation, and the sign-in-to-dashboard flow |

These are proposed tools, not a requirement to install everything immediately. Ordinary React state and Next.js data fetching should be enough initially; add a client query library only if the interaction needs justify it.

Official references: [Next.js](https://nextjs.org/docs/app), [Astryx](https://astryx.atmeta.com/docs/getting-started), [Recharts](https://recharts.github.io/en-US/), [Zod](https://zod.dev/), [Better Auth D1 support](https://better-auth.com/blog/1-5).

## Architecture and extraction

```text
Chat input → authenticated server endpoint → rules/model → validation
          → editable draft → explicit confirmation → database
Dashboard → authenticated SQL aggregates → charts
```

Use separate parse and save operations. The model proposes data; application code owns authorization and writes. Never let model output supply the authenticated user ID, execute SQL, or choose arbitrary server operations.

The extractor should return a schema containing transaction type, decimal amount as text, currency, date, description, and a category from an allowlist. Resolve amounts to integer minor units in application code. ₹30 becomes 3000 paise; do not calculate monetary totals with floating-point numbers.

Pass the current date and user's timezone explicitly. Missing dates can default to today under a stated UI rule. Missing amounts, uncertain direction, or ambiguous dates should require clarification. Do not treat model-reported confidence as proof of correctness.

Workers AI is worth benchmarking for the free prototype. It offers [JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/), but JSON validity does not guarantee a correct transaction. Validate every field and benchmark a model supporting the required output format. Keep a provider interface so a different hosted model can be substituted later.

Start with representative examples including salary, rickshaw fares, decimals, Indian digit grouping, yesterday, refunds, transfers, missing amounts, and mixed Hindi/English if that becomes a requirement. “Withdrew ₹500 from ATM” should not automatically become spending; transfers and refunds need explicit semantics before full support.

No vector database, RAG pipeline, agent framework, or full chat-history prompting is needed for this MVP. Send only the input and minimum extraction context to the model.

## Data and access controls

Suggested tables:

- `profiles`: auth user ID, preferred currency, timezone.
- `categories`: stable category IDs, names, and applicable transaction types.
- `transactions`: ID, user ID, expense/income type, positive amount in minor units, currency, transaction date, category ID, description, timestamps, and client request ID.

The detailed [database architecture](database-architecture.md) and [chat/AI flow](chat-ai-flow.md) refine this proposal: persist conversations, messages, and server-side drafts so users can resume clarification and trace transaction origins. Apply a disclosed retention policy to raw messages and abandoned drafts; confirmed transactions remain the reporting source.

Use database constraints for valid types and amounts, and a unique `(user_id, client_request_id)` constraint to prevent retries creating duplicates. Index `(user_id, transaction_date)` for lists and monthly aggregates. Use a date for the user's accounting day and UTC timestamps for creation/update events.

D1 does not provide the Postgres row-level security approach from the earlier proposal. Enforce ownership in server code: derive user IDs from validated sessions and scope every read, update, and delete to that user. Centralize those queries and verify them with two-user isolation tests. Expose D1 only through the Worker binding; keep credentials out of the browser. Never publicly cache personalized API responses.

Calculate totals in SQL, filter month boundaries using the user's accounting dates, and never sum different currencies together. Initially enforce one currency per user. Authenticate and rate-limit parsing, bound input size, handle timeouts, and avoid logging raw financial messages. Provide export and account deletion, and plan backups and restore verification before a serious public launch.

## Deployment choice and cost

Use Cloudflare Workers Static Assets + API + D1 + Workers AI. Use Better Auth as an open-source library deployed in the Worker, not a separate managed authentication subscription. Google OAuth is an external identity provider; hosting and persisted application/auth data remain on Cloudflare.

The free-first architecture deliberately moves runtime server functionality into the Worker API: Next.js Server Actions, request-time server rendering, and Next.js auth route handlers do not run in the static export. Keep browser and API on one origin, route only API requests through the Worker, and configure the OAuth callback under that API.

A $0 pilot is plausible within measured CPU, storage, request, and AI allowances. It is not a promise of unlimited free production service. Workers Paid starts at $5/month with allowances and possible overages; it does not require a separate D1 subscription. Details and official sources are in [Cloudflare feasibility](cloudflare-feasibility.md).

## Delivery plan

1. **Deployment proof:** deploy a minimal app, test login callback and authenticated database read/write. If targeting Cloudflare, measure CPU and confirm runtime compatibility before committing to that build path.
2. **Reliable ledger:** schema, server-enforced ownership, manual entry, edit/delete, transaction list, monthly SQL totals, CSV export. Verify isolation with two users and duplicate request handling.
3. **Chat entry:** extraction contract, representative evaluation set, preview/confirmation, ambiguity handling, timeouts, and manual fallback. Compare candidate models on accuracy, latency, and measured cost.
4. **Dashboard and pilot:** category chart, daily trend, month filter, mobile usability, privacy-conscious logging, export/deletion, and restore plan.

Proposed launch gates: zero cross-user data access in access tests; exact minor-unit arithmetic; ambiguous inputs never silently committed; duplicate submissions create one record; dashboard totals reconcile with exported transactions; AI failure leaves manual entry usable.

Assumptions to revisit: personal prototype versus commercial product, required languages, expected daily users, and whether zero monthly spend is a hard constraint. Default scope is an INR-first personal prototype with manual confirmation and no bank connection.
