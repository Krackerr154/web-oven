## 2024-04-29 - Initializing Palette Agent
**Learning:** Understanding the dark theme structure and focus outlines.
**Action:** Always ensure keyboard accessibility on custom interactive elements.

## 2024-04-29 - Making non-native interactive div cards accessible
**Learning:** When making a non-native element like a `div` act as a button (e.g., an oven status card that reveals details on click), it lacks built-in keyboard accessibility. Furthermore, interactive elements inside a visually hidden overlay (e.g., an overlay hidden via `opacity-0` instead of `display: none`) can still receive focus, causing confusion for screen reader and keyboard users.
**Action:** Always add `role="button"`, `tabIndex={0}`, an `onKeyDown` handler for 'Enter' and 'Space' (calling `e.preventDefault()`), and explicit `focus-visible` styles to non-native interactive containers. For buttons inside a visually hidden overlay, dynamically manage focusability using `tabIndex={isOverlayVisible ? 0 : -1}` to ensure they are only focusable when the overlay is active.
