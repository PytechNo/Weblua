import { describe, expect, it } from "vitest";
import { hasSourceBearingHash, sanitizeTelemetryEvent } from "./telemetry";

describe("telemetry privacy", () => {
  it("removes source-bearing share fragments from telemetry fields", () => {
    const event = sanitizeTelemetryEvent({
      message: "failed at #c=2SecretSource",
      request: { url: "https://weblua.com/playground#c=2SecretSource" },
      exception: { values: [{ value: "opened #share=LegacySource" }] },
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
    expect(event.breadcrumbs[0].message).toBe("navigate to #c=[redacted]");
    expect(event.breadcrumbs[0].data.from).toBe("https://weblua.com/");
  });

  it("recognizes current and legacy source-bearing hashes", () => {
    expect(hasSourceBearingHash("#c=2SourcePayload")).toBe(true);
    expect(hasSourceBearingHash("#share=LegacyPayload")).toBe(true);
    expect(hasSourceBearingHash("#section=features")).toBe(false);
    expect(hasSourceBearingHash("")).toBe(false);
  });
});
