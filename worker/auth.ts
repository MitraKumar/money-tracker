import { betterAuth } from "better-auth";
import { authOptions } from "./auth-options";

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export function authConfigured(env: AuthEnv) {
  return !!(env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32 && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.BETTER_AUTH_URL);
}

export function createAuth(env: AuthEnv) {
  if (!authConfigured(env)) throw new Error("Authentication is not configured");
  const baseURL = new URL(env.BETTER_AUTH_URL).origin;
  return betterAuth({
    ...authOptions,
    database: env.DB,
    baseURL,
    trustedOrigins: [baseURL],
    secret: env.BETTER_AUTH_SECRET,
    onAPIError: { errorURL: `${baseURL}/login/` },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        prompt: "select_account",
      },
    },
  });
}
