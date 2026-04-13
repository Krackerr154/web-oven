## 2026-04-13 - Accessibility of Icon-Only Buttons in Dark Themes
**Learning:** In dark-mode-first applications (like web-oven), icon-only buttons require explicit `focus-visible:ring-orange-500` to ensure keyboard navigability is clearly visible against the slate background. Standard browser outlines may clash or be invisible.
**Action:** Always add `aria-label` and explicit `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500` to all interactive icon-only components.
