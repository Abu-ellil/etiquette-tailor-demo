# Quickstart: UI/UX Revision Implementation

**Branch**: `002-workers-tasks-wages` | **Date**: 2026-04-03

## Prerequisites

- App running via `npm run dev`
- Current build passes `npm run build` (or at least the renderer portion compiles)
- All existing pages render without crashing (note: OrderDetail has runtime errors from undeclared variables that should be fixed separately)

## Implementation Order

### Phase 1: Foundation (CSS + Tokens) — Start Here

1. **Add missing tokens** to `@theme` in `index.css`:
   - `--color-on-primary-fixed-variant: #5a1228`
   - `--color-tertiary-container: #f2e57b`
   - `--color-on-tertiary-container: #1f1c00`
   - `--color-secondary-fixed: #d0e1fb`
   - `--color-on-secondary-fixed: #1c2b3d`
   - `--color-on-secondary-container: #384351`
   - `--color-on-error: #ffffff`

2. **Add CSS animations** to `index.css`:
   - `@keyframes fadeIn` + `.animate-fadeIn`
   - `@keyframes modalBackdropIn` + apply to `.modal-backdrop`
   - `@keyframes modalContentIn` + apply to `.modal-content`

3. **Add component variants** to `index.css`:
   - `.input-field-sm` (h-10, smaller padding)
   - `.btn-sm` (h-9, smaller padding/text)

4. **Add font weight 800** to `inter.css` and `manrope.css` (font-face declarations + woff2 files)

5. **Add Noto Sans Arabic** font import for Invoice printing

**Verify**: Run `npm run dev`, check that existing pages still render correctly. Inspect elements that previously had undefined tokens — they should now show correct colors.

### Phase 2: Critical Bug Fixes

6. **Fix RTL sidebar** in `AppLayout.tsx:83`:
   ```ts
   const sidebarHiddenClass = isRTL ? 'translate-x-full' : '-translate-x-full';
   ```

7. **Replace hardcoded colors**:
   - `NewOrder.tsx:548` — use `.btn-primary` class instead of inline gradient
   - `Reports.tsx:273` — use `bg-primary` instead of `#763952`
   - `Backup.tsx:103` — use `bg-error-container text-on-error-container`

8. **Fix low contrast text**:
   - `Workers.tsx:398,698` — `text-white` → `text-on-primary-fixed`
   - `WorkerWageReport.tsx:167` — same fix
   - `WorkerProductivity.tsx:88` — same fix

**Verify**: Visual inspection of affected pages. Text should be clearly readable on colored backgrounds.

### Phase 3: Component Unification

9. **Create `StatusBadge.tsx`** (new component in `src/renderer/components/`):
   - Handles all status types (task + order)
   - Maps to existing `.chip-*` CSS classes
   - Supports `onClick` for interactive chips

10. **Create `ConfirmDialog.tsx`** (new component):
    - Uses `.modal-backdrop` + `.modal-content`
    - Danger/warning variants
    - Smooth open animation from Phase 1

11. **Create `EmptyState.tsx`** (new component):
    - Icon + title + description + optional CTA

12. **Update all consumers**:
    - Replace `StatusChip.tsx` imports with `StatusBadge`
    - Replace `window.confirm()` calls in Customers, Workers, OrderDetail
    - Replace inline empty state markup with `<EmptyState />`

**Verify**: All status chips look consistent. Delete confirmations use themed dialog. Empty states are uniform.

### Phase 4: UX Polish

13. **Standardize input fields** in `Measurements.tsx` to use `.input-field`

14. **Add page transitions**: Wrap page content in `<div className="animate-fadeIn">`

15. **Add loading skeletons** to Orders, Customers, Workers pages (extend Dashboard pattern)

16. **Improve table action buttons**: Make Edit/View buttons always visible on mobile, hover-reveal on desktop

**Verify**: Navigate through all pages. Forms should look consistent. Transitions should feel smooth.

## Test Checklist

- [ ] All pages render without console errors
- [ ] Status chips look consistent across Orders, TaskBoard, OrderDetail
- [ ] Delete/danger actions show themed ConfirmDialog (not native dialog)
- [ ] Modals animate in smoothly (fade + scale)
- [ ] All text is readable on colored backgrounds (contrast check)
- [ ] RTL layout: sidebar slides in correct direction
- [ ] Invoice prints with Arabic text rendering correctly
- [ ] Search inputs in tables use consistent styling
- [ ] `font-extrabold` text renders sharply (weight 800 loaded)
- [ ] Empty states show consistent layout with icon + message

## Files Created

| File | Purpose |
|------|---------|
| `src/renderer/components/StatusBadge.tsx` | Unified status display |
| `src/renderer/components/ConfirmDialog.tsx` | Themed confirm dialog |
| `src/renderer/components/EmptyState.tsx` | Reusable empty state |

## Files Modified

| File | Change Summary |
|------|----------------|
| `src/renderer/index.css` | Tokens, animations, variants |
| `src/renderer/assets/fonts/inter.css` | Weight 800 |
| `src/renderer/assets/fonts/manrope.css` | Weight 800 |
| `src/renderer/components/AppLayout.tsx` | RTL fix |
| `src/renderer/components/NotificationBell.tsx` | Token fix |
| `src/renderer/pages/Dashboard.tsx` | Token fix, StatusBadge |
| `src/renderer/pages/Orders.tsx` | StatusBadge, EmptyState |
| `src/renderer/pages/Customers.tsx` | ConfirmDialog, EmptyState |
| `src/renderer/pages/NewOrder.tsx` | Remove hardcoded colors |
| `src/renderer/pages/OrderDetail.tsx` | ConfirmDialog, StatusBadge, token fix |
| `src/renderer/pages/Workers.tsx` | ConfirmDialog, contrast fix |
| `src/renderer/pages/Measurements.tsx` | Input styling |
| `src/renderer/pages/Reports.tsx` | Remove hardcoded colors |
| `src/renderer/pages/Backup.tsx` | Theme token fix |
| `src/renderer/pages/TaskBoard.tsx` | StatusBadge, EmptyState |
| `src/renderer/pages/Invoice.tsx` | Font fix |
| `src/renderer/pages/WorkerWageReport.tsx` | Contrast fix |
| `src/renderer/pages/WorkerProductivity.tsx` | Contrast fix |
