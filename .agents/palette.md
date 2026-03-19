## 2024-03-24 - Initial setup
**Learning:** Dark theme accessibility requires extra attention to contrast and focus indicators.
**Action:** Always test hover and focus states against slate backgrounds.

## 2024-03-24 - Accessible Dark Theme Hover Overlays
**Learning:** In a dark-theme UI, interactive elements with visually hidden hover overlays (e.g., `opacity-0` that appear on hover) are inaccessible to keyboard users unless they also include `focus-visible:opacity-100`. Standard focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`) are also required against dark backgrounds to prevent default browser outline clashing.
**Action:** Always combine `focus-visible:opacity-100` with standard `focus-visible` ring utilities and explicit shape border radii (like `rounded-full`) when using `opacity-0` hover overlay buttons.
