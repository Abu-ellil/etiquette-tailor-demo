# Component API Contracts

**Branch**: `002-workers-tasks-wages` | **Date**: 2026-04-03

## StatusBadge

**File**: `src/renderer/components/StatusBadge.tsx`
**Replaces**: `StatusChip.tsx`, inline `.chip-*` usage in Orders.tsx, Dashboard.tsx

```ts
type OrderDisplayStatus = 'inProgress' | 'ready' | 'delivered' | 'late';
type OrderDBStatus = 'intake' | 'cutting' | 'sewing' | 'ready' | 'delivered';
type TaskStatus = 'pending' | 'in_progress' | 'done';
type AppStatus = OrderDisplayStatus | OrderDBStatus | TaskStatus;

interface StatusBadgeProps {
  status: AppStatus;
  size?: 'sm' | 'md';       // default: 'md'
  onClick?: () => void;      // if provided, renders as <button>
  className?: string;        // additional classes
}

// Exported helpers (used by Orders.tsx filter tabs, etc.)
function getStatusLabel(status: AppStatus): string;
function getStatusChipClass(status: AppStatus): string;
```

**Rendering rules**:
- If `onClick` provided → `<button>` with `cursor-pointer`
- If no `onClick` → `<span>`
- Status group mapping for chip class:
  - `pending`, `intake`, `cutting`, `sewing`, `in_progress`, `inProgress` → `chip-progress`
  - `ready`, `done` → `chip-ready` (done uses tertiary), `chip-ready` (ready uses tertiary)
  - `delivered` → `chip-delivered`
  - `late` → `chip-late`

---

## ConfirmDialog

**File**: `src/renderer/components/ConfirmDialog.tsx`
**Replaces**: `window.confirm()` calls in Customers.tsx, Workers.tsx, OrderDetail.tsx

```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;         // default: 'Confirm'
  cancelLabel?: string;          // default: 'Cancel'
  variant?: 'danger' | 'warning'; // default: 'danger'
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Rendering rules**:
- Only renders when `open === true`
- Uses `.modal-backdrop` + `.modal-content` with animations
- Backdrop click calls `onCancel`
- `danger` variant: red confirm button (bg-error text-on-error)
- `warning` variant: amber confirm button (bg-tertiary text-on-tertiary)

---

## EmptyState

**File**: `src/renderer/components/EmptyState.tsx`
**Replaces**: Inline empty state markup across all list pages

```ts
interface EmptyStateProps {
  icon: string;              // Material Symbols icon name
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}
```

**Rendering rules**:
- Centered flex column layout
- Icon: 48px, `text-outline`
- Title: `font-semibold text-on-surface`
- Description: `text-sm text-secondary`
- Action: `.btn-primary` button, only renders if both `actionLabel` and `onAction` provided

---

## CSS Additions Contract

### Tokens (added to `@theme` in index.css)

```css
--color-on-primary-fixed-variant: #5a1228;
--color-tertiary-container: #f2e57b;
--color-on-tertiary-container: #1f1c00;
--color-secondary-fixed: #d0e1fb;
--color-on-secondary-fixed: #1c2b3d;
--color-on-secondary-container: #384351;
--color-on-error: #ffffff;
```

### Animations (added to index.css)

```css
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes modalBackdropIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes modalContentIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px) }
  to { opacity: 1; transform: scale(1) translateY(0) }
}

.animate-fadeIn { animation: fadeIn 150ms ease-out forwards }
```

### Component Variants (added to `@layer components` in index.css)

```css
.input-field-sm { /* h-10, smaller padding */ }
.btn-sm { /* h-9, compact for table actions */ }
```
