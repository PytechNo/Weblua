/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_UMAMI_SCRIPT_URL?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  readonly VITE_ANALYTICS_DOMAINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "luau-web/src/lib/Luau.Web.Asyncify.js" {
  const createModule: (
    moduleArg?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;

  export default createModule;
}
