# Etiquette Tailor — Project Constitution
# READ THIS BEFORE TOUCHING ANY FILE

## What this project is
Desktop management system for a women's tailor shop.
2 branches, Arabic + English data, offline-first.
Built with: Electron + React + TypeScript + SQLite + Tailwind + shadcn/ui

## The ONE rule above all others
Ask me before making any decision that is not in this file.
Never invent features. Never add packages not listed here.
Never change the tech stack. When unsure → STOP and ask.

## Business rules — never break these
- Balance = Price - Paid  (always auto-calculated, never manual)
- Worker wage = Price × (rate/100)  OR  fixed amount
- Order number = Branch prefix + auto-increment  (A-001, B-001)
- Order statuses: "In Progress" → "Ready" → "Delivered" only
- Payment types: "Cash" or "Card" only — nothing else
- Every order MUST have: customer, piece type, price, paid, worker, due date

## Branch rules
- Branch A: الميرة — أم قرن  →  prefix A-XXX
- Branch B: الشارع التجاري — أم قرن  →  prefix B-XXX
- Counters are per-branch and never reset

## Tech stack — locked, do not change
- Runtime: Electron (desktop, offline-first)
- UI: React + TypeScript
- Styling: Tailwind CSS + shadcn/ui components only
- Database: SQLite via better-sqlite3 (local file: app.db)
- Build: electron-vite for dev, electron-builder for production
- Forms: react-hook-form
- Dates: date-fns (supports Arabic locale)
- Print: react-to-print

## Approved npm packages only
better-sqlite3, electron-store, react-to-print,
date-fns, react-hook-form, shadcn/ui, tailwindcss,
electron-builder, electron-vite
→ Any other package requires my explicit approval first.

## Folder structure — do not reorganize
src/
  main/          ← Electron main process + IPC handlers
  renderer/      ← All React UI
    pages/       ← One file per page (Dashboard, Orders, etc.)
    components/  ← Shared UI components
  db/            ← ALL database queries live here only
    schema.ts    ← Table definitions
    customers.ts, orders.ts, workers.ts, etc.

## Database rules
- NEVER access DB from renderer directly
- ALL queries go through /src/db/ layer
- ALL order creation uses a transaction
- Arabic text stored as UTF-8 (default in SQLite)
- Never delete records — use soft delete (is_deleted = 1)

## UI rules
- Interface language: English only
- Customer data can be Arabic or English
- Invoices: bilingual (Arabic + English)
- Buttons must be large enough for quick daily use
- No dark mode required — light mode only
- RTL support only on invoice print view

## What to do when you're unsure
→ Stop. Write: "I'm not sure about X — here are 2 options:"
→ Wait for my decision before writing any code
→ Never guess on business logic

## Dev commands
npm run dev      → start development
npm run build    → production build
npm test         → run tests
