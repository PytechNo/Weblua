import { EditorView, layer, RectangleMarker } from "@codemirror/view";

/** Position the highlight without moving layout boxes when the viewport changes. */
class SelectionRectangle extends RectangleMarker {
  draw(): HTMLDivElement {
    const element = super.draw();
    this.position(element);
    return element;
  }

  update(element: HTMLElement, previous: RectangleMarker): boolean {
    if (!super.update(element, previous)) return false;
    this.position(element);
    return true;
  }

  private position(element: HTMLElement): void {
    element.style.left = "0";
    element.style.top = "0";
    element.style.transform = `translate(${this.left}px, ${this.top}px)`;
  }
}

/**
 * drawSelection's viewport-clipped rectangles move via top/left when a long
 * selection is scrolled, producing large CLS bursts. Reuse CodeMirror's range
 * geometry with transform-positioned backgrounds. Its original selection
 * extension still owns the carets, native-selection hiding, and iOS handles.
 */
export const selectionLayer = [
  layer({
    above: false,
    class: "cm-transformSelectionLayer",
    mount(element) {
      element.classList.add("cm-selectionLayer");
    },
    markers(view) {
      return view.state.selection.ranges.flatMap((range) =>
        range.empty ? [] : RectangleMarker.forRange(view, "cm-selectionBackground", range).map(
          (marker) => new SelectionRectangle("cm-selectionBackground", marker.left, marker.top, marker.width, marker.height)
        )
      );
    },
    update(update) {
      return update.docChanged || update.selectionSet || update.viewportChanged;
    }
  }),
  EditorView.baseTheme({
    ".cm-selectionLayer:not(.cm-transformSelectionLayer) .cm-selectionBackground": { display: "none" }
  })
];
