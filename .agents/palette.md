## 2024-05-24 - Keyboard Accessible Interactive Cards
**Learning:** In dark-theme interactive cards that use flip or overlay animations (like OvenStatusCard), keyboard users need explicit focus styles (`focus-visible:ring-orange-500`) and keyboard event handlers (`onKeyDown`) because standard `div` elements with `onClick` do not receive focus or trigger events natively.
**Action:** Always add `role="button"`, `tabIndex={0}`, `onKeyDown` (for Enter/Space), and `focus-visible` styles to clickable `div` components. Add `aria-label` to icon-only close buttons within overlays.
