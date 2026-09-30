/** The Worker's bindings (FLT-67). Alchemy binds them in `infra/alchemy.run.ts`, and only when `FLT_AUTH=on`. */
export interface Env {
  /** The game's built `dist/`. Everything that isn't `/api/*` goes here. */
  ASSETS: Fetcher;
  /** Better Auth's tables plus `saves` (metadata). Schema: `worker/migrations/`. */
  DB: D1Database;
  /** Save blobs, at `saves/<userId>/<slot>.fltsave`. */
  SAVES: R2Bucket;
  /** Comma-separated hosts that may sign in (the custom domain and the workers.dev fallback). */
  AUTH_HOSTS: string;
  /** `https` in prod; the tests use `http`. */
  AUTH_PROTOCOL?: string;
  BETTER_AUTH_SECRET: string;
  HF_CLIENT_ID: string;
  HF_CLIENT_SECRET: string;
}
