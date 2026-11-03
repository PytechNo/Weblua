import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasSourceBearingHash, initTelemetry, sanitizeTelemetryEvent } from "./telemetry";

describe("telemetry privacy", () => {
  it("removes source-bearing share fragments from telemetry fields", () => {
    const event = sanitizeTelemetryEvent({
      message: "failed at #c=2SecretSource",
      request: { url: "https://weblua.com/playground#c=2SecretSource" },
      exception: { values: [{ value: "opened #share=LegacySource" }, { value: "loading #gist=aa5a315d61ae9438b18d" }] },
      breadcrumbs: [
        {
          message: "navigate to #c=2SecretSource",
          data: { from: "https://weblua.com/#c=2SecretSource" }
        }
      ]
    });

    expect(event.message).toBe("failed at #c=[redacted]");
    expect(event.request.url).toBe("https://weblua.com/playground");
    expect(event.exception.values[0].value).toBe("opened #share=[redacted]");
    expect(event.exception.values[1].value).toBe("loading #gist=[redacted]");
    expect(event.breadcrumbs[0].message).toBe("navigate to #c=[redacted]");
    expect(event.breadcrumbs[0].data.from).toBe("https://weblua.com/");
  });

  it("recognizes current and legacy source-bearing hashes", () => {
    expect(hasSourceBearingHash("#c=2SourcePayload")).toBe(true);
    expect(hasSourceBearingHash("#share=LegacyPayload")).toBe(true);
    expect(hasSourceBearingHash("#gist=aa5a315d61ae9438b18d")).toBe(true);
    expect(hasSourceBearingHash("#section=features")).toBe(false);
    expect(hasSourceBearingHash("")).toBe(false);
  });

  describe("Umami", () => {
    beforeEach(() => {
      vi.stubEnv("PROD", true);
      vi.stubEnv("VITE_ANALYTICS_DOMAINS", "");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      document.head.querySelector("script[data-website-id]")?.remove();
      window.location.hash = "";
    });

    it("loads with URL fragments excluded", () => {
      vi.stubEnv("VITE_UMAMI_SCRIPT_URL", "https://umami.example.com/script.js");
      vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "site-id");
      initTelemetry();

      const script = document.head.querySelector<HTMLScriptElement>("script[data-website-id]");
      expect(script?.src).toBe("https://umami.example.com/script.js");
      expect(script?.dataset.websiteId).toBe("site-id");
      expect(script?.dataset.excludeHash).toBe("true");
    });

    it("still loads, with fragments excluded, on a source-bearing URL", () => {
      vi.stubEnv("VITE_UMAMI_SCRIPT_URL", "https://umami.example.com/script.js");
      vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "site-id");
      window.location.hash = "#c=2SourcePayload";
      initTelemetry();

      const script = document.head.querySelector<HTMLScriptElement>("script[data-website-id]");
      expect(script?.dataset.excludeHash).toBe("true");
    });
  });
});

describe("analytics delivery and controls", () => {
  let telemetry: typeof import("./telemetry");
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_UMAMI_SCRIPT_URL", "https://stats.example.com/script.js");
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "site-id");
    vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "");
    vi.stubEnv("VITE_SENTRY_DSN", "");
    vi.stubEnv("VITE_ANALYTICS_DOMAINS", "");
    localStorage.clear();
    window.history.replaceState(null, "", "/playground");
    delete window.umami;
    delete window.plausible;
    telemetry = await import("./telemetry");
  });
  afterEach(() => {
    document.querySelectorAll("script[data-website-id], script[data-domain]").forEach((script) => script.remove());
    delete window.umami;
    delete window.plausible;
    delete window.webluaBeforeSend;
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  function loaded() {
    document.querySelector("script[data-website-id]")!.dispatchEvent(new Event("load"));
    window.dispatchEvent(new Event("load"));
  }

  it("buffers early actions until the page and tracker are ready, preserving order exactly once", () => {
    telemetry.initTelemetry();
    telemetry.initTelemetry();
    telemetry.trackEvent("run_start", { flavor: "lua54" });
    const track = vi.fn();
    window.umami = { track };
    telemetry.trackEvent("run", { status: "ok" });
    expect(track).not.toHaveBeenCalled();
    loaded();
    telemetry.trackEvent("copy_output");
    expect(track.mock.calls.map(([name]) => name)).toEqual(["run_start", "run", "copy_output"]);
    expect(document.querySelectorAll("script[data-website-id]")).toHaveLength(1);
  });

  it("bounds the startup queue when a tracker is blocked", () => {
    telemetry.initTelemetry();
    for (let i = 0; i < 150; i++) telemetry.trackEvent("run", { attempts: i });
    window.umami = { track: vi.fn() };
    loaded();
    expect(window.umami.track).toHaveBeenCalledTimes(100);
  });

  it("drops queued actions after opting out, including when storage is blocked", () => {
    telemetry.initTelemetry();
    telemetry.trackEvent("run");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    telemetry.setTelemetryDisabled(true);
    window.umami = { track: vi.fn() };
    loaded();
    telemetry.trackEvent("run");
    expect(window.umami.track).not.toHaveBeenCalled();
    expect(window.webluaBeforeSend!("event", { name: "run" })).toBeNull();
  });

  it.each(["development", "gpc", "dnt", "operator", "domain"])("loads and sends nothing for %s", (reason) => {
    if (reason === "development") vi.stubEnv("PROD", false);
    if (reason === "gpc") vi.stubGlobal("navigator", { globalPrivacyControl: true });
    if (reason === "dnt") vi.stubGlobal("navigator", { doNotTrack: "1" });
    if (reason === "operator") localStorage.setItem("umami.disabled", "1");
    if (reason === "domain") vi.stubEnv("VITE_ANALYTICS_DOMAINS", "weblua.com");
    telemetry.initTelemetry();
    window.umami = { track: vi.fn() };
    telemetry.trackEvent("run");
    expect(document.querySelector("script[data-website-id]")).toBeNull();
    expect(window.umami.track).not.toHaveBeenCalled();
  });

  it("supports a persistent operator opt-out and explicit re-enable through the URL", () => {
    window.history.replaceState(null, "", "/?analytics=off");
    telemetry.initTelemetry();
    expect(localStorage.getItem("umami.disabled")).toBe("1");
    expect(document.querySelector("script[data-website-id]")).toBeNull();
    window.history.replaceState(null, "", "/?analytics=on");
    telemetry.initTelemetry();
    expect(localStorage.getItem("umami.disabled")).toBeNull();
    expect(document.querySelector("script[data-website-id]")).not.toBeNull();
  });

  it("enables performance, strips source and private URL data, and keeps campaign attribution", () => {
    telemetry.initTelemetry();
    expect(document.querySelector<HTMLScriptElement>("script[data-website-id]")!.dataset.performance).toBe("true");
    const payload = window.webluaBeforeSend!("event", {
      url: "https://weblua.com/playground?code=private&token=secret&utm_source=test#c=source",
      referrer: "https://other.example/private?token=secret#source",
      title: "My private project",
      id: "private-visitor"
    });
    expect(payload).toMatchObject({
      url: "https://weblua.com/playground?utm_source=test", referrer: "https://other.example", title: "Weblua /playground"
    });
    expect(JSON.stringify(payload)).not.toMatch(/private|secret|#c=/);
    expect(window.webluaBeforeSend!("event", { url: "https://weblua.com/playground?utm_source=test#c=different" })).toBeNull();
    expect(window.webluaBeforeSend!("performance", { url: "/playground", lcp: 123 })).toMatchObject({ lcp: 123 });
    expect(window.webluaBeforeSend!("performance", { url: "/playground" })).toBeNull();
    // A tool switch is a new page view, so it gets its own speed report.
    expect(window.webluaBeforeSend!("performance", { url: "/", inp: 40 })).toMatchObject({ inp: 40 });
    expect(window.webluaBeforeSend!("identify", {})).toBeNull();
    expect(window.webluaBeforeSend!("event", { name: "run", referrer: location.origin + "/?token=secret" })!.referrer).toBe("");
  });

  it("keeps only fixed metadata, adds embed context and preserves the content of queued events", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue(location.origin + "/learn-luau/tables?token=secret");
    window.history.replaceState(null, "", "/embed#c=private");
    telemetry.initTelemetry();
    telemetry.setTelemetryContent({ example: "learn-luau/tables/exercise" });
    telemetry.trackEvent("run", { flavor: "luau", source: "private", output: "private", status: "ok" });
    telemetry.setTelemetryContent({});
    window.umami = { track: vi.fn() };
    loaded();
    expect(window.umami.track).toHaveBeenCalledWith("run", {
      page: "/embed", surface: "site-embed", parentPage: "/learn-luau/tables",
      example: "learn-luau/tables/exercise", flavor: "luau", status: "ok"
    });
  });

  it("counts a same-site embedded editor's events but no page view or speed of its own", () => {
    const referrer = vi.spyOn(document, "referrer", "get").mockReturnValue(location.origin + "/learn-luau/tables");
    window.history.replaceState(null, "", "/embed");
    telemetry.initTelemetry();
    expect(window.webluaBeforeSend!("event", { url: location.href })).toBeNull();
    expect(window.webluaBeforeSend!("performance", { url: location.href })).toBeNull();
    expect(window.webluaBeforeSend!("event", { url: location.href, name: "run" })).not.toBeNull();
    referrer.mockReturnValue("https://blog.example/post");
    expect(window.webluaBeforeSend!("event", { url: location.href })).toMatchObject({ url: `${location.origin}/embed` });
  });

  it("keeps campaign tags without URLSearchParams.size (Safari before 17)", () => {
    telemetry.initTelemetry();
    vi.spyOn(URLSearchParams.prototype, "size", "get").mockReturnValue(undefined as unknown as number);
    expect(window.webluaBeforeSend!("event", { url: "https://weblua.com/?utm_source=test" })!.url).toBe("https://weblua.com/?utm_source=test");
  });

  it("queues each provider independently and contains provider errors", () => {
    vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "weblua.com");
    telemetry.initTelemetry();
    telemetry.trackEvent("run");
    window.umami = { track: vi.fn(() => { throw new Error("tracker failed"); }) };
    window.plausible = vi.fn();
    expect(loaded).not.toThrow();
    document.querySelector("script[data-domain]")!.dispatchEvent(new Event("load"));
    expect(window.plausible).toHaveBeenCalledTimes(1);
    expect(() => telemetry.trackEvent("copy_share")).not.toThrow();
    expect(window.plausible).toHaveBeenCalledTimes(2);
  });

  it("does not attach a later example to an earlier queued action and classifies legacy root share links as editor use", () => {
    window.history.replaceState(null, "", "/#share=private");
    telemetry.initTelemetry();
    telemetry.trackEvent("run", { flavor: "lua54" });
    telemetry.setTelemetryContent({ example: "hello" });
    window.umami = { track: vi.fn() };
    loaded();
    const data = vi.mocked(window.umami.track).mock.calls[0][1];
    expect(data).toMatchObject({ page: "/", surface: "playground" });
    expect(window.webluaBeforeSend!("event", { name: "run", data: data as Record<string, string> })!.data).not.toHaveProperty("example");
    expect(telemetry.analyticsPath("/embed/")).toBe("/embed");
  });
});
