# Research: UI/UX Audit Findings & Enhancement Decisions

**Branch**: `002-workers-tasks-wages` | **Date**: 2026-04-03

## Audit Methodology

Full source code review of all 20+ page components, 5 shared components, CSS design tokens (index.css @theme block), font loading configuration, layout system, and modal/dialog patterns. Each finding categorized by severity (Critical / High / Medium / Low) and impact area (Visual / Functional / UX / Accessibility).

---

## Decision 1: Fix Undefined CSS Variables (HIGH)

**Problem**: Multiple token references used in components are NOT defined in `@theme`:

| Token | Used In | Defined? |
|-------|---------|----------|
| `text-on-primary-fixed-variant` | NotificationBell:34, Dashboard:390 | NO |
| `bg-tertiary-container` | OrderDetail:356 | NO |
| `bg-secondary-fixed` | Reports:406 | NO |
| `text-on-secondary-container` | Customers:25 | NO |
| `text-on-error` | Orders:141 (error toast) | NO |

**Decision**: Add all missing tokens to `@theme` with proper MD3 values derived from the existing plum/slate palette.

**Alternatives**:
- Replace with existing tokens → Rejected; color semantics differ
- Remove usages → Rejected; UI intent is valid, tokens just missing

---

## Decision 2: Eliminate Hardcoded Colors (HIGH)

**Problem**: Hardcoded hex colors bypass theme system:

| Location | Hardcoded | Should Be |
|----------|-----------|-----------|
| NewOrder:548 | `#763952` / `#92506a` | `var(--color-primary)` / `var(--color-primary-container)` |
| Reports:273 | `#763952` | `var(--color-primary)` |
| Backup:103 | `bg-red-50 border-red-200 text-red-800` | `bg-error-container text-on-error-container` |

**Decision**: Replace ALL hardcoded colors with CSS variable references.

**Alternatives**:
- Leave as-is → Rejected; undermines design token system
- Component-specific variables → Rejected; over-engineering

---

## Decision 3: Add Missing Font Weight 800 (MEDIUM)

**Problem**: `font-extrabold` (800) used ~30+ times but Inter loads 400/500/600 and Manrope loads 400/600/700 only.

**Decision**: Add weight 800 woff2 files and `@font-face` declarations to both font CSS files.

**Alternatives**:
- Replace with `font-bold` → Rejected; collapses visual hierarchy
- Variable fonts → Rejected; larger file sizes

---

## Decision 4: Load Noto Sans Arabic for Invoice Printing (HIGH)

**Problem**: `Invoice.tsx:187,248,275` references `'Noto Sans Arabic'` but font is never imported.

**Decision**: Self-host Noto Sans Arabic font. Required per CLAUDE.md's "bilingual invoice" rule.

**Alternatives**:
- System Arabic fonts → Rejected; inconsistent across OS
- Different Arabic font → Rejected; Noto pairs well with Inter/Manrope

---

## Decision 5: Unify Dual Status Chip Systems (HIGH)

**Problem**: Two separate systems:
1. CSS classes (`.chip-progress`, `.chip-ready`, `.chip-late`, `.chip-delivered`) in index.css for orders
2. React component `StatusChip.tsx` with `STATUS_STYLES` for task statuses (`pending`, `in_progress`, `done`)

**Decision**: Unify into a single React component `StatusBadge` handling both order and task statuses, mapping all keys to the CSS `.chip-*` classes.

**Alternatives**:
- Keep both → Rejected; confusing and visually inconsistent
- CSS-only → Rejected; React component provides type safety

---

## Decision 6: Add Modal Open/Close Animations (MEDIUM)

**Problem**: Modals appear/disappear instantly with no transition — jarring UX.

**Decision**: Add CSS `@keyframes` animations: backdrop fade-in (200ms), content scale+fade (250ms ease-out).

**Alternatives**:
- JS animation library → Rejected; not in approved packages
- View Transition API → Not available in Electron Chromium yet

---

## Decision 7: Fix RTL Sidebar Slide Direction (HIGH)

**Problem**: `AppLayout:83` has identical branches: `isRTL ? '-translate-x-full' : '-translate-x-full'`

**Decision**: Fix to `isRTL ? 'translate-x-full' : '-translate-x-full'`.

**Alternatives**:
- Logical translate property → Tailwind doesn't support natively

---

## Decision 8: Replace window.confirm() with Themed ConfirmDialog (MEDIUM)

**Problem**: `Customers:154`, `Workers:281`, `OrderDetail:277` use native `window.confirm()` which looks alien to the app's design.

**Decision**: Create reusable `ConfirmDialog` component using existing `.modal-backdrop`/`.modal-content` pattern with danger-colored confirm button.

**Alternatives**:
- Toast with undo → Rejected; complex for SQLite soft-delete

---

## Decision 9: Standardize Input Field Styling (MEDIUM)

**Problem**: `Measurements.tsx` uses inline border classes instead of `.input-field`. Search inputs use custom heights.

**Decision**: All inputs use `.input-field`. Add `.input-field-sm` variant for compact contexts.

**Alternatives**:
- Per-page customization → Rejected; leads to visual drift

---

## Decision 10: Fix Low Contrast Text on primary-container (MEDIUM)

**Problem**: `Workers:398,698`, `WorkerWageReport:167`, `WorkerProductivity:88` use `text-white` on `bg-primary-container` (#92506a). Contrast ratio ~3.2:1, below WCAG AA 4.5:1.

**Decision**: Use `text-on-primary-fixed` (#390720) instead. Provides ~7:1 contrast.

**Alternatives**:
- Darken primary-container → Would break MD3 palette relationships

---

## Decision 11: Standardize Session Access (LOW)

**Problem**: Session accessed 3 different ways: `localStorage.getItem()`, `electronAPI.auth.getSession()`, or props.

**Decision**: Create `useSession()` hook. All pages use it.

**Alternatives**:
- React Context → More architectural change than needed

---

## Decision 12: Dark Mode Policy (HIGH — Needs User Decision)

**Problem**: Full dark mode exists but CLAUDE.md says "light mode only."

**Decision**: Two options presented to user:
1. Remove dark mode entirely (align with constitution)
2. Keep dark mode and amend CLAUDE.md

---

## Enhancement Decisions (Proactive UX)

### E1: Page Transition Animations
Add 150ms fade-in on page mount. Imperceptible for speed, noticeable for quality.

### E2: Reusable EmptyState Component
Standardize empty states with contextual icons, helpful messaging, and CTA buttons.

### E3: Loading Skeletons for All List Pages
Extend Dashboard's skeleton pattern to Orders, Customers, Workers, TaskBoard.

### E4: Table Action Button Visibility
Ensure action buttons (Edit, View) are visible, not just on hover — important for daily use speed.

### E5: Button Size System
Standardize: `btn-sm` (table actions), `btn-primary` (form submits), minimum 36px height.

### E6: Dashboard Stat Card Polish
Larger numbers, icon backgrounds, better formatting for first-impression quality.

---

## Priority Matrix

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| P0 | F7: RTL sidebar bug | 1 line | High |
| P0 | F1: Undefined CSS vars | 10 lines | High |
| P0 | F2: Hardcoded colors | 15 lines | High |
| P1 | F5: Dual status chips | 50 lines | High |
| P1 | F8: window.confirm() | 80 lines | Medium |
| P1 | F3: Font weight 800 | 10 lines | Medium |
| P1 | F10: Low contrast text | 10 lines | Medium |
| P2 | F6: Modal animations | 20 lines | Medium |
| P2 | F9: Input styling | 30 lines | Low |
| P2 | F4: Noto Sans Arabic | 15 lines | Medium |
| P2 | E1-E6: Enhancements | ~200 lines | Medium |
| P3 | F11: Session access | 40 lines | Low |
| P3 | F12: Dark mode decision | Ask user | Varies |
