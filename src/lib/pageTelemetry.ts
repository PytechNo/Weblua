import { analyticsEnabled, trackEvent } from "./telemetry";

/** Delegated listeners also cover lazy-loaded and prerendered content. Clean up for StrictMode. */
export function observePageTelemetry(): () => void {
  if (!analyticsEnabled()) return () => {};
  const sent = new Set<string>();
  const once = (key: string, name: string, data: Record<string, unknown>) => {
    if (sent.has(key)) return;
    sent.add(key);
    trackEvent(name, data);
  };
  const place = (element: Element) => element.closest("[data-track-place]")?.getAttribute("data-track-place") ??
    (element.closest("header") ? "nav" : element.closest("footer") ? "footer" : element.closest("aside") ? "aside" : "content");
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const marked = event.target.closest<HTMLElement>("[data-track]");
    if (marked && !(marked instanceof HTMLDetailsElement)) {
      const data = Object.fromEntries(Object.entries(marked.dataset).filter(([key]) => key.startsWith("track") && key !== "track")
        .map(([key, value]) => [key.slice(5).toLowerCase(), value]));
      trackEvent(marked.dataset.track!, data);
    }
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    if (link.origin === location.origin && ["/playground", "/lua", "/luau"].includes(link.pathname)) {
      trackEvent("playground_cta", { place: place(link) });
    } else if (/^https?:$/.test(link.protocol) && link.origin !== location.origin) {
      trackEvent("outbound", { to: link.hostname, place: place(link) });
    }
  };
  const toggle = (event: Event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    if (details.dataset.track) {
      once(`details:${details.dataset.track}:${details.dataset.trackBlock}`, details.dataset.track, { block: details.dataset.trackBlock });
    } else if (details.classList.contains("faq")) {
      const question = [...document.querySelectorAll("details.faq")].indexOf(details) + 1;
      once(`faq:${question}`, "faq", { question });
    }
  };
  const installed = () => trackEvent("app_installed");
  document.addEventListener("click", click);
  document.addEventListener("toggle", toggle, true);
  window.addEventListener("appinstalled", installed);

  const observed = new WeakSet<Element>();
  const reading = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reading?.unobserve(entry.target);
      const part = entry.target.getAttribute("data-read")!;
      once(`read:${part}`, "read", { part });
    }
  }, { rootMargin: "0px 0px -40% 0px" });
  const observe = (element: Element) => {
    if (!observed.has(element)) { observed.add(element); reading?.observe(element); }
  };
  document.querySelectorAll("[data-read]").forEach(observe);
  // Scan only added subtrees: typing and animated lessons must not rescan the whole page.
  const mutations = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (!(node instanceof Element)) return;
    if (node.matches("[data-read]")) observe(node);
    node.querySelectorAll("[data-read]").forEach(observe);
  })));
  mutations.observe(document.body, { childList: true, subtree: true });
  return () => {
    document.removeEventListener("click", click);
    document.removeEventListener("toggle", toggle, true);
    window.removeEventListener("appinstalled", installed);
    reading?.disconnect();
    mutations.disconnect();
  };
}
