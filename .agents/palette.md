## 2026-03-13 - Focus Ring and Aria Label on Icon Buttons
**Learning:** Dark theme UI requires explicit focus styles because default browser focus rings are often invisible against dark backgrounds. Icon-only buttons are inaccessible to screen readers without an aria-label.
**Action:** Add aria-label and `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500` to all icon-only interactive elements in the project components.
