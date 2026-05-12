# Tasks: Workers, Tasks & Wage Calculation

**Input**: Design documents from `/specs/002-workers-tasks-wages/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add DB functions and IPC handlers needed across multiple user stories.

- [X] T001 Add `getWorkerTasks(userId: number)` function to `src/db/workers.ts` — returns all tasks assigned to a worker with order details (order_number, piece_type, due_date, customer_name)
- [X] T002 Add `getMonthlyEarnings(userId: number, month: string)` function to `src/db/workers.ts` — returns task count, piece earnings, fixed salary, and total for a given month
- [X] T003 Add `getAllTasks(filters)` function to `src/db/orders.ts` — returns all tasks across orders with joins to orders, customers, user tables; supports filtering by branch_id, worker_id, task_type
- [X] T004 Register IPC handlers in `src/main/index.ts`: `workers:getWorkerTasks`, `workers:getMonthlyEarnings`, `orders:getAllTasks`
- [X] T005 Update `src/main/preload.ts` ElectronAPI interface and api object to expose the 3 new IPC channels: `workers.getWorkerTasks`, `workers.getMonthlyEarnings`, `orders.getAllTasks`

---

## Phase 2: Foundational (Route & Navigation Updates)

**Purpose**: Add new routes and sidebar navigation items that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Add routes in `src/renderer/App.tsx`: `/orders/:id` → OrderDetail, `/my-tasks` → MyTasks, `/cutting-queue` → CuttingQueue, `/task-board` → TaskBoard
- [X] T007 Update `ROLE_ROUTES` in `src/renderer/App.tsx` — worker role gets `/my-tasks` or `/cutting-queue` based on worker_type; admin gets `/task-board`; manager gets `/task-board`
- [X] T008 Update `src/renderer/components/AppLayout.tsx` sidebar navigation — add Task Board link (admin/manager), My Tasks link (tailor), Cutting Queue link (cutter); determine which worker link to show based on session.worker_type
- [X] T009 Create placeholder page files: `src/renderer/pages/OrderDetail.tsx`, `src/renderer/pages/MyTasks.tsx`, `src/renderer/pages/CuttingQueue.tsx`, `src/renderer/pages/TaskBoard.tsx` — each exports a default component with the page title

**Checkpoint**: Foundation ready — all routes and nav items exist. Pages are placeholders ready for implementation.

---

## Phase 3: User Story 1 — Order Detail Page with Task Management (Priority: P1) 🎯 MVP

**Goal**: Full order detail page with task management — view/edit order, manage tasks, edit measurements.

**Independent Test**: Navigate to an order from the Orders list → Order Detail opens → add/view/edit tasks, edit measurements, edit order fields.

### Implementation for User Story 1

- [X] T010 [US1] Build `src/renderer/pages/OrderDetail.tsx` — load order data via `electronAPI.orders.get(id)`, display all order fields (order number, customer, piece type, price, paid, balance, status, due date, payment method, branch, notes) in a detail layout with edit capability
- [X] T011 [US1] Add measurements section to OrderDetail — load via `electronAPI.orders.getMeasurements(id)`, display measurement fields (chest, waist, hips, length, sleeve, shoulder, notes), add edit/save functionality via `electronAPI.orders.updateMeasurements`
- [X] T012 [US1] Add tasks section to OrderDetail — load via `electronAPI.orders.getTasks(id)`, display task list with columns: Task Type, Worker, Wage Type, Rate, Wage Amount, Status (chip), Started At, Completed At
- [X] T013 [US1] Implement "Add Task" form in OrderDetail — task type dropdown (cutting/sewing/design), worker dropdown (from `electronAPI.workers.getAll`), auto-calculate wage using `electronAPI.workers.getActiveRate(workerId, pieceType)`, save via `electronAPI.orders.createTask`
- [X] T014 [US1] Implement task status controls — clicking status chip cycles through pending → in_progress → done via `electronAPI.orders.updateTaskStatus`, update timestamps display
- [X] T015 [US1] Implement task reassignment — click worker name on a task to show worker dropdown, on change recalculate wage via `electronAPI.workers.getActiveRate` and call `electronAPI.orders.reassignTask`, reset status to pending
- [X] T016 [US1] Add order edit mode — "Edit Order" button toggles editable fields (piece type, details, price, paid, due date, status, payment method), save calls `electronAPI.orders.update`, balance auto-recalculates on price/paid change
- [X] T017 [US1] Add role-based visibility — hide price, paid, balance, wage_type, wage_rate, wage_amount columns from Tailor and Cutter roles (check session.role)
- [X] T018 [US1] Update `src/renderer/pages/Orders.tsx` — make order numbers clickable links navigating to `/orders/:id`

**Checkpoint**: Order Detail page is fully functional — can view, edit orders and manage tasks.

---

## Phase 4: User Story 2 — Tailor "My Tasks" View (Priority: P1)

**Goal**: Tailor sees only their assigned tasks with status controls, no financial info.

**Independent Test**: Login as tailor → My Tasks shows only their tasks → can start/complete tasks → no prices visible.

### Implementation for User Story 2

- [X] T019 [US2] Build `src/renderer/pages/MyTasks.tsx` — load tasks via `electronAPI.workers.getWorkerTasks(session.userId)`, display task cards sorted by status (in_progress first, then pending, then done today), each card shows: order number, piece type, notes, due date, status chip
- [X] T020 [US2] Add status controls to MyTasks — "Start" button on pending tasks (calls `electronAPI.orders.updateTaskStatus(id, 'in_progress')`), "Done" button on in_progress tasks (calls `electronAPI.orders.updateTaskStatus(id, 'done')`)
- [X] T021 [US2] Add click-to-view measurements on task cards — clicking a task expands to show order measurements (via `electronAPI.orders.getMeasurements`), no financial data shown
- [X] T022 [US2] Add empty state — when no tasks assigned, show "No tasks assigned" with icon
- [X] T023 [US2] Verify no price/wage data leaks — search MyTasks component for any reference to price, paid, balance, wage, earnings — ensure none are displayed

**Checkpoint**: Tailor can view and manage their tasks independently with complete data isolation.

---

## Phase 5: User Story 3 — Cutter "Cutting Queue" View (Priority: P1)

**Goal**: Cutter sees their cutting tasks sorted by urgency, can mark done, no financial info.

**Independent Test**: Login as cutter → Cutting Queue shows only cutting tasks sorted by delivery date → can complete tasks → no prices visible.

### Implementation for User Story 3

- [X] T024 [US3] Build `src/renderer/pages/CuttingQueue.tsx` — load tasks via `electronAPI.workers.getWorkerTasks(session.userId)` filtered to task_type "cutting", sort by delivery_date ascending, display task cards with: order number, piece type, notes, delivery date
- [X] T025 [US3] Add "Done" button to cutting tasks — calls `electronAPI.orders.updateTaskStatus(id, 'done')`
- [X] T026 [US3] Add empty state — when no cutting tasks, show "No cutting tasks" with icon
- [X] T027 [US3] Verify no price/wage data leaks — ensure no financial fields displayed

**Checkpoint**: Cutter has their dedicated queue view working independently.

---

## Phase 6: User Story 4 — Task Board (Admin/Manager) (Priority: P2)

**Goal**: Bird's-eye view of all tasks with filters and overdue flags.

**Independent Test**: Login as admin → Task Board shows all tasks → filters work → overdue flagged → manager sees branch-scoped data.

### Implementation for User Story 4

- [X] T028 [US4] Build `src/renderer/pages/TaskBoard.tsx` — load all tasks via `electronAPI.orders.getAllTasks({})`, display in a table with columns: Order#, Customer, Piece Type, Task Type, Worker, Due Date, Status, Wage Amount
- [X] T029 [US4] Add filter controls — branch dropdown, worker dropdown, task type dropdown (cutting/sewing/design); on filter change, re-fetch with params via `electronAPI.orders.getAllTasks(filters)`
- [X] T030 [US4] Add overdue flag — tasks where due_date < today AND status !== done show red "Overdue" badge on the task row
- [X] T031 [US4] Add status chip colors — pending = neutral, in_progress = blue/primary, done = green/success
- [X] T032 [US4] Add role-based scoping — if session.role is "manager", pass session.branch_id to filter; if session.role is "manager", hide wage_amount column

**Checkpoint**: Admin/manager can monitor all production tasks from a single view.

---

## Phase 7: User Story 5 — Seasonal Rate Overrides & Monthly Wage Totals (Priority: P2)

**Goal**: Seasonal date range UI on Worker Rates page + monthly earnings on Workers page.

**Independent Test**: Set seasonal rate with dates → create task in range → verify seasonal rate used. Check monthly earnings on Workers page.

### Implementation for User Story 5

- [X] T033 [US5] Add seasonal date range UI to `src/renderer/pages/WorkerPayRates.tsx` — below each rate row, add a collapsible "Seasonal Override" section with start date and end date fields; when dates are set, show "Seasonal" badge; save dates via `electronAPI.workers.setRate` with season_start/season_end
- [X] T034 [US5] Add monthly earnings section to `src/renderer/pages/Workers.tsx` — add a month/year selector at the top; for each worker card, display monthly earnings via `electronAPI.workers.getMonthlyEarnings(workerId, month)` showing: task count, piece earnings, fixed salary, total
- [X] T035 [US5] Add earnings breakdown expandable — clicking on a worker's earnings shows detail: completed tasks count, sum of piece-rate wages, fixed salary, grand total

**Checkpoint**: Seasonal rates can be set with date ranges; monthly earnings visible per worker.

---

## Phase 8: User Story 6 — Worker Dashboard Enhancement (Priority: P2)

**Goal**: Role-specific dashboard content for tailor, cutter, admin, and manager.

**Independent Test**: Login as each role → dashboard shows correct scoped content.

### Implementation for User Story 6

- [X] T036 [US6] Update `src/renderer/pages/Dashboard.tsx` — add tailor dashboard section: pending tasks count, completed today count, assigned task list (no prices), loaded via `electronAPI.workers.getWorkerTasks(session.userId)`
- [X] T037 [US6] Add cutter dashboard section — cutting queue for today sorted by delivery date, loaded via `electronAPI.workers.getWorkerTasks(session.userId)` filtered to task_type cutting
- [X] T038 [US6] Add production summary to admin dashboard — task counts by status (pending, in_progress, done), loaded via `electronAPI.orders.getAllTasks({})`
- [X] T039 [US6] Scope manager dashboard to branch — pass session.branch_id to stats/tasks queries, hide revenue total for manager role

**Checkpoint**: Each role sees appropriate dashboard content with correct data scoping.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T040 [P] Add loading skeletons to OrderDetail, MyTasks, CuttingQueue, TaskBoard pages — show skeleton cards/rows while data loads
- [X] T041 [P] Add error states to all new pages — display error message with retry button if API calls fail
- [X] T042 Add "No rate configured" warning in OrderDetail task creation — if `getActiveRate` returns undefined for a worker+pieceType, show warning and disable save
- [X] T043 [P] Ensure consistent status chip styling across all pages (OrderDetail tasks, MyTasks, CuttingQueue, TaskBoard) — extract a shared `StatusChip` component in `src/renderer/components/`
- [X] T044 Add price change recalculation prompt in OrderDetail — when order price is edited and tasks exist, show "Recalculate task wages?" confirmation; on confirm, recalculate all non-done task wages
- [ ] T045 Verify role isolation — login as each role (admin, manager, tailor, cutter) and verify: Tailor/Cutter see zero price/wage data, Manager sees branch-scoped data only, all sidebar links match ROLE_ROUTES
- [ ] T046 Run quickstart.md validation — walk through all 6 test scenarios in quickstart.md and verify each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — Order Detail page
- **US2 (Phase 4)**: Depends on Phase 2 — Tailor My Tasks
- **US3 (Phase 5)**: Depends on Phase 2 — Cutter Cutting Queue
- **US4 (Phase 6)**: Depends on Phase 1 (T003 getAllTasks) + Phase 2
- **US5 (Phase 7)**: Depends on Phase 1 (T002 getMonthlyEarnings) + Phase 2
- **US6 (Phase 8)**: Depends on Phase 1 (T001 getWorkerTasks) + Phase 2
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (Order Detail)**: Independent — can implement alone
- **US2 (Tailor My Tasks)**: Independent — can implement alone
- **US3 (Cutter Queue)**: Independent — can implement alone
- **US4 (Task Board)**: Independent — needs getAllTasks from Phase 1
- **US5 (Seasonal/Wages)**: Independent — needs getMonthlyEarnings from Phase 1
- **US6 (Dashboard)**: Independent — needs getWorkerTasks from Phase 1

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different functions, different files areas)
- T004, T005 can run in parallel after T001-T003
- T006, T007, T008, T009 can run in parallel (different concerns in route/nav setup)
- US2 (Phase 4) and US3 (Phase 5) can run in parallel after Phase 2
- US4, US5, US6 can all run in parallel after Phase 1+2

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009)
3. Complete Phase 3: US1 Order Detail (T010-T018)
4. **STOP and VALIDATE**: Navigate to an order, manage tasks, verify wage calculations
5. Then continue with US2-US6

### Recommended Order

1. Setup + Foundational → Routes and DB ready
2. US1 Order Detail → Central management page
3. US2 + US3 in parallel → Worker views
4. US4 Task Board → Admin overview
5. US5 Seasonal/Wages → Enhanced worker management
6. US6 Dashboard → Polish existing page
7. Polish → Cross-cutting improvements

---

## Notes

- All new pages follow the existing "Bespoke Atelier" design system (Plum primary, Slate secondary, Manrope headlines, Inter body)
- Use existing UI patterns from Orders.tsx, Workers.tsx, WorkerPayRates.tsx as reference
- No new npm packages — all functionality uses existing dependencies
- Task status chips should use consistent colors: pending=outline, in_progress=primary, done=success
- Wage calculations use existing `calculateWage` and `getActiveRate` functions
