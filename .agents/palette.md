## 2026-03-30 - Focus State for Visually Hidden Hover Overlays
**Learning:** In the dark-theme UI, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) must include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) to ensure they are accessible and visible to keyboard users.
**Action:** Add `focus-visible:opacity-100` and standard focus rings to interactive elements that rely solely on hover visibility.
