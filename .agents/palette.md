## 2026-05-09 - Focusability of Transparent Overlays in Dark Theme
**Learning:** When using visually hidden `opacity-0` overlays for interaction elements in a dark theme (like profile avatar uploads), keyboard users are unable to see the element when it receives focus unless the overlay becomes opaque or visible on focus.
**Action:** Always pair `opacity-0 group-hover:opacity-100` with `focus-visible:opacity-100` along with explicit focus ring styles (`focus-visible:ring-2 focus-visible:ring-orange-500`) to ensure accessibility for keyboard users.
