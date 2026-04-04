## 2024-04-04 - Accessible Visually Hidden Hover Overlays
**Learning:** In the dark theme, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) are completely invisible to keyboard users and lack clear focus indications when navigating.
**Action:** Always include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) to ensure they are visible and accessible. Additionally, provide `aria-label` and use `aria-hidden="true"` on inner presentation elements to avoid redundant screen reader announcements.
