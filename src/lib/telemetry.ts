declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void;
  }
}

let sentryPromise: Promise<typeof import("@sentry/react") | null> | null = null;

export function initTelemetry(): void {
  void loadSentry();

  const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
  if (plausibleDomain && !document.querySelector("script[data-domain]")) {
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
      tracesSampleRate: 0.1
    });
    return sentry;
  });

  return sentryPromise;
}
