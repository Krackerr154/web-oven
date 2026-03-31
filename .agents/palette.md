## 2026-03-31 - Visually Hidden Hover Overlays
**Learning:** In the dark-theme UI, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) inside `overflow-hidden` containers can be completely invisible to keyboard users when focused.
**Action:** Always include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) and ensure proper shaping (e.g., `rounded-full` or `focus-visible:ring-inset`) to ensure the interactive element is accessible and visible to keyboard users.
