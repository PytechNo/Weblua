import { afterEach, describe, expect, it, vi } from "vitest";
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
