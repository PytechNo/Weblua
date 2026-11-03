import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observePageTelemetry } from "./pageTelemetry";

describe("page interaction telemetry", () => {
  let stop: () => void;
  const observed: Element[] = [];
  let intersect: IntersectionObserverCallback;
  beforeEach(() => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_UMAMI_SCRIPT_URL", "https://stats.example.com/script.js");
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "site-id");
    vi.stubEnv("VITE_ANALYTICS_DOMAINS", "");
    vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "");
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    window.umami = { track: vi.fn() };
    observed.length = 0;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { intersect = callback; }
      observe(element: Element) { observed.push(element); }
      unobserve() {}
      disconnect() {}
    });
  });
  afterEach(() => {
    stop?.();
    document.body.innerHTML = "";
    delete window.umami;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("records CTA placement and outbound host without a source-bearing href", () => {
    document.body.innerHTML = '<section data-track-place="hero"><a href="/playground#c=private">Open</a></section><footer><a href="https://github.com/private?token=secret">GitHub</a></footer>';
    stop = observePageTelemetry();
    document.querySelectorAll("a").forEach((link) => link.click());
    expect(window.umami!.track).toHaveBeenCalledWith("playground_cta", expect.objectContaining({ place: "hero" }));
    expect(window.umami!.track).toHaveBeenCalledWith("outbound", expect.objectContaining({ place: "footer", to: "github.com" }));
    expect(JSON.stringify(vi.mocked(window.umami!.track).mock.calls)).not.toMatch(/private|secret/);
  });

  it("counts each question, reveal, and reading milestone once, including lazy content", async () => {
    document.body.innerHTML = '<details class="faq"><summary>Question</summary></details><section data-read="features"></section>';
    stop = observePageTelemetry();
    const question = document.querySelector("details")!;
    question.open = true;
    question.dispatchEvent(new Event("toggle"));
    question.dispatchEvent(new Event("toggle"));
    expect(observed).toHaveLength(0);
    document.dispatchEvent(new Event("scroll"));
    intersect([{ target: observed[0], isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    intersect([{ target: observed[0], isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    document.body.insertAdjacentHTML("beforeend", '<section data-read="article-end"></section><details data-track="solution_reveal" data-track-block="tables"><summary>Answer</summary></details>');
    await Promise.resolve();
    expect(observed).toHaveLength(2);
    intersect([{ target: observed[1], isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    const answer = document.querySelectorAll("details")[1];
    answer.open = true;
    answer.dispatchEvent(new Event("toggle"));
    const names = vi.mocked(window.umami!.track).mock.calls.map(([name]) => name);
    expect(names).toEqual(["faq", "read", "read", "solution_reveal"]);
  });

  it("cleans up listeners before remounting and tracks installation", () => {
    document.body.innerHTML = '<button data-track="try_demo" data-track-place="hero">Try</button>';
    observePageTelemetry()();
    stop = observePageTelemetry();
    document.querySelector("button")!.click();
    window.dispatchEvent(new Event("appinstalled"));
    expect(vi.mocked(window.umami!.track).mock.calls.map(([name]) => name)).toEqual(["try_demo", "app_installed"]);
  });
});
