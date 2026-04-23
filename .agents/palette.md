## 2024-04-23 - Interactive Cards require Focus Handling
**Learning:** In the dark-theme UI, making custom components (like cards) interactive without proper `focus-visible` styling means keyboard users cannot see which element has focus against dark backgrounds.
**Action:** When adding interactivity to a `div` via `role="button"`, always add `tabIndex={0}` and a visible focus ring class like `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`. Ensure nested interactive elements (like icon buttons) also define explicit `focus-visible` styles.
