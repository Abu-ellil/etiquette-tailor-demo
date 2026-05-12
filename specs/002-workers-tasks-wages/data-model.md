# Data Model: UI/UX Revision Design System

**Branch**: `002-workers-tasks-wages` | **Date**: 2026-04-03

## Design Token Additions

### Missing Tokens to Add to `@theme`

```css
/* Tertiary container (derived from tertiary #695f00) */
--color-tertiary-container: #f2e57b;
--color-on-tertiary-container: #1f1c00;

/* On-primary-fixed variant (lighter emphasis on primary-fixed bg) */
--color-on-primary-fixed-variant: #5a1228;

/* Secondary fixed (surface variant for secondary emphasis) */
--color-secondary-fixed: #d0e1fb;
--color-on-secondary-fixed: #1c2b3d;
--color-on-secondary-container: #384351;

/* On-error (white text on error bg) */
--color-on-error: #ffffff;
```

### Existing Tokens (No Changes)

```
primary:           #763952    (Plum)
primary-container: #92506a    (Lighter plum)
primary-fixed:     #ffd9e4    (Pink tint)
on-primary:        #ffffff    (White)
on-primary-fixed:  #390720    (Dark plum)

secondary:         #505f76    (Slate blue)
secondary-container: #d0e1fb  (Light blue)
on-secondary:      #ffffff

tertiary:          #695f00    (Olive)
tertiary-fixed:    #f2e57b    (Gold)
on-tertiary-fixed: #1f1c00

surface:           #f8f9fa
on-surface:        #191c1d
error:             #ba1a1a
error-container:   #ffdad6
```

## Component Specifications

### StatusBadge (Unified Component)

Replaces both CSS `.chip-*` classes usage and `StatusChip.tsx`.

**Props**:
```ts
interface StatusBadgeProps {
  status: 'pending' | 'in_progress' | 'done'        // task statuses
        | 'inProgress' | 'ready' | 'delivered' | 'late'  // order display statuses
        | 'intake' | 'cutting' | 'sewing';               // order DB statuses
  onClick?: () => void;
  size?: 'sm' | 'md';       // sm = 0.5rem padding, md = 0.25rem 0.75rem (default)
}
```

**Status → Style Mapping**:
```
pending / intake / cutting / sewing / inProgress / in_progress → chip-progress
ready / done                                                  → chip-ready (done) / chip-ready (ready)
delivered                                                     → chip-delivered
late                                                          → chip-late
```

**Status → Label Mapping** (English labels, pass through `t()` for Arabic):
```
pending      → 'Pending'
in_progress  → 'In Progress'
done         → 'Done'
intake       → 'Intake'
cutting      → 'Cutting'
sewing       → 'Sewing'
ready        → 'Ready'
delivered    → 'Delivered'
late         → 'Late'
inProgress   → 'In Progress'
```

### ConfirmDialog

Replaces all `window.confirm()` calls.

**Props**:
```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;       // default: 'Delete'
  variant?: 'danger' | 'warning';  // danger = red confirm, warning = amber
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Visual**: Uses `.modal-backdrop` + `.modal-content` with:
- Warning icon (Material Symbol `warning`)
- Title in Manrope semibold
- Message in Inter regular
- Cancel button (ghost style)
- Confirm button (red gradient for danger, amber for warning)

### EmptyState

**Props**:
```ts
interface EmptyStateProps {
  icon: string;              // Material Symbol name
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

**Visual**: Centered column layout with:
- 48px icon in `text-outline`
- Title in `font-semibold text-on-surface`
- Description in `text-sm text-secondary`
- Optional CTA button (`.btn-primary`)

### Input Field Variants

```
.input-field      → h-14, bottom-border focus (existing)
.input-field-sm   → h-10, bottom-border focus, smaller padding (NEW)
```

## CSS Animations to Add

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalBackdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalContentIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 150ms ease-out forwards;
}

.modal-backdrop {
  animation: modalBackdropIn 200ms ease-out forwards;
}

.modal-content {
  animation: modalContentIn 250ms ease-out forwards;
}
```

## Button Size System

```
.btn-primary     → h-12 (48px), px-7, text-sm font-semibold (existing gradient)
.btn-sm          → h-9 (36px), px-3, text-xs font-semibold (for table actions)
```

## Files to Modify

| File | Change |
|------|--------|
| `index.css` | Add missing tokens, animations, `.input-field-sm`, `.btn-sm` |
| `AppLayout.tsx:83` | Fix RTL sidebar translate direction |
| `StatusChip.tsx` | Rename to `StatusBadge.tsx`, unify all status types |
| `StatusBadge.tsx` | NEW: Unified component (replaces StatusChip.tsx) |
| `ConfirmDialog.tsx` | NEW: Themed confirm dialog |
| `EmptyState.tsx` | NEW: Reusable empty state |
| `NotificationBell.tsx:34` | Fix `text-on-primary-fixed-variant` → use new token |
| `Dashboard.tsx:390` | Fix undefined color token |
| `NewOrder.tsx:548` | Replace hardcoded colors with `.btn-primary` |
| `Reports.tsx:273` | Replace hardcoded `#763952` with `var(--color-primary)` |
| `Backup.tsx:103` | Replace Tailwind red classes with theme tokens |
| `Customers.tsx:154` | Replace `window.confirm()` with `ConfirmDialog` |
| `Workers.tsx:281,398,698` | Replace `window.confirm()` + fix contrast |
| `OrderDetail.tsx:277,356` | Replace `window.confirm()` + fix undefined token |
| `Measurements.tsx:235,313-340` | Standardize to `.input-field` |
| `WorkerWageReport.tsx:167` | Fix `text-white` → `text-on-primary-fixed` |
| `WorkerProductivity.tsx:88` | Fix `text-white` → `text-on-primary-fixed` |
| `inter.css` | Add weight 800 font-face |
| `manrope.css` | Add weight 800 font-face |
| `Invoice.tsx:187,248,275` | Add Noto Sans Arabic import |
