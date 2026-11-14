# Money Tracker TODO

This is the implementation tracker across sessions. The architecture documents describe the intended design; checked tasks here describe completed work. Do not mark a task complete just because its UI exists with sample data.

## Current handoff

| Item | Status |
| --- | --- |
| Foundation | Next.js + TypeScript + Astryx Matcha starter implemented |
| Latest implementation commit | `935f5b8` — UI shell; Google authentication changes are not committed yet |
| Working product | Live browser-isolated POC: AI/manual draft → confirmation → D1 records and monthly totals |
| Backend | POC Worker + dedicated D1 + capped live AI; Google OAuth and full MVP schema remain open |
| Next task | **AUTH-01: configure Google OAuth, deploy, and verify real sign-in** |
| Active task | **AUTH-01 — deployed/configured; real Google sign-in verification pending** |
| External setup needed later | Google OAuth credentials for AUTH-01; Cloudflare POC is deployed; no secrets in Git |

## How to use this tracker

Pick a task by its stable ID, check its dependencies, and set Active task above before implementation. Most tasks are intended as one focused session; split larger tasks into sub-checklists under the same ID if needed. The order below is recommended, not a promise of equal effort.

At the end of each session, update checkboxes, the handoff, and the session log. Record what actually passed, what remains, and any blocker. Keep incomplete tasks unchecked. Update design documents if implementation changes the agreed behavior. Commit/push only when requested.

Suggested session prompt:

> Read AGENTS.md and TODO.md. Implement UI-01, respecting its dependencies and acceptance criteria. Run appropriate checks, then update TODO.md with progress and the next step. Do not commit or push unless requested.

## Completed foundation

- [x] **SETUP-01 — Architecture research:** Cloudflare-first stack, D1 design, chat/AI flow, and Matcha UI plan documented.
- [x] **SETUP-02 — Frontend scaffold:** Next.js App Router, TypeScript, pinned Astryx packages, Matcha production CSS/fonts, and static export configured.
- [x] **SETUP-03 — Starter verification:** lint, types, static production build, Astryx diagnostics without failures, and starter browser checks at desktop/mobile widths.
- [x] **SETUP-04 — Repository baseline:** planning and scaffold committed and pushed to `origin/main`.

## Deployment proof completed before MVP phases

- [x] **POC-01 — Browser-isolated Cloudflare deployment proof:** frontend + Worker + dedicated D1 + live AI extraction + confirmed/manual saves + SQL totals deployed and exercised. Uses anonymous seven-day browser sessions by explicit user choice. Local/remote isolation and idempotency checks passed. See [deployment record](docs/poc-deployment.md).

- [x] **POC-02 — Organization failure fix:** reproduced salary extraction returning a null description; added safe description fallback, clarification for incomplete financial fields, categorized privacy-safe diagnostics, and fresh-request retries after unavailable results. Verified repeated live salary/expense requests and browser retry regression.

The proof is a deliberately smaller implementation. The API/database/UI tasks below remain open where their full acceptance criteria are not met: no Google login, full conversation/draft lifecycle, saved-record edits/deletion, CSV, charts, or measured production-cost guarantee. Reuse POC lessons rather than treating its schema as the production schema. Before a public pilot, measure request CPU/AI usage, test quota exhaustion and retention, and complete the security/identity tasks.

## Phase 1: Application UI with fixtures

Build realistic UI states before connecting the backend. Keep fixture data clearly separated from live data; no pretend successful saves.

- [x] **UI-01 — Application shell and routes** · Depends on SETUP-02. Add `/login`, `/setup`, `/chat`, `/overview`, `/transactions`, `/settings`, shared desktop navigation, mobile bottom navigation, and profile menu. Done when each route survives direct navigation in the static export, current navigation is identified accessibly, and layouts work on mobile/desktop. Keep arbitrary record/thread IDs in query parameters.
- [ ] **UI-02 — Chat composition and history** · Depends on UI-01. Add Astryx chat layout, date-grouped messages, timestamps, example prompts that fill without sending, composer, and manual-entry access. Done when keyboard/IME behavior is correct, input survives simulated errors, and the mobile keyboard does not cover controls. Use fixture responses only at this stage.
- [ ] **UI-03 — Transaction preview and clarification** · Depends on UI-02. Build draft states, editable amount/type/category/date/description, one active clarification context, cancel, saving, saved receipt, and unknown-save status. Done when fixture interactions show every state accurately, category edits require no AI call, and nothing appears saved before a simulated acknowledgment.
- [ ] **UI-04 — Manual transaction form** · Depends on UI-01. Build reusable amount, direction, category, date, and description inputs. Done when errors are inline, values are retained on failure, and the same form can support draft and saved-record editing. Define a typed submit boundary for later API integration.
- [ ] **UI-05 — Transactions view** · Depends on UI-04. Desktop table/mobile list, filters, cursor/load-more UI, details, edit, delete confirmation, export scope, and conflict/loading/empty states. Done when fixture controls work and no destructive action silently succeeds.
- [ ] **UI-06 — Monthly overview** · Depends on UI-01. Income, expenses, net cash flow, category bars, daily trend, recent records, month switcher, and accessible chart alternatives. Done when all fixture totals reconcile and empty months show honest empty states. Add Recharts only when needed and use Matcha tokens.
- [ ] **UI-07 — Login, onboarding, and settings** · Depends on UI-01. Google sign-in affordance, currency/timezone setup, profile/sign-out, retention explanation, export/account deletion UI. Done when fixture states cover errors/session expiry and destructive actions require confirmation. Currency locking after ledger creation must be explained.

## Phase 2: Cloudflare runtime and identity

- [ ] **API-01 — Worker foundation and local development** · Depends on SETUP-02. Add Wrangler configuration, TypeScript Worker API, health endpoint, same-origin `/api/*` routing, local frontend/API workflow, and environment example. Done when static assets bypass API execution, exported deep links work, and a request reaches the Worker locally. Keep Next.js statically exported; do not introduce server-only Next.js features.
- [ ] **DB-01 — D1 schema and migrations** · Depends on API-01. Implement application schema with Drizzle, category seeds, ownership references, money/type checks, revisions, idempotency constraints, and indexes from the database plan. Generate the selected Better Auth schema rather than copying conceptual auth tables. Done when migrations apply to empty local D1 and constraints reject invalid/duplicate/cross-owner references. Coordinate the generated auth schema with AUTH-01.
- [ ] **AUTH-01 — Google OAuth and D1 sessions** · Depends on DB-01. Integrate Better Auth, request-scoped runtime bindings, trusted origins/callbacks, secure cookies, session validation, logout, and expired-session handling. Done when login/logout works locally with configured credentials and two users have distinct sessions. Document external credential setup; do not commit secrets.
- [ ] **AUTH-02 — Profiles and onboarding API** · Depends on AUTH-01, UI-07. Create/read/update profiles and connect login/setup/settings. Done when first visits require setup, returning users resume Chat, INR/timezone defaults are explicit, and profile changes cannot rewrite ledger history or change currency after records exist.
- [ ] **OPS-01 — Cloudflare deployment proof** · Depends on AUTH-01, API-01. Deploy a development environment, test callback URLs plus authenticated D1 read/write, and measure CPU on session and API requests. Done when remote behavior is verified and results recorded. This task needs account configuration; a local build alone does not complete it. Confirm free-plan fit using measured limits before relying on it.

### AUTH-01 handoff

- [x] Better Auth Google provider, encrypted OAuth token storage, request-scoped native D1 adapter, and generated auth schema.
- [x] Additive account-owned ledger schema and user-scoped queries; old anonymous cookies/session creation rejected; sign-out/expiry do not delete account records.
- [x] Google sign-in/sign-out UI, private-view gating, account profile, and removal of browser-demo access controls/copy.
- [x] Local D1 migrations, signed-session integration checks, anonymous runtime smoke checks, type/lint/static build/Astryx/deployment dry run, and 15 responsive UI checks with mocked account boundaries.
- [x] Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `BETTER_AUTH_SECRET` as Worker secrets, plus Google's exact callback URL. See [setup instructions](docs/google-auth-setup.md).
- [ ] Apply additive migrations remotely, deploy, and verify real Google consent/callback, same-user cross-browser access, different-user isolation, logout, and runtime CPU.

AUTH-01 remains unchecked above because real Google login and deployment verification are pending. The user has deployed the Google-authenticated version to Cloudflare. Live checks confirm configured secrets, D1 health, rejected anonymous access, and Google authorization with the expected callback/state. No anonymous records were deleted or silently assigned to a Google account.

## Phase 3: Reliable manual ledger

- [ ] **DATA-01 — Shared validation and owned data access** · Depends on DB-01, AUTH-01. Add Zod contracts, exact decimal-to-paise conversion, safe bounds, calendar/timezone handling, and user-scoped queries. Done when unit/integration checks cover decimals, invalid dates, ownership, and safe numeric bounds. Never accept a user ID from model output or a request body as authorization.
- [ ] **DATA-02 — Transaction CRUD and retries** · Depends on DATA-01. Add create/list/detail/edit/delete APIs, filters, pagination, save keys, and revision conflict checks. Done when replay returns one record, conflicting key reuse is rejected, stale edits fail safely, and another user cannot read or mutate any record.
- [ ] **DATA-03 — Summary and export APIs** · Depends on DATA-02. Add SQL monthly/category/day aggregates and scoped CSV export. Done when totals reconcile with exported transactions, drafts are excluded, user/date/currency filters match, and CSV escaping/formula-like values are handled safely.
- [ ] **APP-01 — Connect ledger and overview UI** · Depends on DATA-03, UI-04, UI-05, UI-06, AUTH-02. Replace fixtures with real API responses for forms, lists, summaries, and exports. Done when manual entry, edit, and delete refresh all relevant views, uncertain requests resolve by their original keys, and session errors retain safe unsent input.

## Phase 4: Chat persistence and AI

- [ ] **CHAT-01 — Conversation/message APIs** · Depends on DATA-01, UI-02. Implement default conversation, paginated history, send idempotency, operation status/leases, and same-owner draft associations. Done when duplicate/concurrent sends process once, interrupted processing can recover, and another user cannot access a thread. No database transaction stays open during model calls.
- [ ] **AI-01 — Extraction contract and evaluation set** · Depends on DATA-01. Implement discriminated outcomes, narrow supported rules, normalized candidate fields, and representative cases: salary, fares, decimals, Indian grouping, missing amounts, relative/ambiguous dates, multiple entries, transfers, and prompt injection. Done when unsafe/incomplete results cannot become ready drafts. Decide whether Hinglish is a launch requirement and record it.
- [ ] **AI-02 — Workers AI adapter and measured selection** · Depends on AI-01, API-01. Compare currently available free-eligible models, implement constrained output, timeouts, minimal prompts, and metadata without raw financial logging. Done when the evaluation set is run and accuracy, latency, neurons per extraction, and chosen model/prompt version are recorded. Do not promise a daily message count before measurement.
- [ ] **AI-03 — Persistent limits and failure handling** · Depends on AI-02, CHAT-01. Add per-user limits, conservative shared budgeting, input/output bounds, retry control, and manual fallback. Done when limits work across Worker instances and quota/model failures create no financial records. Turnstile can protect vulnerable public endpoints if needed; it does not replace authenticated limits.
- [ ] **CHAT-02 — Draft, clarification, and confirmation APIs** · Depends on CHAT-01, AI-03, DATA-02. Persist draft states, merge explicit clarification replies, retain original reference dates, validate edits, and atomically confirm with expected revision. Done when one draft yields at most one transaction, stale confirmations are rejected, cancelled/deleted entries cannot be resurrected by late retries, and receipt recovery works.
- [ ] **APP-02 — Connect chat end to end** · Depends on CHAT-02, UI-03, APP-01. Wire messages, clarification, preview/edit/cancel/confirm, saved receipts, history resume, and summary refresh. Done when a real sentence produces one user-confirmed record, missing details resume the same draft, and manual entry still works during AI failure.

## Phase 5: Privacy, operations, and pilot

- [ ] **PRIV-01 — Retention and deletion** · Depends on CHAT-02, AUTH-02. Finalize/disclose the proposed 30-day raw-chat retention policy; implement cleanup, conversation deletion preserving ledger entries, and account deletion removing owned data/auth records. Done when provenance links are detached safely and cleanup/deletion checks pass. Keep shared categories intact.
- [ ] **OPS-02 — Recovery and production configuration** · Depends on OPS-01, DB-01, PRIV-01. Separate development/production databases and secrets, document migrations/rollback, independent exports, and restore procedure. Done when an actual restore has been rehearsed and the procedure accounts for deleted records reappearing after restore.
- [ ] **QA-01 — Functional and isolation regression checks** · Depends on APP-02, PRIV-01. Add focused Vitest/API/Playwright coverage for login → entry → confirmation → reporting, two-user isolation, concurrency/retries, stale revisions, date boundaries, and AI/manual fallback. Done when these critical paths pass against the implemented system; add meaningful tests alongside each earlier task rather than waiting for this phase.
- [ ] **QA-02 — Accessibility and responsive review** · Depends on APP-02, UI-07. Verify keyboard/focus, screen-reader status updates, contrast, 200% zoom, reduced motion, charts, and mobile keyboard/safe-area behavior. Done when blocking issues are fixed and reviewed viewports/states are recorded.
- [ ] **OPS-03 — Cost/performance and small pilot** · Depends on OPS-02, QA-01, QA-02, AI-03. Recheck current plan allowances, measure Worker CPU, D1 scans/storage growth, and AI usage under representative traffic; verify quota exhaustion behavior. Done when the whole application is deployed, a small real-user pilot passes, and measured limits/upgrade triggers are documented. Free operation remains conditional on these results.
- [ ] **MAINT-01 — Dependency follow-up and CI** · Depends on SETUP-03. Recheck the documented development-tooling advisories, align Node types with the supported runtime, and add CI for lint, types, static build, Astryx diagnostics, and implemented tests. Done when clean-checkout checks run reproducibly and remaining dependency issues are explicitly recorded without forced unverified upgrades.

## Out of scope for the initial MVP

Bank sync, receipt OCR, voice/WhatsApp entry, transfers/refunds without defined accounting semantics, multiple currencies/accounts, recurring entries, shared households, budgets, forecasts, AI advice, natural-language SQL, vector search, and offline financial saves. Track new requests separately rather than quietly expanding the tasks above.

## Session log

Append one row after each implementation session. Link the commit only if one was actually created.

| Task | Outcome and checks | Remaining work / next step | Commit |
| --- | --- | --- | --- |
| SETUP-01–04 | Planning and frontend scaffold completed; starter build/lint/types/Astryx/browser checks passed | Start UI-01; all application/backend features remain open | `4b17397`, `a6acd5a` |
| POC-01 | Dedicated Cloudflare deployment; local/remote D1 isolation/concurrency/totals and live AI extraction/confirmation verified; responsive local browser checks passed | UI-01 next; full MVP tasks and production CPU/cost/retention verification remain open; see deployment record | `4e3da26` |
| POC-02 | Salary null-description regression and unchanged-text failure retry fixed; unit/type/lint/build/Astryx checks passed; live salary twice then expense and browser retry verified | Deployed version `05fed95b-f94b-4d5f-9f95-fd14ee998f51`; continue UI-01 | `4e3da26` |

| UI-01 | Static routes and shared Astryx shell, desktop/sidebar and mobile navigation, profile dialog, route-preserved draft state, real summary/transaction views, search/type filters; unit/lint/type/build/Astryx/local API checks passed; 6 browser scenarios across 1440/390/320 widths passed locally and on the live deployment | Continue UI-02; deployed version `653d5712-cb5f-4b3d-8a51-c96ee07dc392`; full transcript, charts, full record actions, and Google account support remain incomplete | `935f5b8` |

| AUTH-01 (partial) | Google auth and account-ledger implementation prepared; local migrations, signed-session/isolation tests, static checks and 15 fixture-based UI checks passed | User deployed/configured Cloudflare; live API protection and Google OAuth initiation verified; real Google token exchange remains unverified | Not committed |

## References

- [UI plan](docs/ui-plan.md)
- [Database architecture](docs/database-architecture.md)
- [Chat and AI flow](docs/chat-ai-flow.md)
- [Application approach](docs/approach.md)
- [Cloudflare feasibility](docs/cloudflare-feasibility.md)
- [Development commands and known setup limitations](README.md)
