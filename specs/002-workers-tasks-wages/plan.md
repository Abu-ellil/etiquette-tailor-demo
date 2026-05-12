# Implementation Plan: UI/UX Revision & Enhancement

**Branch**: `002-workers-tasks-wages` | **Date**: 2026-04-03 | **Spec**: `specs/002-workers-tasks-wages/spec.md`
**Input**: User request to revise app UI using frontend-design skill, focusing on weaknesses and UX

## Summary

Comprehensive UI/UX audit and revision of the Etiquette Tailor desktop management system. The app has a functional "Bespoke Atelier" design system (Plum primary, Slate secondary, Manrope headlines, Inter body) with Material Design 3 token naming, but suffers from multiple critical issues: undefined CSS variables causing broken rendering, hardcoded colors bypassing the theme system, missing font weights, dual status chip systems, RTL bugs, no modal animations, inconsistent form styling, accessibility gaps, and UX friction patterns (window.confirm dialogs, broken dropdown menus, missing error boundaries).

The revision focuses on: (1) fixing all broken/undefined tokens, (2) unifying the component system, (3) enhancing micro-interactions and transitions, (4) improving form UX patterns, (5) adding proper empty/loading/error states everywhere, (6) polishing the visual design for a premium boutique feel.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Electron, React 19, Tailwind CSS v4 (via @theme), shadcn/ui (listed in CLAUDE.md but not currently used), react-hook-form, date-fns, react-to-print
**Storage**: SQLite via better-sqlite3 (local app.db)
**Testing**: npm test (framework TBD in project)
**Target Platform**: Windows/macOS desktop (Electron)
**Project Type**: Desktop app (Electron + React SPA)
**Performance Goals**: Fast local UI, offline-first, <100ms page transitions
**Constraints**: Light mode only (per CLAUDE.md), English UI with Arabic data support, RTL on invoice print only
**Scale/Scope**: 2-branch tailor shop, ~10 concurrent users, ~50 pages/components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| Balance = Price - Paid (auto-calculated) | PASS | No change to business logic |
| Order statuses: In Progress → Ready → Delivered only | PASS | UI-only revision |
| Payment types: Cash or Card only | PASS | No change |
| Tech stack locked (Electron + React + TS + SQLite + Tailwind + shadcn/ui) | PASS | Only using approved packages |
| All queries through /src/db/ layer | PASS | No DB changes |
| Interface language: English only | PASS | No i18n changes |
| Light mode only | **VIOLATION** | Dark mode system exists; recommend removal per constitution |
| Never invent features | PASS | Only enhancing existing UI |
| Never add packages not listed | PASS | No new packages |
| Folder structure unchanged | PASS | Same directories |

### Violation Justification

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dark mode removal | CLAUDE.md says "light mode only" but full dark mode exists with toggle | Partial removal would leave dead code; full removal aligns with constitution |

## Project Structure

### Documentation (this feature)

```text
specs/002-workers-tasks-wages/
├── plan.md              # This file
├── research.md          # UI/UX audit findings and enhancement decisions
├── data-model.md        # Design token system and component specifications
├── quickstart.md        # Implementation guide for developers
└── contracts/           # Component API contracts
    └── components.md    # Shared component props/interfaces
```

### Source Code (repository root)

```text
src/renderer/
├── index.css                    # Design tokens (@theme), component layer
├── assets/fonts/                # Inter, Manrope, Material Symbols
├── components/
│   ├── AppLayout.tsx            # Main layout (sidebar + header + content)
│   ├── TitleBar.tsx             # Electron window title bar
│   ├── StatusChip.tsx           # Unified status chip (task + order)
│   ├── NotificationBell.tsx     # Notification dropdown
│   └── [existing components]
├── pages/
│   ├── Dashboard.tsx
│   ├── Orders.tsx
│   ├── Customers.tsx
│   ├── NewOrder.tsx
│   ├── OrderDetail.tsx
│   ├── Workers.tsx
│   ├── Measurements.tsx
│   ├── TaskBoard.tsx
│   ├── TaskManagement.tsx
│   ├── Invoice.tsx
│   ├── Reports.tsx
│   ├── Settings.tsx
│   ├── Backup.tsx
│   ├── WorkerPayRates.tsx
│   ├── WorkerWageReport.tsx
│   ├── SalarySummary.tsx
│   ├── WorkerProductivity.tsx
│   ├── MyTasks.tsx
│   ├── CuttingQueue.tsx
│   └── Login.tsx
├── contexts/
│   ├── I18nContext.tsx
│   └── ThemeContext.tsx
└── i18n/
    ├── index.ts
    └── ar.ts
```

**Structure Decision**: No structural changes. All revisions happen in-place within existing files. The only new file is a potential shared `StatusBadge.tsx` to unify the dual status systems.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dark mode removal | Constitution says light-only; existing dark mode contradicts | Hiding toggle still leaves dead CSS/code |
