// FLT-67 accounts, kept apart from the stack so the flag's logic is testable without Alchemy (infra/auth.test.ts).

/** The hosts prod answers on: the game's domain, and the workers.dev fallback. Both are registered with the HF app. */
export const AUTH_HOSTS = ["app.frontierlabtycoon.com", "flt-prod.manzanita.workers.dev"] as const;

/** Secrets the prod Worker gets when accounts are on. GitHub Actions passes them in by name; nothing else sees them. */
export const AUTH_SECRETS = ["BETTER_AUTH_SECRET", "HF_CLIENT_ID", "HF_CLIENT_SECRET"] as const;

/** Only prod, and only with the repo variable `FLT_AUTH=on`. PR previews never get auth: their hosts are random. */
export const authEnabled = (stage: string, flag: string | undefined) => stage === "prod" && flag?.trim() === "on";

/** The Worker in front of the assets, and the paths it runs for. Everything else is served straight from `dist/`. */
export const AUTH_WORKER_MAIN = new URL("../worker/index.ts", import.meta.url);
export const AUTH_WORKER_PATHS = ["/api/*"];
export const AUTH_MIGRATIONS = new URL("../worker/migrations/", import.meta.url);
