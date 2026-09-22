/**
 * A button label slot sized to its widest state.
 *
 * Run and Check swap their word while the worker is busy, and the worker
 * answers long after the click that started it -- outside the 500ms grace CLS
 * gives user input. The wider word widened the button, and between roughly
 * 450px and 520px that rewrapped .toolbar-actions onto an extra row and moved
 * the whole panes grid 44px down and back: ~0.7 CLS for a single run,
 * attributed to .output-pane because it is the largest thing that moved.
 *
 * The hidden copy of `widest` holds the slot open at the longer word, so
 * neither state can reflow the toolbar. `widest` has to be at least as long as
 * every value `children` can take, or the shift comes back.
 */
export function SwapLabel({ children, widest }: { children: string; widest: string }) {
  return (
    <span className="swap-label">
      <span>{children}</span>
      <span aria-hidden="true">{widest}</span>
    </span>
  );
}
