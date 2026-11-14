// Schema-generation only; this module is never imported by the Worker.
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { authOptions } from "../worker/auth-options";

export const auth = betterAuth({
  ...authOptions,
  database: new DatabaseSync(":memory:"),
  baseURL: "http://localhost:8787",
  secret: "schema-generation-only-not-a-runtime-secret",
});
