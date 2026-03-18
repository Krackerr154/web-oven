

## 2025-02-17 - [Accessible Icon-Only Buttons in Dark Mode]
**Learning:** Icon-only buttons in the web-oven dark theme (slate + orange) often lack focus rings and standard aria-labels, which are critical for keyboard and screen reader accessibility. It's important to include `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500` along with `aria-label` to ensure visibility against the dark background.
**Action:** When adding or auditing icon-only buttons (like in calendars or toasts), always verify they have an `aria-label` and explicitly define `focus-visible` styles with the `orange-500` ring, potentially adding `rounded-sm` or similar to control the ring shape tightly around the icon.
