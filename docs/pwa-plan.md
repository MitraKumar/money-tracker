# Money Tracker PWA plan

Status: PWA-01 and PWA-02 implemented and verified locally, 15 November 2026. PWA-03/04 remain open; no deployment performed.

## Scope and architecture

Make the existing Money Tracker installable, launchable in a standalone window, and understandable when connectivity drops. Preserve Next.js static export, Cloudflare Workers Static Assets, same-origin `/api/*`, Better Auth, D1, and the current Astryx page frames. The open screens form one app; they do not need separate PWAs.

First release: installation, branded icons, offline fallback, connectivity feedback, and controlled updates. Ledger reads/writes, AI, authentication, and CSV export require a connection. Do not persist financial data or queue mutations in browser storage. Full offline ledger access, background sync, push notifications, and app-store packaging are separate future decisions.

This follows the existing [UI offline behavior](ui-plan.md) and [application architecture](approach.md). Installation work can proceed independently of UI-07 and AUTH-02; settings integration must coordinate with UI-07. Existing DATA-02 retry/revision guarantees must survive these changes.

## Baseline before implementation

- `next.config.ts` already exports static files with trailing-slash routes.
- `src/app/layout.tsx` provides metadata and a safe-area-aware viewport; it has no manifest or PWA registration.
- `tracker-shell.tsx` already shares navigation across desktop and mobile.
- `tracker-provider.tsx` fetches account data at startup, keeps drafts/chat in memory, and uses operation IDs for uncertain saves. Failed startup currently needs better recovery.
- No `public/` directory, app icons, or service worker exists.
- `wrangler.jsonc` sends only `/api/*` through the Worker first. PWA files should remain static assets.
- The theme uses external Google Fonts; cold offline fallback must work with system fonts.

## Ordered implementation

### PWA-01 — Manifest, icons, standalone metadata

1. Add a static `src/app/manifest.webmanifest`: stable `id: "/"`, name Money Tracker, short name Money Tracker, `start_url: "/chat/"`, `scope: "/"`, and `display: "standalone"`.
2. Create regular 192/512 PNG icons, a separate maskable 512 icon with safe padding, an Apple touch icon, and favicon under `public/`. Reuse a suitable existing brand mark if available; otherwise create a simple ledger mark.
3. Link manifest/icons through the root metadata; add theme color and Apple web-app metadata. Resolve colors from the existing Matcha theme; manifest color values are serialized literals derived from that theme, not new theme overrides.
4. Verify output paths, MIME types, icon padding, and metadata in `out/` and through Wrangler.

Done when supported browsers recognize the manifest, installed launch reaches Chat or the existing sign-in gate, and all icon URLs load. Keep manifest identity stable across releases. Choose the lasting HTTPS origin before encouraging installation; installations and sessions are origin-specific.

### PWA-02 — Offline fallback and explicit cache policy

1. Add a self-contained `public/offline.html` with no external dependencies and an accessible Retry action. It explains that sign-in and ledger operations need a connection. It contains no user information.
2. Add `public/sw.js` and a small client registration component mounted from the root layout. Register at root scope in production builds; keep ordinary Next development free of service-worker caching. Test production export through Wrangler on localhost/HTTPS.
3. Start with a deliberately small service worker: precache only the generic offline document and essential branded fallback assets. Navigation requests use the network and receive the offline document on transport failure. Preserve real HTTP error responses.
4. Keep `/api/*` entirely network-only, including auth callbacks, session checks, AI, reports, transactions, and CSV. Never cache mutation responses, personalized data, Google profile images, cross-origin resources, or arbitrary query URLs. Do not turn API failures into HTML fallback responses.
5. Version app-owned caches; finish installation before activation and remove obsolete app-owned versions during activation. Never delete caches owned by unrelated applications.
6. Configure static-asset headers via `public/_headers`: revalidate `/sw.js` and the manifest, provide correct content types, and retain immutable caching only for hashed assets. Verify actual Cloudflare responses; do not add Next runtime headers or route all assets through the API Worker.

Done when an online visit installs the fallback, a later offline navigation/reload shows it, API traffic never enters Cache Storage, and restoring connectivity permits a normal retry. An initial visit without a connection cannot install anything. An already open app retains in-memory content; offline reload intentionally cannot recover private data or unsent drafts.

Optional later improvement: precache exported public route shells and their complete JS/CSS/RSC dependency graph using a build-generated allowlist. Adopt only after testing App Router navigation and cross-release asset consistency. It is not required for this release and must not accidentally cache private API responses.

### PWA-03 — Connection handling, install controls, and updates

1. Add a shared connectivity notice in `tracker-shell.tsx`. Browser online/offline events are hints; handle actual fetch failures independently, distinguish 401 from network failure, and avoid claiming that restored Wi-Fi proves API availability.
2. Add an explicit startup Retry path in `tracker-provider.tsx`. Revalidate the session before loading private data after reconnect. Keep current-session input in memory when requests fail; never show successful writes without server acknowledgment.
3. Audit Chat, manual entry, transaction edit/delete, reports, and CSV. Clearly block new online-only operations when known offline. Preserve pending/unknown outcomes and their original operation IDs. Reconnecting may retry safe reads; mutations require the existing explicit same-operation recovery flow, not automatic replay.
4. Add an install action in Settings using Astryx components. Feature-detect `beforeinstallprompt`; offer brief platform-appropriate browser-menu instructions when unavailable. Hide install promotion in standalone mode and respect dismissal. Installation UI must remain optional.
5. Detect a waiting service worker and offer an update. Do not force reload or activate an update while forms, drafts, parse requests, or uncertain writes are active. Require explicit acknowledgment before discarding any in-memory input; coordinate activation across tabs and reload once. Keep the old worker usable if a new installation fails.
6. Verify installed-app Google OAuth from sign-in through callback to Chat. Do not assume a standalone app shares a browser session or that the callback always returns to the same window. Check sign-out and expiry in both contexts.
7. Inspect installed mobile layouts: bottom navigation, safe areas, composer and virtual keyboard, dialogs, short screens, rotation, zoom, focus, and screen-reader connection/update announcements. Keep the existing Astryx frames; consult its layout docs before frame changes.

Done when supported installation paths work, failures retain current-tab input, updates never silently discard work, and signed-out/expired sessions never expose another account's information. An offline failed logout must not claim the server session was revoked.

### PWA-04 — Regression tests and deployment checks

Use the production export served by Wrangler, not `next dev` or `next start`.

- Automated: manifest/icon/output checks; actual service-worker installation; online visit then offline navigation; reconnect and retry; API requests absent from caches; no queued writes; startup failure versus 401; unknown-save retry retains its ID; two-version update with an active draft; failed worker installation leaves the previous worker intact.
- Re-run existing auth/ownership/revision tests and browser flows. Include account A sign-out then account B sign-in in the same installation; no stale private data may appear. Existing mocked UI tests alone do not prove real service-worker or OAuth behavior.
- Real devices: Android Chrome and iPhone Safari home-screen installation, standalone launch, Google OAuth, keyboard/safe areas, airplane mode, recovery, and update behavior. Desktop Chrome/Edge installation; Safari where available. Record browser/OS versions and unsupported affordances rather than assuming parity.
- Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run ui:check` (Astryx doctor), focused Playwright tests, and `npm run deploy:dry`.
- After an authorized deployment, verify HTTPS, manifest/icons/worker headers and scope, all static routes plus transaction query links, installed OAuth, account isolation/logout, offline fallback, and release N → N+1. Document rollback: deploy a corrected worker with a new cache version; reverting JS alone does not remove an installed worker.

Done when automated gates pass and real-device checks are recorded. Keep installation/OAuth/device checks pending if the required device or credentials are unavailable. Do not mark the PWA complete based only on a manifest or Lighthouse score.

## Suggested delivery sequence

Deliver PWA-01 first, then PWA-02, then PWA-03, and finish PWA-04 before promoting installation to users. PWA-01/02 do not require finishing the broader backend backlog. Durable offline writes would require a separate account-scoped storage, retention, conflict, idempotency, and recovery design, coordinated with DATA-02, CHAT-01/02, AUTH-02, and PRIV-01.

## References

- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — manifest and client service-worker foundations. Its Server Action push examples do not apply to this static-export architecture.
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports) — preserve static hosting constraints.
- [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — browser installation behavior varies; offline support is a separate capability.
- Installed Next.js 16.4.6 docs reviewed: PWA guide, manifest convention, and offline-support guide. The experimental Next offline hook does not replace handling this application's ordinary Worker fetches or a service worker for offline reloads.

## PWA-01/02 implementation record

The static manifest, icons, standalone metadata, root client registration, `public/sw.js`, `public/offline.html`, and static `_headers` are implemented. Colors come from Matcha light `--color-background-body` and `--color-accent`. The SVG master remains in `public/icons/ledger.svg`. The dependency-free fallback deliberately uses semantic browser-native HTML so it remains usable without the React runtime, Astryx CSS, fonts, or images. No application page frame changed.

Cloudflare force-trailing-slash routing makes the canonical fallback URL `/offline/`. Cache that URL directly: caching the redirected `/offline` response broke offline navigation in Chromium. Only `/offline/` is stored in the app-owned cache. Increment its version when changing the document. Updates use the browser's waiting lifecycle with no forced activation/reload; explicit update controls belong to PWA-03.

Verification: five Node test files passed, including service-worker scope/exclusions, HTTP error preservation, failed installation, and cache cleanup tests. Twelve Chromium checks passed across 1440, 390, and 320 widths for production service-worker installation, manifest/headers/icons, offline navigation, cache exclusion, online retry, route navigation, and sign-out. Icon and mobile fallback screenshot inspected. Lint, types, production build, Astryx doctor, and deployment dry run passed, with pre-existing lint/font warnings. The sandbox prevented Next TypeScript subprocess/local-server execution; production build and browser/server checks succeeded outside it. Real Android/iOS installation, installed OAuth, deployed headers, and multi-release device verification remain PWA-04.
