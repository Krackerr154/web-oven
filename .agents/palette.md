
## 2024-04-09 - Accessible Close Buttons in Dark Theme
**Learning:** Icon-only close buttons in dark theme components (like Toasts or Detail Cards) often lack visible focus indicators by default, and default browser outlines can clash with the dark slate background. Additionally, omitting `aria-label` makes them inaccessible to screen readers.
**Action:** Always add `aria-label` (e.g., "Dismiss" or "Close Details") and explicit focus styles (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`) to icon-only interactive elements, ensuring proper visual feedback for keyboard navigation.
