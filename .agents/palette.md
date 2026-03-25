
## 2025-03-25 - Visually Hidden Hover Overlays Need Focus Accessibility
**Learning:** In the dark-theme UI, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) are completely inaccessible to keyboard users unless explicitly styled for focus states. Standard focus rings are insufficient if the element remains transparent (`opacity-0`).
**Action:** Always ensure that visually hidden hover elements include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) and the `focus-visible:outline-none` class to prevent default browser outline clashing.
