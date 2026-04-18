## 2024-04-18 - [Keyboard Accessible Hover Overlays]
**Learning:** In the dark-theme UI, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) must include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) to ensure they are accessible and visible to keyboard users.
**Action:** When creating hidden hover overlay buttons or elements, always include `focus-visible:opacity-100` along with explicit focus ring classes.
