import type { RuntimeFlavor } from "../../lib/types";
import { availabilityLabel, FLAVOR_LABELS, type StdlibEntry } from "./stdlib";

/**
 * Renders a stdlib entry for a completion info panel or a hover tooltip. When
 * the entry is not in the active flavor, the availability line says so.
 * `signatureText` replaces the manual-style signature, e.g. with a checked
 * Luau type.
 */
export function renderStdlibDoc(
  entry: StdlibEntry,
  flavor: RuntimeFlavor,
  signatureText = entry.params ? `${entry.name}${entry.params}` : entry.name
): HTMLElement {
  const root = document.createElement("div");
  root.className = "cm-lua-doc";

  const signature = document.createElement("code");
  signature.className = "cm-lua-doc-signature";
  signature.textContent = signatureText;
  root.append(signature);

  const description = document.createElement("p");
  description.textContent = entry.doc;
  root.append(description);

  const availability = document.createElement("p");
  availability.className = "cm-lua-doc-availability";
  const where = availabilityLabel(entry.name);
  if (entry.flavors.has(flavor)) {
    availability.textContent = where;
  } else {
    availability.classList.add("cm-lua-doc-missing");
    availability.textContent = `Not in ${FLAVOR_LABELS[flavor]}. Available in ${where}.`;
  }
  root.append(availability);

  return root;
}
