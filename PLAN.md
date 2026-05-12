# Etiquette Tailor — Project Plan (v2)
> Spec-Driven Development using Spec Kit + Claude Code
> Updated after full business model analysis

---

## Project Overview

**Product:** Desktop management system for a women's tailor shop (Etiquette Tailor)
**Branches:** 2 branches in أم قرن — الميرة (Branch A) and الشارع التجاري (Branch B)
**Stack:** Electron.js + React + TypeScript + SQLite + Tailwind CSS
**Mode:** Offline-first desktop app, packaged as .exe installer
**UI Language:** English interface, Arabic + English data support

---

## Business Model — Key Decisions

### 1. Multi-User Authentication — 4 Roles

| Role    | Arabic   | What They See                                           |
|---------|----------|---------------------------------------------------------|
| Admin   | مالك     | Everything — financial reports, wages, backup, settings |
| Manager | مشرف     | All orders and tasks, production reports — no financials |
| Tailor  | خياطة    | Only tasks assigned to her — piece details, no prices   |
| Cutter  | قص       | Daily cutting queue — piece type and notes only         |

**Data isolation rule:** Every DB query is scoped to `branch_id = user.branch_id` and `worker_id = user.worker_id` automatically by role. Admin has no scope filter — sees everything.

### 2. Branches — Offline-First, Sync Later

- MVP: Each branch runs its own local SQLite file (`branch_a.db`, `branch_b.db`)
- No sync in Phase 1 — each branch is fully independent
- Future: Manual export for central reporting, then optional cloud sync

### 3. Orders — Multi-Level Structure

```
Customer (1)
  └── Orders (many)              ← multiple open orders per customer
        ├── Order Measurements   ← measurements for THIS specific order
        └── Order Tasks          ← one task per worker role per order
```

**Two measurement levels:**
- `customer_measurements` — general profile (reusable reference)
- `order_measurements` — specific to this order (can differ per piece type)

### 4. Worker Pay — Dual Model

A worker can have BOTH a fixed salary AND piece-rate simultaneously:

```
monthly_total = fixed_salary + Σ(order.price × piece_rate)

Example:
  Fixed salary:    500 SAR
  10 جلابية × 50 SAR × 18% = 90 SAR
  Monthly total:   590 SAR
```

Rates vary by: piece type / worker agreement / season (date range override).

### 5. Production Tracking — Task-Based System (Critical Feature)

This solves the shop's core problem: linking every piece to every worker at every stage.

```
Order A-027 (جلابية — 50 SAR)
  ├── task: cutting   → Fatima  → done        → wage: 50 × 18% = 9 SAR
  ├── task: tailoring → Maryam  → in_progress → wage: 50 × 20% = 10 SAR
  └── task: finishing → —       → pending     → wage: —
```

Each task is independent: its own worker, status, and calculated wage.

### 6. Admin Onboarding — Phase Zero

Before any order can be created, Admin must complete:
1. Branch names and prefixes
2. Employee accounts (name, role, username, password)
3. Worker rates per piece type and season
4. Shop logo for invoices

The system shows an onboarding wizard on first launch and blocks order creation until steps 1–3 are done.

---

## Constitution (Non-Negotiable Rules)

### Language
- UI: English only
- Data (names, notes): Arabic + English, UTF-8, RTL-compatible
- Invoice: bilingual Arabic + English

### Business Logic
- `balance = price - paid` — auto-calculated, never manually editable
- `wage = fixed_salary + Σ(price × piece_rate)` — calculated per task, stored in `order_tasks`
- Order numbering: `A-001` for Branch A, `B-001` for Branch B — auto-increment per branch
- Order status: `In Progress → Ready → Delivered` (this order only)
- Task status: `pending → in_progress → done`
- Payment: `Cash` or `Card` only

### Architecture
- All DB access through `/src/db/` layer only
- Renderer never touches SQLite directly — IPC only
- Every order + task creation uses a single DB transaction
- Offline-first: zero internet required for core features
- Data scoping by role enforced at DB layer, not UI layer

### Tech Stack (fixed)
| Layer       | Technology              |
|-------------|-------------------------|
| Desktop     | Electron.js             |
| UI          | React + TypeScript      |
| Styling     | Tailwind CSS            |
| Database    | SQLite (better-sqlite3) |
| Dev tooling | electron-vite           |
| Packaging   | electron-builder        |
| Forms       | react-hook-form         |
| Printing    | react-to-print          |
| Dates       | date-fns                |
| Backup/Email| nodemailer              |

### Security
- Login required before accessing any page
- Tailor and Cutter cannot see prices or other workers' data
- Only Admin can access Reports, Wages, and Backup

---

## Database Schema

```sql
-- Core
branches (
  id, name_ar, name_en, prefix, active
)

users (
  id, name, username, password_hash,
  role,         -- admin | manager | tailor | cutter
  branch_id, worker_id, active
)

-- Customers
customers (
  id, name, phone, notes, branch_id, created_at
)

customer_measurements (
  id, customer_id, label,
  chest, waist, hips, length, sleeve, notes, created_at
)

-- Orders
orders (
  id, order_number, branch_id, customer_id,
  piece_type,      -- جلابية | عباية | فستان | تعديل
  details, price, paid, balance,
  status,          -- in_progress | ready | delivered
  payment_method,  -- cash | card
  receive_date, delivery_date, created_by, created_at
)

order_measurements (
  id, order_id,
  chest, waist, hips, length, sleeve, notes
)

-- Workers
workers (
  id, name, type,    -- permanent | temporary | seasonal
  fixed_salary, branch_id, active
)

worker_rates (
  id, worker_id, piece_type,
  rate_type,     -- percent | fixed
  rate_value,
  season_start, season_end   -- NULL = always applies
)

-- Production Tasks
order_tasks (
  id, order_id,
  task_type,     -- design | cutting | tailoring | finishing
  worker_id,
  status,        -- pending | in_progress | done
  piece_rate,    -- rate snapshot at assignment time
  wage_amount,   -- calculated: price × piece_rate or fixed
  started_at, completed_at, notes
)

-- Invoices
invoices (
  id, order_id, printed_at,
  sent_via_whatsapp, sent_at
)
```

---

## Phase 0 — Admin Onboarding (Before Implementation)

**Not a code phase — a data setup phase.**

On first launch, system checks: if no workers or rates exist → show onboarding wizard.

| Step | What Admin Enters                               |
|------|-------------------------------------------------|
| 1    | Branch A: name_ar, name_en, prefix = "A"        |
| 2    | Branch B: name_ar, name_en, prefix = "B"        |
| 3    | All employee accounts with roles                |
| 4    | Worker rates per piece type for each worker     |
| 5    | Shop logo image                                 |

Order creation is blocked until steps 1–4 are complete.

---

## Phase 1 — Foundation

**Goal:** Working app with DB, login, role-based access, and dashboard.

### Spec Kit Commands
```bash
/specify → /plan → /tasks → /implement
```

### /specify Prompt
```
Build the foundation for Etiquette Tailor:

Tech:
- Electron + React + TypeScript + Tailwind using electron-vite
- SQLite via better-sqlite3 — two DB files: branch_a.db, branch_b.db

Auth:
- Login screen: username + password
- 4 roles: admin, manager, tailor, cutter
- Session stored in-memory (cleared on app close)
- Route guard: redirect to login if not authenticated

Branches:
- Two branches: A (الميرة) and B (الشارع التجاري)
- DB files: branch_a.db, branch_b.db (selected at login)
- Auto-increment order numbers per branch: A-001, B-001

Full DB schema: (see schema section above)
- Seed one admin account: username "admin", password "admin123"
- Seed both branches

Dashboard (role-aware):
- Admin/Manager: total orders today, ready, overdue, revenue, last 5 orders
- Tailor: my pending tasks, completed today
- Cutter: cutting queue for today

Onboarding wizard:
- Show on first launch if no workers configured
- Step 1: branch settings — Step 2: add employee — Step 3: set rates
```

### Acceptance Criteria
- [ ] App launches — login screen appears
- [ ] Admin login works, wrong credentials fail
- [ ] Tailor login sees only her dashboard — no prices visible
- [ ] Dashboard loads real data from DB
- [ ] Both branches created with correct prefixes
- [ ] Onboarding wizard appears on fresh DB

---

## Phase 2 — Customers, Measurements & Orders

**Goal:** Full order creation with dual-level measurements and order tracking.

### /specify Prompt
```
Build Customers, Measurements, and Orders:

Customers (Manager + Admin):
- Add / edit / search by Arabic name or phone
- Fields: name, phone, notes
- Customer profile: list all orders, view measurements

Customer Measurements:
- Multiple sets per customer (e.g. label: "Eid 2025")
- Fields: chest, waist, hips, length, sleeve, notes
- Reference only — not auto-linked to orders

Orders:
- Create order: customer, piece_type, details, price, paid,
  receive_date, delivery_date, payment_method
- balance = price - paid (auto, read-only)
- Order number: auto-generated by branch prefix (A-001 / B-001)
- Per-order measurements: separate entry per order
- Status defaults to In Progress on create
- Orders table: search by name/number, filter by status and branch

Order detail page:
- All fields editable (except balance, order_number)
- Status update flow
- Per-order measurements editable
- Task list shown (editable in Phase 3)
```

### Acceptance Criteria
- [ ] Create customer with Arabic name — found in search
- [ ] Customer measurements saved and visible in profile
- [ ] Create order — balance auto-calculates
- [ ] Order number matches branch and increments correctly
- [ ] Per-order measurements saved separately from customer profile
- [ ] Tailor cannot see order price

---

## Phase 3 — Workers, Tasks & Wage Calculation

**Goal:** Task-based production tracking with automatic wage calculation.

### /specify Prompt
```
Build Workers, Order Tasks, and Wage Calculation:

Workers page (Admin only):
- Add worker: name, type (permanent/temporary/seasonal),
  fixed_salary (optional), branch_id
- Set rates per piece type: rate_type (percent|fixed), rate_value
- Seasonal overrides: same fields + season_start, season_end
- Worker list with monthly wage totals

Order Tasks (inside Order Detail — Manager + Admin):
- Add tasks per order: task_type, worker assignment
- Wage auto-calculated on worker selection:
    percent → wage = order.price × (rate / 100)
    fixed   → wage = rate.rate_value
    seasonal rate wins over standard if date overlaps
- wage_amount stored in order_tasks
- Task status: pending → in_progress → done

Tailor view (her tasks only):
- "My Tasks" list: order_number, piece_type, notes
- Mark task: started / done
- View order measurements (no prices)

Cutter view:
- "Cutting Queue" ordered by delivery_date
- Mark cutting task as done

Manager view:
- All tasks — color-coded by status
- Overdue flag: delivery_date < today AND not delivered
```

### Wage Logic
```
SELECT rate FROM worker_rates
WHERE worker_id = ? AND piece_type = ?
  AND (season_start IS NULL OR date('now') BETWEEN season_start AND season_end)
ORDER BY season_start DESC LIMIT 1

wage_amount =
  if rate.rate_type = 'percent': order.price * (rate.rate_value / 100)
  if rate.rate_type = 'fixed':   rate.rate_value
```

### Edge Cases (resolve at /clarify)
- No rate set for piece type → block save, show warning
- Seasonal + standard both match → seasonal wins
- Worker unassigned → task stays pending, wage = null
- Price changes after task created → prompt to recalculate

### Acceptance Criteria
- [ ] Tailor with 18% rate on جلابية — 50 SAR order → wage shows 9 SAR
- [ ] Seasonal rate overrides standard during date range
- [ ] Tailor dashboard shows only her tasks, no prices
- [ ] Manager sees all tasks with overdue flags
- [ ] Monthly wage total per worker calculates correctly

---

## Phase 4 — Invoice & Printing

**Goal:** Bilingual thermal invoice with WhatsApp send.

### /specify Prompt
```
Build Invoice and Printing:

Invoice layout:
- Logo top-center, shop name, branch name
- Order: number, customer name, piece_type, details
- Financial: price, paid, balance (in Arabic numerals)
- Dates: receive_date, delivery_date
- Payment method badge
- Bilingual: Arabic RTL + English
- Optimized for 80mm thermal paper

Print:
- react-to-print — print button
- @page { width: 80mm; margin: 4mm }
- Print preview modal before printing
- Record print in invoices table

WhatsApp:
- Button opens: https://wa.me/<phone>?text=<encoded_message>
- Arabic message: "طلبك جاهز — رقم A-027 — تسليم 2 أبريل"
- Phone from customer record

Logo: loaded from app settings path, fallback to shop name text
```

### Acceptance Criteria
- [ ] Invoice renders all fields in Arabic + English
- [ ] Print preview shows correct 80mm width
- [ ] Thermal print — no clipping on real paper
- [ ] WhatsApp button opens correct chat with message

---

## Phase 5 — Reports, Backup & Polish

**Goal:** Financial and production reports, automated backup, final production readiness.

### /specify Prompt
```
Build Reports, Backup, and Settings:

Reports (Admin only):
- Filter: date range, branch
- Financial: total_sales, wages_paid, net_profit, cash vs card
- Production: orders by status, overdue, per-worker task count + wages
- Print / PDF export

Backup (Admin only):
- One-click backup: copy DB to timestamped ZIP
- Email backup via nodemailer (SMTP in settings)
- Restore: pick ZIP, confirm, replace DB
- Reminder every 7 days if no backup

Settings (Admin only):
- Shop name, logo upload, branch names (read-only after first order)
- SMTP settings for backup email

Polish:
- Empty state UI for all tables
- Loading indicators during DB operations
- Overdue badge on dashboard
- Confirm dialogs before destructive actions
```

### Acceptance Criteria
- [ ] Net profit = sales - total wages (verified manually)
- [ ] Report filters by branch work correctly
- [ ] Backup creates ZIP, restore recovers all data
- [ ] App works fully offline
- [ ] electron-builder produces working .exe

---

## Final Release Checklist

- [ ] Full flow: onboarding → customer → order → tasks → invoice → report
- [ ] Both branches tested independently
- [ ] Arabic text correct everywhere
- [ ] Role isolation verified: tailor cannot see prices
- [ ] Fully offline tested (no network)
- [ ] Backup + restore tested with real data
- [ ] .exe installer tested on clean Windows machine
- [ ] Thermal print verified on 80mm paper
- [ ] Wage calculation verified against manual spreadsheet

---

## Project Folder Structure

```
etiquette-tailor/
├── PLAN.md                      ← this file
├── constitution.md
├── CLAUDE.md
├── .claude/settings.json
├── specs/
│   ├── phase-1-foundation.md
│   ├── phase-2-customers-orders.md
│   ├── phase-3-workers-tasks.md
│   ├── phase-4-invoice-print.md
│   └── phase-5-reports-backup.md
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   └── ipc/
│   │       ├── auth.ts
│   │       ├── orders.ts
│   │       ├── tasks.ts
│   │       ├── workers.ts
│   │       └── reports.ts
│   ├── renderer/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── Workers.tsx
│   │   │   ├── Reports.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── Invoice.tsx
│   │   │   ├── TaskBoard.tsx
│   │   │   └── RoleGuard.tsx
│   │   └── App.tsx
│   └── db/
│       ├── schema.ts
│       ├── customers.ts
│       ├── orders.ts
│       ├── tasks.ts
│       ├── workers.ts
│       └── reports.ts
├── package.json
├── electron-builder.yml
└── electron.vite.config.ts
```

---

*Etiquette Tailor — Spec Kit + Claude Code | v2 — updated after business model analysis*
