declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void;
  }
}

let sentryPromise: Promise<typeof import("@sentry/react") | null> | null = null;

const SHARE_PAYLOAD_PATTERN = /#(c|share)=[A-Za-z0-9_-]+/g;

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
  return params.has("c") || params.has("share");
}

export function initTelemetry(): void {
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
    document.head.appendChild(script);
  }
}

export function trackEvent(eventName: string, props?: Record<string, unknown>): void {
  window.plausible?.(eventName, props ? { props } : undefined);
}

export function reportRuntimeError(error: unknown): void {
  void loadSentry().then((sentry) => {
    sentry?.captureException(error);
  });
}

function loadSentry(): Promise<typeof import("@sentry/react") | null> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (!sentryDsn) {
    return Promise.resolve(null);
  }

  sentryPromise ??= import("@sentry/react").then((sentry) => {
    sentry.init({
      dsn: sentryDsn,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend: sanitizeTelemetryEvent,
      beforeSendTransaction: sanitizeTelemetryEvent
    });
    return sentry;
  });

  return sentryPromise;
}
