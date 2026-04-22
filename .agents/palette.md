## YYYY-MM-DD - Initial Creation
**Learning:** Initializing palette journal.
**Action:** Ready for entries.

## 2024-04-22 - Visually hidden hover overlays lack keyboard focus visibility
**Learning:** In the dark-theme UI, visually hidden hover overlays (e.g., elements with `opacity-0` that appear on hover) must include `focus-visible:opacity-100` alongside standard focus rings to ensure they are accessible and visible to keyboard users.
**Action:** Always add `focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500` to interactive elements that are visually hidden with `opacity-0`.
