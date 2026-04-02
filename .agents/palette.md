## 2024-04-02 - Ensure Keyboard Accessibility for Visually Hidden Overlays in Dark Theme
**Learning:** When using `opacity-0` hover overlays (like image upload buttons over avatars) in the dark theme, these elements remain invisible when focused via keyboard navigation, creating an accessibility barrier.
**Action:** Always include `focus-visible:opacity-100` alongside standard focus ring utilities (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`) to guarantee visibility when keyboard users interact with visually hidden overlays.
