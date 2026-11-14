# Google authentication setup

The application now supports Google login through Better Auth on the Worker, backed by D1. A single Google account owns its ledger across devices; sessions no longer own or expire financial records. The user has deployed this version and configured the three Worker secrets. Live checks confirm D1 health, blocked anonymous access, and Google authorization initiation with the expected callback and state cookie. A real Google consent/token exchange still needs to be completed and checked.

## 1. Create the Google OAuth web client

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials): choose/create a project, configure Google Auth Platform branding/audience, and create an OAuth client of type **Web application**. While the consent screen is in Testing, add the Google accounts that should be able to sign in as test users. Only basic profile/email identity is required; this app does not request Gmail, Drive, or bank access.

Authorized JavaScript origins:

- `https://money-tracker-poc.kaushik0976.workers.dev`
- `http://localhost:8787` for local testing, if using the same development client

Authorized redirect URIs (exactly):

- `https://money-tracker-poc.kaushik0976.workers.dev/api/auth/callback/google`
- `http://localhost:8787/api/auth/callback/google` for local testing

Separate production and development clients are preferable when maintaining the app beyond the pilot. The frontend static dev server on port 3000 is not the OAuth callback server; use the full app through Wrangler on port 8787.

See [Better Auth's Google provider instructions](https://better-auth.com/docs/authentication/google).

## 2. Configure Worker secrets

From this repository, run these commands in your terminal and paste values at the hidden prompts:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
```

For `BETTER_AUTH_SECRET`, generate a unique high-entropy value using `openssl rand -base64 32`, store it securely, and paste it into the Wrangler prompt. Do not put secrets in chat, shell command arguments, Git, screenshots, or frontend variables. Keep the auth secret stable: it signs sessions and encrypts stored OAuth tokens. Do not overwrite an existing auth secret just to redeploy.

`BETTER_AUTH_URL` is already set to the production origin in `wrangler.jsonc`. The app reports `configured: false` from `GET /api/session` and rejects login/private data requests if required credentials are missing. There is no browser-session or password fallback.

For local development, copy `.dev.vars.example` to ignored `.dev.vars`, set the URL to `http://localhost:8787`, and fill in local OAuth credentials and a distinct local auth secret. Keep `AI_ENABLED=false` when testing the manual ledger.

## 3. Migrate and deploy

Migrations are additive and reviewed separately from the old anonymous demo schema:

- `0002_google_auth.sql`: generated using the pinned Better Auth CLI and shared auth options in `scripts/auth-schema.ts` / `worker/auth-options.ts`. Creates user, account, session, verification, and persistent auth rate-limit tables.
- `0003_account_ledgers.sql`: account-owned parses and transactions, with same-owner draft references and idempotency constraints.

```sh
npm run db:local
npm test
npm run lint
npm run typecheck
npm run build
npm run ui:check
npm run deploy:dry
# After OAuth secrets and callback URLs are ready:
npm run db:remote
npm run deploy
```

The old `mt_poc` cookie and anonymous session creation endpoint are not accepted by the new app. Previous anonymous test records are left in their existing tables for their original expiry cleanup; they are not automatically assigned to any Google account. No destructive migration or anonymous-to-account claim endpoint is included.

Auth sessions last seven days with renewal for active sessions. Signing out revokes the current session; another device's session can remain active. Saved account records are not deleted by session expiry or by the legacy cleanup job. Account deletion and exports remain separate backlog items.

## 4. Verify real Google login before marking AUTH-01 complete

1. Open the deployed `/login/` route and select Continue with Google.
2. Complete Google's account selection/consent, then verify the callback returns to `/chat/`.
3. Save a synthetic entry, sign in to the same Google account in a second browser, and verify the same record appears.
4. Sign in to a different Google account and verify that it sees no other user's records.
5. Sign out and verify direct private API requests are rejected and the UI hides account data. Signing in again should recover the saved ledger.
6. Check Worker CPU/session overhead against the current Cloudflare plan before promising free-tier capacity.

`npm test` exercises the actual Better Auth signed-session verification with local SQLite-backed D1 behavior: same-user multi-session access, different-user isolation, expiry/tampering, logout, OAuth state creation, unsafe callback rejection, and missing-credential behavior. It does not impersonate a successful Google token exchange. Browser tests use mocked authenticated API fixtures for UI behavior and cover signed-out, sign-out, and incomplete-config states. No production test-login bypass exists.

`node scripts/smoke.mjs <base-url>` checks signed-out API protection and static routes without creating users or invoking AI. For a full local runtime check, build and start Wrangler first.
