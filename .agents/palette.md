## 2024-05-24 - Interactive Elements Focus
**Learning:** Dark theme UI visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) must include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) to ensure they are accessible and visible to keyboard users.
**Action:** When adding visually hidden hover overlays to elements, also include `focus-visible:opacity-100` to make them visible during keyboard navigation.
