## 2024-03-08 - Added accessible close button to Toast notifications
**Learning:** Icon-only buttons within small overlay components like Toasts can easily become invisible to keyboard users and screen readers if proper `aria-label` and explicit `focus-visible` styles are forgotten, especially against dark backgrounds.
**Action:** Always ensure that transient or notification UI components include visible focus rings and screen-reader accessible labels on their dismissal actions.
