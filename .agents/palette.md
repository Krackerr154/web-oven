## 2026-04-15 - Focus Rings and ARIA Labels for Icon-Only Buttons
**Learning:** In the dark-theme UI, icon-only buttons without explicit focus styles fail to indicate keyboard focus effectively due to contrast issues, and lack context for screen readers.
**Action:** Always add `aria-label` to icon-only buttons and explicitly set `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500` to ensure clear visibility against the dark background.
