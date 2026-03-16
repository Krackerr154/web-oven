## 2024-05-18 - Visually Hidden Hover Overlays & Focus
**Learning:** Hidden hover overlays (like `opacity-0` that turn to `opacity-100` on hover) in the dark-theme components are completely invisible to keyboard users navigating via Tab unless explicitly styled for focus.
**Action:** Always ensure interactive elements with hidden hover states include `focus-visible:opacity-100` alongside standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) to guarantee keyboard accessibility.
