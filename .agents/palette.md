## 2026-04-17 - Focus indicators for visually hidden hover overlays
**Learning:** In the dark-theme UI, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) are inaccessible to keyboard-only users unless they receive focus styles that also make them visible.
**Action:** Always include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) to ensure these elements are accessible and visible to keyboard users.
