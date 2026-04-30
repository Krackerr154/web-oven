## 2024-04-30 - Conditional Focus for Visually Hidden Overlays
**Learning:** In the dark-theme UI, elements that are visually hidden on hover via `opacity-0` and `pointer-events-none` are still reachable by keyboard navigation unless explicitly managed. This causes screen reader confusion and "invisible" focus rings.
**Action:** Always dynamically manage the `tabIndex` of interactive elements inside hidden overlays using `tabIndex={isVisible ? 0 : -1}` to ensure they are removed from the tab sequence when visually hidden.
