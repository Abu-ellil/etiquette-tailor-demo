# Feature Specification: Phase 1 — Foundation

**Feature Branch**: `001-phase-1-foundation`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Build the foundation for Etiquette Tailor: Electron shell with custom title bar, multi-role authentication (4 roles), session management, role-based route guards, role-aware dashboard, onboarding wizard, and full database initialization with seed data."

## Design Reference

| File | Purpose |
|------|---------|
| `design/` folder | Contains PLAN.md design references for UI layout and component patterns |
| `PLAN.md` (root) | Full project plan v2 with schema, phases, and business rules |
| `PLAN.md v2` | Updated business model analysis — the current PLAN.md at root |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Login & Authentication (Priority: P1)

A staff member launches the app and sees a login screen. They enter their username and password. If valid, the app opens to the dashboard scoped to their role. If invalid, an error message appears. On app close, the session is cleared and they must log in again.

**Why this priority**: Authentication is the gateway to every feature. Nothing works without login. This must be implemented first because all subsequent stories depend on having an authenticated user context.

**Independent Test**: Can be fully tested by launching the app, entering seed credentials (admin/admin123), verifying dashboard loads, then closing and reopening to confirm session is cleared.

**Acceptance Scenarios**:

1. **Given** the app is launched for the first time, **When** the main window opens, **Then** a login screen is displayed with username and password fields and a Login button
2. **Given** the login screen is displayed, **When** the user enters username "admin" and password "admin123" and clicks Login, **Then** authentication succeeds and the dashboard loads
3. **Given** the login screen is displayed, **When** the user enters wrong credentials and clicks Login, **Then** an error message "Invalid username or password" is shown and the user stays on the login screen
4. **Given** the user is logged in, **When** they close and reopen the app, **Then** the login screen appears again (session not persisted)
5. **Given** the user is logged in as admin, **When** they click Logout, **Then** the session is cleared and the login screen appears

---

### User Story 2 — Role-Based Dashboard (Priority: P1)

After login, each role sees a different dashboard tailored to their responsibilities. Admin sees total orders, financial summaries, and overdue alerts. Manager sees production stats and task queues. Tailor sees only her assigned tasks. Cutter sees the cutting queue for today.

**Why this priority**: The dashboard is the landing page after login. It must reflect the correct data scope per role, which validates that the entire auth + data isolation pipeline works end to end.

**Independent Test**: Can be tested by creating users with different roles, logging in as each, and verifying the dashboard content matches the role's permissions and data scope.

**Acceptance Scenarios**:

1. **Given** the user logs in as Admin, **When** the dashboard loads, **Then** it displays: total orders today, orders ready for pickup, overdue orders, today's revenue, and last 5 orders across both branches
2. **Given** the user logs in as Manager, **When** the dashboard loads, **Then** it displays: total orders today, orders in progress, ready orders, overdue count, and last 5 orders for their branch
3. **Given** the user logs in as Tailor (worker_type = 'tailor'), **When** the dashboard loads, **Then** it displays: "My Pending Tasks" count, "Completed Today" count, and a list of assigned tasks with order number, piece type, and notes — no prices visible
4. **Given** the user logs in as Cutter (worker_type = 'cutter'), **When** the dashboard loads, **Then** it displays: cutting queue for today sorted by delivery date, with order number, piece type, and notes only
5. **Given** the dashboard has no data yet (fresh DB), **When** it loads, **Then** it shows empty state messages like "No orders yet" rather than broken layouts

---

### User Story 3 — App Shell & Navigation (Priority: P1)

The application has a frameless Electron window with a custom title bar showing "Etiquette Tailor" centered and window controls (minimize, maximize, close) on the right. A sidebar on the left provides navigation to all pages with the active page highlighted. A "New Order" CTA button sits at the bottom of the sidebar.

**Why this priority**: The shell and navigation are the structural container for every page. Without them, no page is accessible. This must be built alongside the login flow.

**Independent Test**: Can be tested by logging in and clicking each sidebar link to verify the correct page renders, the active link is highlighted, and window controls work.

**Acceptance Scenarios**:

1. **Given** the user is logged in, **When** the main window opens, **Then** a custom title bar displays "Etiquette Tailor" centered with minimize, maximize, and close buttons on the right
2. **Given** the app shell is loaded, **When** the user views the sidebar, **Then** they see navigation links: Dashboard, Customers, Orders, Workers (and Workers is only visible to Admin/Manager)
3. **Given** the user clicks a sidebar link, **When** the page loads, **Then** that link is highlighted with distinct active styling
4. **Given** the sidebar is visible, **When** the user clicks "New Order" at the bottom, **Then** the New Order page opens (or a placeholder if not yet implemented)
5. **Given** the user's role is Tailor or Cutter, **When** they view the sidebar, **Then** they only see: Dashboard and My Tasks (no Customers, Workers, or Reports links)

---

### User Story 4 — Onboarding Wizard (Priority: P2)

On first launch with a fresh database, the system detects that no workers or rates are configured and shows an onboarding wizard. The wizard walks the Admin through: (1) confirming branch names and prefixes, (2) adding employee accounts with roles, and (3) setting worker rates per piece type. Order creation is blocked until steps 1–3 are complete.

**Why this priority**: Onboarding ensures the system is properly configured before real work begins. It's P2 because seed data (admin account + branches) already exists from schema init, so the app is functional without it — but production use requires it.

**Independent Test**: Can be tested by deleting the app.db file, relaunching the app, and walking through each wizard step. Verify that order creation is blocked until completion.

**Acceptance Scenarios**:

1. **Given** the app launches with a fresh database (no users beyond seed admin, no workers), **When** the admin logs in, **Then** the onboarding wizard appears automatically
2. **Given** Step 1 of the wizard is shown, **When** the admin confirms the two branch names (الميرة with prefix A, الشارع التجاري with prefix B), **Then** the branches are saved and the wizard advances
3. **Given** Step 2 of the wizard is shown, **When** the admin adds employee accounts (name, username, password, role, branch), **Then** the users are created in the database
4. **Given** Step 3 of the wizard is shown, **When** the admin sets piece rates for each worker, **Then** the rates are saved and the wizard completes
5. **Given** the onboarding wizard has NOT been completed, **When** any user tries to create an order, **Then** the system blocks it with a message "Please complete setup first"
6. **Given** the onboarding wizard HAS been completed, **When** the app relaunches, **Then** the wizard does NOT appear again

---

### User Story 5 — Database Initialization & Seed Data (Priority: P1)

When the app first launches, the SQLite database is created with all required tables. Two branches are seeded (A: الميرة, B: الشارع التجاري) and one admin account is created (username: "admin", password: "admin123"). The database uses WAL mode and foreign keys are enforced.

**Why this priority**: The database is the foundation of everything. Without proper schema initialization and seed data, no other story can function.

**Independent Test**: Can be tested by deleting app.db, launching the app, and verifying the database file is created with correct tables, seed branches, and seed admin account.

**Acceptance Scenarios**:

1. **Given** the app is launched for the first time, **When** the main process starts, **Then** a SQLite database file (app.db) is created in the Electron userData directory
2. **Given** the database is created, **When** the schema initializes, **Then** all tables exist: branches, users, customers, orders, order_measurements, customer_measurement_profiles, order_tasks, worker_rates, invoices
3. **Given** the database is freshly seeded, **When** querying branches, **Then** two branches exist: (الميرة, prefix A) and (الشارع التجاري, prefix B)
4. **Given** the database is freshly seeded, **When** querying users, **Then** one admin account exists with username "admin" and hashed password
5. **Given** the database is already initialized, **When** the app restarts, **Then** schema initialization does NOT re-seed or overwrite existing data

---

### Edge Cases

- What happens when the user enters a blank username or password? → Login button is disabled until both fields have values; form validates before submission
- What happens when the database file is deleted while the app is running? → App crashes gracefully; on next launch, schema reinitializes from scratch
- What happens when the user tries to navigate to a page they don't have access to? → Route guard redirects them to their dashboard with a toast/notification
- What happens when the onboarding wizard is closed/cancelled before completion? → Onboarding reappears on next login; order creation remains blocked
- What happens when multiple users log in on the same machine? → Only one session at a time; new login replaces the previous session
- What happens when the database has data but no workers configured? → Onboarding wizard appears for the admin to add workers and rates
- What happens when the Tailor/Cutter user has no tasks assigned? → Dashboard shows "No tasks assigned" empty state
- What happens if the admin password "admin123" needs to be changed? → Available through user management after onboarding (not part of this phase, but the update function exists in auth.ts)

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Session**
- **FR-001**: System MUST display a login screen as the first view on app launch, with username and password fields
- **FR-002**: System MUST authenticate users against the `users` table with SHA-256 hashed passwords
- **FR-003**: System MUST support 4 roles: admin, manager, reception, worker (with worker_type: tailor, cutter, designer)
- **FR-004**: System MUST store the active session in main-process memory (cleared on app close, not persisted to disk)
- **FR-005**: System MUST expose session state to the renderer via IPC (`auth:getSession`, `auth:logout`)
- **FR-006**: System MUST reject login with invalid credentials and show a clear error message
- **FR-007**: System MUST disable the Login button when username or password fields are empty

**Route Guards & Role Access**
- **FR-008**: System MUST redirect unauthenticated users to the login page regardless of the URL they navigate to
- **FR-009**: System MUST restrict page access by role: Admin sees everything, Manager sees orders/tasks/customers, Tailor sees only Dashboard + My Tasks, Cutter sees only Dashboard + Cutting Queue
- **FR-010**: System MUST hide sidebar navigation links that the user's role cannot access
- **FR-011**: System MUST show a "New Order" CTA button in the sidebar (hidden from Tailor and Cutter roles)

**Database**
- **FR-012**: System MUST initialize SQLite with WAL mode and foreign key enforcement on first launch
- **FR-013**: System MUST create all required tables: branches, users, customers, orders, order_measurements, customer_measurement_profiles, order_tasks, worker_rates, invoices
- **FR-014**: System MUST seed two branches: A (الميرة — أم قرن) and B (الشارع التجاري — أم قرن)
- **FR-015**: System MUST seed one admin account: username "admin", password hashed with SHA-256
- **FR-016**: System MUST NOT re-seed data if the database already contains records

**App Shell**
- **FR-017**: System MUST use a frameless Electron window with a custom title bar component
- **FR-018**: System MUST display "Etiquette Tailor" centered in the title bar with window controls (minimize, maximize, close) on the right
- **FR-019**: System MUST provide a sidebar with navigation links that highlight the active page
- **FR-020**: System MUST make the custom title bar draggable (CSS `-webkit-app-region: drag`) with controls excluded from drag
- **FR-021**: System MUST use react-router-dom for page routing within the renderer

**Dashboard**
- **FR-022**: System MUST display a role-aware dashboard that shows different content based on the logged-in user's role
- **FR-023**: System MUST show Admin dashboard with: total orders today, ready orders, overdue orders, today's revenue, last 5 orders
- **FR-024**: System MUST show Manager dashboard with: total orders today, in-progress count, ready count, overdue count, last 5 orders (scoped to their branch)
- **FR-025**: System MUST show Tailor dashboard with: pending tasks count, completed-today count, and a task list (order number, piece type, notes — no prices)
- **FR-026**: System MUST show Cutter dashboard with: today's cutting queue sorted by delivery date (order number, piece type, notes only)
- **FR-027**: System MUST show empty state messages when no data exists (e.g., "No orders yet", "No tasks assigned")

**Onboarding Wizard**
- **FR-028**: System MUST detect if workers/rates are not configured on admin login and show the onboarding wizard
- **FR-029**: System MUST provide a 3-step wizard: (1) branch confirmation, (2) employee accounts, (3) worker rates
- **FR-030**: System MUST block order creation until onboarding steps 1–3 are completed
- **FR-031**: System MUST NOT show the onboarding wizard again after successful completion
- **FR-032**: System MUST allow cancelling the wizard but re-show it on next admin login

### Key Entities

- **Branch**: Represents a shop location. Key attributes: name_ar, name_en, prefix (A/B), address. Seeded with 2 entries. Used for order number generation and data scoping.
- **User**: A system account with authentication credentials. Key attributes: name, username, password_hash, role (admin/manager/reception/worker), worker_type (tailor/cutter/designer), branch_id. Controls page access and data visibility.
- **Session**: In-memory authentication state. Key attributes: userId, username, name, role, branch_id, worker_type. Not persisted — cleared on app close.
- **Onboarding State**: Tracked by checking if workers and rates exist in the database. Boolean flag determining whether the wizard should appear.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: App launches in under 3 seconds and displays the login screen immediately
- **SC-002**: Admin login with seed credentials (admin/admin123) succeeds and loads the dashboard in under 1 second
- **SC-003**: Invalid login attempt shows error feedback in under 500ms
- **SC-004**: Dashboard displays correct data for each of the 4 roles with no cross-role data leakage
- **SC-005**: Tailor and Cutter roles see zero price information anywhere in their view
- **SC-006**: Onboarding wizard completes in under 5 minutes for a typical 2-branch, 5-employee setup
- **SC-007**: Database schema initializes without errors on a clean machine with no pre-existing data
- **SC-008**: Session is fully cleared on app close — reopening requires re-authentication
- **SC-009**: All navigation between pages works via sidebar clicks with active state clearly indicated
- **SC-010**: Window controls (minimize, maximize, close) function identically to native OS controls

## Assumptions

- The database schema and connection layer (`src/db/connection.ts`, `src/db/schema.ts`) are already implemented and working
- The auth DB layer (`src/db/auth.ts`) with SHA-256 hashing, authenticateUser, and session creation is already implemented
- The preload script (`src/main/preload.ts`) already defines the full ElectronAPI interface with auth, branches, users, workers, customers, and orders channels
- IPC handlers for auth (login, getSession, logout) need to be registered in the main process — some handlers for customers/workers/orders already exist
- The app currently uses Electron Forge (not electron-vite as originally planned) — build tooling is already configured
- react-router-dom is already installed (v7.13.2 in package.json) and available for routing
- Better-sqlite3 is already installed and the schema uses a single `app.db` file (not separate per-branch files as originally planned in PLAN.md)
- Password storage uses SHA-256 hashing (not bcrypt) as implemented in auth.ts — acceptable for an offline desktop app
- The UI uses Tailwind CSS v4 and shadcn/ui components are not yet installed — this phase focuses on functional layout, not polished design system implementation
- No internet connectivity is required — the app is fully offline
- Only one user session active at a time on a single machine (single-window desktop app)
- The onboarding wizard checks for worker/rate records existence, not a separate boolean flag
