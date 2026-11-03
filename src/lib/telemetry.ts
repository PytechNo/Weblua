import { getAppRoute, TOOL_PATHS } from "./routes";

type EventData = Record<string, string | number | boolean>;
type AnalyticsPayload = Record<string, unknown> & { url?: string; referrer?: string; name?: string; data?: EventData };

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void;
    umami?: { track: (eventName: string, data?: Record<string, unknown>) => void };
    webluaBeforeSend?: (type: string, payload: AnalyticsPayload) => AnalyticsPayload | null;
  }
}

let sentryPromise: Promise<typeof import("@sentry/react") | null> | null = null;
const waiting: Record<"umami" | "plausible", Array<[string, EventData]>> = { umami: [], plausible: [] };
const MAX_WAITING = 100;
let disabledInMemory = false;
let umamiReady = false;
const DATA_KEYS = new Set("flavor status timeoutMs compare problems types typeChecked surface page parentPage example lesson block trigger place part question tab to tool direction preset action reason method files attempts result how".split(" "));

/** Opt out on this origin, including embeds. Reload to unload already loaded integrations. */
export function setTelemetryDisabled(disabled: boolean): void {
  disabledInMemory = disabled;
  try {
    if (disabled) localStorage.setItem("umami.disabled", "1");
    else localStorage.removeItem("umami.disabled");
  } catch { /* A privacy preference must never interrupt the editor. */ }
  waiting.umami.length = waiting.plausible.length = 0;
}

export function telemetryDisabled(): boolean {
  if (!import.meta.env.PROD || disabledInMemory) return true;
  const domains = import.meta.env.VITE_ANALYTICS_DOMAINS?.split(",").map((domain) => domain.trim()).filter(Boolean);
  if (domains?.length && !domains.includes(location.hostname)) return true;
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
      navigator.doNotTrack === "1" || (window as Window & { doNotTrack?: string }).doNotTrack === "1") return true;
  try { return !!localStorage.getItem("umami.disabled"); } catch { return false; }
}

export function analyticsEnabled(): boolean {
  return !telemetryDisabled() && !!(import.meta.env.VITE_PLAUSIBLE_DOMAIN ||
    (import.meta.env.VITE_UMAMI_SCRIPT_URL && import.meta.env.VITE_UMAMI_WEBSITE_ID));
}

/** This app has no user-named routes. Unknown paths are grouped rather than exported. */
export function analyticsPath(pathname: string): string {
  pathname = pathname.replace(/\/+$/, "") || "/";
  if (["/", "/playground", "/embed", "/examples", "/learn-luau", ...Object.values(TOOL_PATHS).map((path) => `/${path}`)].includes(pathname)) return pathname;
  if (/^\/(examples|learn-luau)\/[a-z0-9-]{1,80}\/?$/.test(pathname)) return pathname.replace(/\/$/, "");
  return "/other";
}

function eventData(data: Record<string, unknown> = {}): EventData {
  return Object.fromEntries(Object.entries(data).filter(([key, value]) => DATA_KEYS.has(key) &&
    ((typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean" ||
      (typeof value === "string" && value.length <= 100 && /^[a-zA-Z0-9_./:-]+$/.test(value))))) as EventData;
}

let contentContext: EventData = {};
export function setTelemetryContent(context: EventData): void { contentContext = eventData(context); }

function context(): EventData {
  const page = analyticsPath(location.pathname);
  const route = getAppRoute();
  let parentPage: string | undefined;
  let surface: string = route.mode === "embed" ? "external-embed" : route.mode;
  try {
    const parent = new URL(document.referrer);
    if (page === "/embed" && parent.origin === location.origin) {
      surface = "site-embed";
      parentPage = analyticsPath(parent.pathname);
    }
  } catch { /* No referrer. */ }
  return { page, surface, ...(route.mode === "playground" && route.tool ? { tool: route.tool } : {}),
    ...(parentPage ? { parentPage } : {}), ...contentContext };
}

function send(provider: "umami" | "plausible", name: string, data: EventData): void {
  try {
    if (provider === "umami") window.umami?.track(name, data);
    else window.plausible?.(name, { props: data });
  } catch { /* Analytics must never fail a product action. */ }
}

function flush(provider: "umami" | "plausible"): void {
  if (telemetryDisabled()) { waiting[provider].length = 0; return; }
  if (!window[provider]) return;
  waiting[provider].splice(0).forEach(([name, data]) => send(provider, name, data));
}

// A gist ID is not source, but it is the only key to a secret gist.
const SHARE_PAYLOAD_PATTERN = /#(c|share|gist)=[A-Za-z0-9_-]+/g;

function redactSharePayload(value: string): string {
  return value.replace(SHARE_PAYLOAD_PATTERN, "#$1=[redacted]");
}

function stripUrlFragment(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    url.hash = "";
    return url.toString();
  } catch {
    return redactSharePayload(value);
  }
}

/** Prevent source-bearing share fragments from leaving the browser in error telemetry. */
export function sanitizeTelemetryEvent<T>(event: T): T {
  const candidate = event as {
    message?: string;
    transaction?: string;
    request?: { url?: string };
    exception?: { values?: Array<{ value?: string }> };
    breadcrumbs?: Array<{
      message?: string;
      data?: Record<string, unknown>;
    }>;
  };

  if (candidate.message) candidate.message = redactSharePayload(candidate.message);
  if (candidate.transaction) candidate.transaction = redactSharePayload(candidate.transaction);
  if (candidate.request?.url) candidate.request.url = stripUrlFragment(candidate.request.url);

  for (const exception of candidate.exception?.values ?? []) {
    if (exception.value) exception.value = redactSharePayload(exception.value);
  }

  for (const breadcrumb of candidate.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = redactSharePayload(breadcrumb.message);
    for (const key of ["url", "from", "to"]) {
      const value = breadcrumb.data?.[key];
      if (typeof value === "string") breadcrumb.data![key] = stripUrlFragment(value);
    }
  }

  return event;
}

export function hasSourceBearingHash(hash = window.location.hash): boolean {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.has("c") || params.has("share") || params.has("gist");
}

export function initTelemetry(): void {
  const preference = new URLSearchParams(location.search).get("analytics");
  if (preference === "off" || preference === "on") setTelemetryDisabled(preference === "off");
  if (telemetryDisabled()) return;
  void loadSentry();

  const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
  if (
    plausibleDomain &&
    !hasSourceBearingHash() &&
    !document.querySelector("script[data-domain]")
  ) {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = plausibleDomain;
    script.src = "https://plausible.io/js/script.js";
    script.addEventListener("load", () => flush("plausible"), { once: true });
    script.addEventListener("error", () => { waiting.plausible.length = 0; }, { once: true });
    document.head.appendChild(script);
  }

  const umamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
  const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (umamiScriptUrl && umamiWebsiteId && !document.querySelector("script[data-website-id]")) {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.websiteId = umamiWebsiteId;
    // Umami reports the full URL by default, and share links put source in the fragment.
    script.dataset.excludeHash = "true";
    script.dataset.performance = "true";
    script.dataset.doNotTrack = "true";
    script.dataset.beforeSend = "webluaBeforeSend";
    if (import.meta.env.VITE_ANALYTICS_DOMAINS) script.dataset.domains = import.meta.env.VITE_ANALYTICS_DOMAINS;
    let counted: string | undefined;
    let timed = false;
    window.webluaBeforeSend = (type, original) => {
      if (telemetryDisabled() || type === "identify") return null;
      const payload = { ...original };
      if (payload.url) {
        const url = new URL(payload.url, location.href);
        const query = new URLSearchParams([...url.searchParams].filter(([key]) => /^utm_(source|medium|campaign|term|content)$/.test(key)));
        payload.url = url.origin + analyticsPath(url.pathname) + (query.size ? `?${query}` : "");
      }
      // Titles and referrers must not contain a project name, query or source fragment.
      payload.title = `Weblua ${analyticsPath(location.pathname)}`;
      try {
        const from = new URL(payload.referrer ?? "");
        payload.referrer = from.origin === location.origin ? "" : from.origin;
      } catch { payload.referrer = ""; }
      if (type === "performance") {
        if (timed) return null;
        timed = true;
      } else if (!payload.name) {
        if (payload.url === counted) return null;
        counted = payload.url;
      } else payload.data = eventData(payload.data);
      return payload;
    };
    script.addEventListener("load", () => {
      const start = () => { umamiReady = true; flush("umami"); };
      if (document.readyState === "complete") start();
      else window.addEventListener("load", start, { once: true });
    }, { once: true });
    script.addEventListener("error", () => { waiting.umami.length = 0; }, { once: true });
    script.src = umamiScriptUrl;
    document.head.appendChild(script);
  }
}

export function trackEvent(eventName: string, props?: Record<string, unknown>): void {
  if (!analyticsEnabled()) return;
  const data = eventData({ ...context(), ...props });
  const providers = {
    umami: !!(import.meta.env.VITE_UMAMI_SCRIPT_URL && import.meta.env.VITE_UMAMI_WEBSITE_ID),
    plausible: !!import.meta.env.VITE_PLAUSIBLE_DOMAIN && !hasSourceBearingHash()
  };
  for (const provider of ["umami", "plausible"] as const) {
    if (!providers[provider]) continue;
    if (window[provider] && (provider !== "umami" || umamiReady || !document.querySelector("script[data-website-id]"))) {
      flush(provider); send(provider, eventName, data);
    }
    else if (waiting[provider].length < MAX_WAITING) waiting[provider].push([eventName, data]);
  }
}

export function reportRuntimeError(error: unknown): void {
  void loadSentry().then((sentry) => {
    if (!telemetryDisabled()) sentry?.captureException(error);
  });
}

function loadSentry(): Promise<typeof import("@sentry/react") | null> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (!sentryDsn || telemetryDisabled()) {
    return Promise.resolve(null);
  }

  sentryPromise ??= import("@sentry/react").then((sentry) => {
    if (telemetryDisabled()) return null;
    sentry.init({
      dsn: sentryDsn,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend: (event) => telemetryDisabled() ? null : sanitizeTelemetryEvent(event),
      beforeSendTransaction: (event) => telemetryDisabled() ? null : sanitizeTelemetryEvent(event)
    });
    return sentry;
  }).catch(() => null);

  return sentryPromise;
}
