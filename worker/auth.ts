import { betterAuth, type BetterAuthOptions } from "better-auth";
import { placeholderEmail } from "../src/account/contract";
import type { Env } from "./env";

/** The Hugging Face profile fields we read. The `email` claims are never requested and never stored. */
interface HuggingFaceProfile {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
}

/**
 * Better Auth for FLT-67: Hugging Face only, `openid profile` only, a cookie session on the game's own origin.
 *
 * Adding GitHub later is one entry in `socialProviders` (with `scope: ["read:user"]` and the same placeholder email)
 * plus its two secrets; see docs/ACCOUNTS.md.
 */
export function authOptions(env: Env, database: BetterAuthOptions["database"] = env.DB): BetterAuthOptions {
  const hosts = env.AUTH_HOSTS.split(",").map((h) => h.trim()).filter(Boolean);
  const protocol = env.AUTH_PROTOCOL === "http" ? "http" : "https";
  return {
    appName: "Frontier Lab Tycoon",
    secret: env.BETTER_AUTH_SECRET,
    // Two hosts serve prod (the custom domain and the workers.dev fallback); the callback goes back to whichever one
    // the player started on, and anything else is refused.
    baseURL: { allowedHosts: hosts, protocol },
    trustedOrigins: hosts.map((h) => `${protocol}://${h}`),
    database,
    socialProviders: {
      huggingface: {
        clientId: env.HF_CLIENT_ID,
        clientSecret: env.HF_CLIENT_SECRET,
        disableDefaultScope: true,
        scope: ["openid", "profile"],
        mapProfileToUser: (profile: HuggingFaceProfile) => ({
          email: placeholderEmail("huggingface", profile.sub),
          emailVerified: false,
          name: profile.name || profile.preferred_username || "Founder",
          image: profile.picture,
          handle: profile.preferred_username ?? null,
        }),
      },
    },
    user: {
      additionalFields: {
        // The Hugging Face username, for "Founded by @you" (FLT-67 §6); never an email. Set from the profile at each
        // sign-in; players can't edit it (or anything else) because /update-user is off below.
        handle: { type: "string", required: false },
      },
      deleteUser: {
        enabled: true,
        // Saves go with the account, at once: the R2 blobs here, the D1 rows through the foreign key's cascade.
        beforeDelete: async (user) => {
          const listed = await env.SAVES.list({ prefix: `saves/${user.id}/` });
          if (listed.objects.length > 0) await env.SAVES.delete(listed.objects.map((o) => o.key));
        },
      },
    },
    account: {
      // The HF access token is only used once, to read the profile at sign-in; nothing calls HF on the player's behalf,
      // so the hooks below drop it (encrypted too, in case a hook is ever bypassed).
      storeAccountCookie: false,
      encryptOAuthTokens: true,
    },
    // What the privacy line promises: an id, a name, an avatar, a username and saves. Sessions keep no IP address or
    // browser string, and the account row keeps no Hugging Face tokens.
    databaseHooks: {
      session: { create: { before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }) } },
      account: {
        create: { before: async (account) => ({ data: { ...account, ...NO_TOKENS } }) },
        update: { before: async (account) => ({ data: { ...account, ...NO_TOKENS } }) },
      },
    },
    advanced: {
      useSecureCookies: protocol === "https",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, secure: protocol === "https" },
    },
    // A profile is what Hugging Face says it is: no editing, no second provider linked by hand, no email flows.
    disabledPaths: ["/update-user", "/change-email", "/link-social", "/unlink-account"],
    telemetry: { enabled: false },
  };
}

const NO_TOKENS = { accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null };

export const makeAuth = (env: Env) => betterAuth(authOptions(env));
export type Auth = ReturnType<typeof makeAuth>;
