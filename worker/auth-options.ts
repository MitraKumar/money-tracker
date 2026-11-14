import type { BetterAuthOptions } from "better-auth";

// Shared by runtime and schema generation. No password/anonymous login providers.
export const authOptions = {
  appName: "Money Tracker",
  basePath: "/api/auth",
  emailAndPassword: { enabled: false },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  advanced: { cookiePrefix: "money-tracker", ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
} satisfies BetterAuthOptions;
