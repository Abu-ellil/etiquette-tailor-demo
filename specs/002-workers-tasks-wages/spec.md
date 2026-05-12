# Feature Specification: Workers, Tasks & Wage Calculation

**Feature Branch**: `002-workers-tasks-wages`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Build Workers management, Order Tasks production tracking, Task Board, Tailor My Tasks view, Cutter Cutting Queue view, seasonal rate overrides, monthly wage totals, and Order Detail page with full task management."

## Design Reference

| File | Purpose |
|------|---------|
| `design/` folder | Contains PLAN.md design references for UI layout and component patterns |
| `PLAN.md` (root) | Full project plan v2 with schema, phases, and business rules |
| `PLAN.md Phase 3` | Workers, Tasks & Wage Calculation — the current phase |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Order Detail Page with Task Management (Priority: P1)

An admin or manager opens an existing order to view its full details: customer info, piece type, price, measurements, and the list of assigned tasks. From this page they can add new tasks (cutting, sewing, design), reassign tasks to different workers, update task statuses, and see the auto-calculated wages per task. This is the central hub for managing production on each order.

**Why this priority**: The Order Detail page is the missing link in the order lifecycle. Orders can be created but there's no way to view or manage the full order with its tasks after creation. Every other feature in this phase (Task Board, Tailor/Cutter views) depends on orders having properly assigned tasks.

**Independent Test**: Can be fully tested by creating an order, navigating to its detail page, adding tasks with worker assignments, and verifying wage calculations are correct. The page should show all order fields, measurements, and the task list with status controls.

**Acceptance Scenarios**:

1. **Given** an order exists in the system, **When** the user clicks the order number or "View" link from the Orders page, **Then** the Order Detail page opens showing: order number, customer name, phone, piece type, details, price, paid, balance (auto), status, due date, payment method, branch, and notes
2. **Given** the Order Detail page is open, **When** the user views the Tasks section, **Then** they see a list of all tasks for this order with columns: Task Type, Assigned Worker, Wage Type, Rate, Wage Amount (auto), Status (chip), Started At, Completed At
3. **Given** the Order Detail page is open, **When** the user clicks "Add Task", **Then** a form appears with fields: Task Type (cutting/sewing/design dropdown), Worker (dropdown of active workers), and the wage is auto-calculated based on the selected worker's rate for this piece type
4. **Given** a task exists on an order, **When** the user changes the assigned worker, **Then** the wage is recalculated using the new worker's rate and the task status resets to pending
5. **Given** a task exists on an order, **When** the user clicks the status control, **Then** the task status advances (pending → in_progress → done) with timestamps recorded
6. **Given** the Order Detail page is open, **When** the user views the Measurements section, **Then** they can see and edit the order's measurements (chest, waist, hips, length, sleeve, shoulder, notes)
7. **Given** the user is logged in as Tailor or Cutter, **When** they try to access an Order Detail page, **Then** price and wage information is hidden from their view
8. **Given** the Order Detail page is open, **When** the user clicks "Edit Order", **Then** the order fields (piece type, details, price, paid, due date, status, payment method) become editable and can be saved

---

### User Story 2 — Tailor "My Tasks" View (Priority: P1)

A tailor logs in and sees only tasks assigned to her. She can view her pending tasks, see which orders need her work, mark tasks as started or completed, and view the measurements for each order. She cannot see any price or wage information.

**Why this priority**: This is the daily working view for tailors — the core production worker in the shop. Without it, tailors have no way to track their work. It also validates the role-based data isolation is working correctly.

**Independent Test**: Can be tested by logging in as a worker with worker_type "tailor", verifying the "My Tasks" page shows only tasks assigned to that worker, and confirming no prices or wages are visible.

**Acceptance Scenarios**:

1. **Given** the user logs in as a worker with worker_type "tailor", **When** they navigate to "My Tasks" from the sidebar, **Then** they see a list of all tasks assigned to them, grouped or sorted by status (in_progress first, then pending, then done today)
2. **Given** the tailor views their task list, **When** they look at a task card, **Then** they see: order number, piece type, notes, and due date — but NO price, balance, or wage information
3. **Given** a task is in "pending" status on the tailor's list, **When** they click "Start", **Then** the task status changes to "in_progress" with a started_at timestamp
4. **Given** a task is in "in_progress" status on the tailor's list, **When** they click "Done", **Then** the task status changes to "done" with a completed_at timestamp
5. **Given** the tailor clicks on a task in their list, **When** they view the order details, **Then** they can see the measurements for that order but no financial information
6. **Given** the tailor has no tasks assigned, **When** they view "My Tasks", **Then** an empty state message "No tasks assigned" is displayed
7. **Given** the sidebar for a tailor user, **When** they view the navigation, **Then** they only see: Dashboard and My Tasks — no Customers, Orders, Workers, or Reports links

---

### User Story 3 — Cutter "Cutting Queue" View (Priority: P1)

A cutter logs in and sees today's cutting queue — all cutting tasks assigned to them, sorted by delivery date (most urgent first). They can mark cutting tasks as done. Like the tailor, they see no price or wage information.

**Why this priority**: Cutters are the other production worker role and need their own focused view. This completes the worker role experience alongside the tailor view.

**Independent Test**: Can be tested by logging in as a worker with worker_type "cutter", verifying the "Cutting Queue" shows only cutting tasks assigned to them sorted by urgency.

**Acceptance Scenarios**:

1. **Given** the user logs in as a worker with worker_type "cutter", **When** they navigate to "Cutting Queue" from the sidebar, **Then** they see all their cutting tasks sorted by delivery date (earliest first)
2. **Given** the cutter views their queue, **When** they look at a task, **Then** they see: order number, piece type, notes, and delivery date — but NO price, balance, or wage information
3. **Given** a cutting task is in "pending" status, **When** the cutter clicks "Done", **Then** the task status changes to "done" with a completed_at timestamp
4. **Given** the cutter has no cutting tasks, **When** they view "Cutting Queue", **Then** an empty state message "No cutting tasks" is displayed
5. **Given** the sidebar for a cutter user, **When** they view the navigation, **Then** they only see: Dashboard and Cutting Queue — no Customers, Orders, Workers, or Reports links

---

### User Story 4 — Task Board (Admin/Manager View) (Priority: P2)

An admin or manager opens the Task Board to see all tasks across all orders. The board shows tasks organized by status (pending, in_progress, done) with color-coded chips. Overdue orders are flagged. They can filter by branch, worker, or task type, and quickly update task statuses or reassign workers.

**Why this priority**: The Task Board gives managers a bird's-eye view of production. While individual task management happens on the Order Detail page, the board shows the overall factory floor status. It's P2 because the Order Detail page is the prerequisite — tasks must exist before the board is useful.

**Independent Test**: Can be tested by creating multiple orders with tasks in different statuses, then verifying the board shows all tasks correctly grouped and color-coded with filter controls working.

**Acceptance Scenarios**:

1. **Given** the user logs in as Admin or Manager, **When** they navigate to the Task Board page, **Then** they see all tasks across all orders, grouped by status columns: Pending, In Progress, Done
2. **Given** tasks exist on the board, **When** the user views a task card, **Then** they see: order number, customer name, piece type, assigned worker name, wage amount, and due date
3. **Given** a task's order delivery date has passed and the task is not done, **When** the user views the board, **Then** the task card shows an "Overdue" badge in red
4. **Given** the Task Board is displayed, **When** the user uses the branch filter, **Then** only tasks from orders in the selected branch are shown
5. **Given** the Task Board is displayed, **When** the user uses the worker filter, **Then** only tasks assigned to the selected worker are shown
6. **Given** the Task Board is displayed, **When** the user uses the task type filter (cutting/sewing/design), **Then** only tasks of that type are shown
7. **Given** the user is a Manager (not Admin), **When** they view the Task Board, **Then** only tasks from their branch are visible
8. **Given** the user is a Manager (not Admin), **When** they view task cards, **Then** wage amounts are hidden from view

---

### User Story 5 — Seasonal Rate Overrides & Monthly Wage Totals (Priority: P2)

An admin sets seasonal rate overrides for workers — higher rates during peak periods like Eid or Ramadan. The worker rates page is enhanced to support date ranges for seasonal rates. Additionally, the Workers page shows monthly wage totals per worker, calculated from completed tasks plus fixed salary.

**Why this priority**: Seasonal rates and wage visibility are important business features but not blocking for daily production. They enhance the existing Worker Rates and Workers pages rather than adding entirely new pages.

**Independent Test**: Can be tested by setting a seasonal rate with a date range, creating a task during that range, and verifying the seasonal rate is used for wage calculation. Monthly wage totals can be verified by checking the Workers page shows the sum of completed task wages.

**Acceptance Scenarios**:

1. **Given** the admin is on the Worker Rates page, **When** they enable seasonal override for a rate, **Then** date range fields (start date, end date) appear for that piece type
2. **Given** a seasonal rate is configured for a worker (e.g., 25% during Ramadan), **When** the system calculates a task wage and the current date falls within the seasonal range, **Then** the seasonal rate is used instead of the standard rate
3. **Given** a seasonal rate is configured, **When** the current date is outside the seasonal range, **Then** the standard rate is used
4. **Given** the admin views the Workers page, **When** they select a month, **Then** each worker card shows their monthly earnings: sum of completed task wages + fixed salary
5. **Given** the admin views a worker's monthly earnings, **When** they click into the details, **Then** they see a breakdown: task count, total from piece rates, fixed salary, and grand total

---

### User Story 6 — Worker Dashboard Enhancement (Priority: P2)

The Dashboard page is enhanced for worker roles. When a tailor or cutter logs in, their dashboard shows relevant task counts and quick-access links to their work. The admin/manager dashboard is also enhanced to show production task summaries.

**Why this priority**: This enhances an existing page rather than creating a new one. The worker role dashboard was listed as a Phase 1 gap — it currently shows the same view for all roles. This brings it in line with the PLAN.md specification.

**Independent Test**: Can be tested by logging in as each role and verifying the dashboard content matches their responsibilities.

**Acceptance Scenarios**:

1. **Given** the user logs in as a tailor, **When** the dashboard loads, **Then** it shows: "My Pending Tasks" count, "Completed Today" count, and a list of assigned tasks with order number, piece type, and notes — no prices visible
2. **Given** the user logs in as a cutter, **When** the dashboard loads, **Then** it shows: cutting queue for today sorted by delivery date, with order number, piece type, and notes only
3. **Given** the user logs in as Admin, **When** the dashboard loads, **Then** it shows: total orders today, orders in progress, ready for pickup, overdue orders, today's revenue, and a production summary showing task counts by status
4. **Given** the user logs in as Manager, **When** the dashboard loads, **Then** it shows the same as Admin but scoped to their branch, and no financial totals (revenue)

---

### Edge Cases

- What happens when a worker has no rate set for a piece type and a task is assigned? → Block task creation with a warning "No rate configured for this worker and piece type. Set a rate first."
- What happens when an order's price is changed after tasks have been created? → Show a prompt "Price changed. Recalculate task wages?" — if confirmed, recalculate all non-done task wages
- What happens when a worker is deactivated while they have active tasks? → Their tasks remain assigned but show a "Worker Inactive" badge. Admin can reassign from the Task Board or Order Detail.
- What happens when a seasonal rate and standard rate both apply? → Seasonal rate always wins during its date range. The standard rate applies outside the range.
- What happens when the tailor/cutter tries to access an order detail page via direct URL? → They can see the measurements and task info but price/wage fields are hidden
- What happens when a task has no worker assigned? → Task shows "Unassigned" in the worker column, wage is 0, and it can be assigned from the Task Board or Order Detail
- What happens when all tasks for an order are marked done? → No automatic order status change. Admin/manager must manually update order status to "Ready" or "Delivered"
- What happens when the monthly wage period has no completed tasks? → Earnings show as 0 (or just fixed salary if applicable)

## Requirements *(mandatory)*

### Functional Requirements

**Order Detail Page**
- **FR-001**: System MUST provide an Order Detail page accessible by clicking an order from the Orders list or navigating to `/orders/:id`
- **FR-002**: System MUST display all order fields on the detail page: order number, customer name, phone, piece type, details, price, paid, balance, status, due date, payment method, branch, notes
- **FR-003**: System MUST display order measurements on the detail page with the ability to edit them
- **FR-004**: System MUST display all tasks for the order with: task type, assigned worker, wage type, rate, wage amount, status chip, started_at, completed_at
- **FR-005**: System MUST allow adding new tasks to an order with task type selection, worker assignment, and auto-calculated wage
- **FR-006**: System MUST allow reassigning a task to a different worker with automatic wage recalculation and status reset to pending
- **FR-007**: System MUST allow updating task status through the workflow: pending → in_progress → done, with timestamps
- **FR-008**: System MUST allow editing order fields (piece type, details, price, paid, due date, status, payment method) from the detail page
- **FR-009**: System MUST recalculate balance automatically when price or paid is edited (balance = price - paid)
- **FR-010**: System MUST hide price and wage information from Tailor and Cutter roles on the Order Detail page

**Tailor My Tasks View**
- **FR-011**: System MUST provide a "My Tasks" page accessible to users with worker_type "tailor", showing only tasks assigned to them
- **FR-012**: System MUST display task cards with: order number, piece type, notes, due date — NO prices or wages
- **FR-013**: System MUST allow tailor to update task status (start/done) with timestamp recording
- **FR-014**: System MUST allow tailor to view order measurements for their assigned tasks (no financial info)
- **FR-015**: System MUST show an empty state when no tasks are assigned
- **FR-016**: System MUST restrict sidebar navigation for tailor role to: Dashboard and My Tasks only

**Cutter Cutting Queue View**
- **FR-017**: System MUST provide a "Cutting Queue" page accessible to users with worker_type "cutter", showing only cutting tasks assigned to them
- **FR-018**: System MUST display cutting tasks sorted by delivery date (earliest first) with: order number, piece type, notes, delivery date — NO prices or wages
- **FR-019**: System MUST allow cutter to mark cutting tasks as done with timestamp recording
- **FR-020**: System MUST show an empty state when no cutting tasks exist
- **FR-021**: System MUST restrict sidebar navigation for cutter role to: Dashboard and Cutting Queue only

**Task Board**
- **FR-022**: System MUST provide a Task Board page for Admin and Manager roles showing all tasks across all orders
- **FR-023**: System MUST display task cards with: order number, customer name, piece type, assigned worker, wage amount, due date
- **FR-024**: System MUST flag overdue tasks (delivery_date passed and task not done) with a visual "Overdue" badge
- **FR-025**: System MUST provide filters: branch, worker, task type (cutting/sewing/design)
- **FR-026**: System MUST scope tasks to the manager's branch when logged in as Manager
- **FR-027**: System MUST hide wage amounts from Manager role on the Task Board

**Seasonal Rate Overrides**
- **FR-028**: System MUST allow setting seasonal rate overrides with a date range (start date, end date) for any worker-piece type combination
- **FR-029**: System MUST use the seasonal rate when calculating wages if the current date falls within the seasonal range
- **FR-030**: System MUST fall back to the standard rate when outside the seasonal range
- **FR-031**: System MUST display seasonal rates distinctly from standard rates on the Worker Rates page

**Monthly Wage Totals**
- **FR-032**: System MUST display monthly wage totals per worker on the Workers page or a dedicated view
- **FR-033**: System MUST calculate total earnings as: sum of completed task wages + fixed salary for the selected month
- **FR-034**: System MUST provide a breakdown: task count, piece-rate earnings, fixed salary, grand total
- **FR-035**: System MUST allow selecting the month/year for wage calculation

**Dashboard Enhancement**
- **FR-036**: System MUST show a tailor-specific dashboard with: pending tasks count, completed today count, assigned task list (no prices)
- **FR-037**: System MUST show a cutter-specific dashboard with: cutting queue for today sorted by delivery date
- **FR-038**: System MUST show an admin dashboard with production task summary (task counts by status)
- **FR-039**: System MUST show a manager dashboard scoped to their branch with production stats but no financial totals

### Key Entities

- **Order Task**: A production step within an order. Key attributes: task_type (cutting/sewing/design), assigned_to (worker), wage_type (percentage/fixed), wage_rate, wage_amount (auto-calculated), status (pending/in_progress/done), started_at, completed_at, notes. Linked to Order. Each order can have multiple tasks.
- **Worker Rate**: Pay structure for a worker per piece type. Key attributes: user_id, piece_type, wage_type (percentage/fixed), rate, season_start, season_end. When season dates are set, the rate only applies during that period; otherwise it's the standard rate.
- **Worker Earnings**: Aggregated monthly data per worker. Calculated as: sum of wage_amount from completed tasks in the period + fixed base_salary. Not stored — computed on demand from order_tasks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can view, edit, and manage any order's full details including tasks in under 2 minutes
- **SC-002**: Wage calculation is always accurate: percentage type = price × (rate/100), fixed type = rate value, with seasonal override correctly applied
- **SC-003**: Tailor sees zero price or wage information anywhere in their view (My Tasks, Dashboard, Order measurements)
- **SC-004**: Cutter sees zero price or wage information anywhere in their view
- **SC-005**: Task Board loads all tasks with filters working in under 1 second for up to 200 orders
- **SC-006**: Monthly wage totals calculate correctly and match manual spreadsheet verification
- **SC-007**: Seasonal rate overrides correctly take priority during their date range and fall back to standard rates outside
- **SC-008**: Role-based navigation correctly restricts: Tailor sees Dashboard + My Tasks, Cutter sees Dashboard + Cutting Queue, Manager sees all production pages, Admin sees everything

## Assumptions

- The database schema, DB layer (workers.ts, orders.ts), and IPC handlers are already implemented and working — including `getOrderTasks`, `createOrderTask`, `updateTaskStatus`, `reassignTask`, `getActiveRate`, `calculateWage`, `getWorkerEarnings`
- The preload script already exposes all necessary API methods for tasks and worker rates
- Workers page (CRUD) and Worker Pay Rates page (standard rates) are already implemented and working
- The app uses react-router-dom v7 with HashRouter for routing
- The app uses Tailwind CSS v4 with the "Bespoke Atelier" design system (Plum primary, Slate secondary, Manrope headlines, Inter body)
- Task types are limited to: cutting, sewing, design — matching the existing `order_tasks` schema
- Worker wage calculation uses the existing `getActiveRate` function which already prioritizes seasonal rates
- The "reassignTask" IPC handler already exists but needs to recalculate wage using the new worker's rate
- Monthly wage totals are computed on-demand from order_tasks data, not stored in a separate table
- The existing NewOrder page auto-creates a single "sewing" task when a worker is assigned — this behavior continues
- Navigation updates for worker roles (My Tasks, Cutting Queue) require changes to AppLayout sidebar and ROLE_ROUTES in App.tsx
