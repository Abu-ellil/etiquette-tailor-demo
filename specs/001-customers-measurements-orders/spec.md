# Feature Specification: Customers, Measurements & Orders Management

**Feature Branch**: `001-customers-measurements-orders`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Build full CRUD UI for Customers, Measurements, and Orders pages following the Stitch 'Bespoke Atelier' design system. Includes sidebar navigation, Electron title bar, and all IPC communication."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Management (Priority: P1)

A workshop staff member needs to manage customer records daily. They open the Customers page from the sidebar, see a list of all customers with Name, Phone, and Notes. They can add a new customer via a modal form, edit existing customers, and soft-delete customers. Arabic and English names are supported.

**Why this priority**: Customers are the foundation - every order requires a customer. Without customers, no orders can be created.

**Independent Test**: Can be fully tested by adding/editing/deleting customers through the UI and verifying data persists after app restart.

**Acceptance Scenarios**:

1. **Given** the app is open on the Customers page, **When** the user clicks "Add Customer", **Then** a modal appears with fields: Name (required), Phone, Notes, Branch (A/B)
2. **Given** the Add Customer modal is open, **When** the user fills in the fields and clicks Save, **Then** the customer is added to the list and the modal closes
3. **Given** a customer exists in the list, **When** the user clicks Edit on that customer, **Then** the modal opens pre-filled with the customer's data
4. **Given** a customer exists in the list, **When** the user clicks Delete, **Then** the customer is soft-deleted and removed from the visible list
5. **Given** the customer list is displayed, **When** the user types in the search box, **Then** the list filters by name or phone in real-time

---

### User Story 2 - Order Management with Worker Assignment (Priority: P1)

A staff member creates a new order by selecting a customer, choosing piece type, entering price, paid amount, selecting the responsible worker, and the system auto-calculates the balance and worker wage. The order gets an auto-generated number (A-001 or B-001 based on branch).

**Why this priority**: Orders are the core business transaction - this is the primary daily workflow of the shop.

**Independent Test**: Can be tested by creating orders with different piece types, prices, workers, and verifying balance auto-calculation and order number generation.

**Acceptance Scenarios**:

1. **Given** the user clicks "New Order" (sidebar button or FAB), **When** the New Order page opens, **Then** it shows fields for: Customer (dropdown), Piece Type, Description, Price, Paid, Due Date, Worker (dropdown), Payment Type (Cash/Card), Branch
2. **Given** the New Order form is open, **When** the user enters Price and Paid, **Then** Balance is auto-calculated as (Price - Paid) and displayed
3. **Given** the New Order form is open, **When** the user selects a Worker and enters wage type/rate, **Then** the worker wage is auto-calculated
4. **Given** the user fills all required fields, **When** they click Save, **Then** the order is created with auto-generated order number (A-XXX or B-XXX based on branch)
5. **Given** orders exist, **When** the user views the Orders Tracking page, **Then** they see a table with Order#, Customer, Item, Price, Status (chip), Due Date
6. **Given** orders exist on the tracking page, **When** the user clicks a status filter (All/In Progress/Ready/Delivered), **Then** only orders matching that status are shown
7. **Given** an order exists, **When** the user clicks Edit, **Then** they can update the order details and status
8. **Given** an order exists, **When** the user changes the status to "Ready" or "Delivered", **Then** the status chip updates with the correct color

---

### User Story 3 - Measurements Management (Priority: P2)

A staff member opens a customer's profile to record or update body measurements (chest, waist, hips, length, shoulders, sleeve length, neck) linked to a specific piece type. Multiple measurement sets can exist per customer.

**Why this priority**: Measurements are needed when creating orders but are secondary to the order flow itself. A simple measurement form per customer is sufficient.

**Independent Test**: Can be tested by selecting a customer, adding measurements for a piece type, and verifying they appear when creating an order.

**Acceptance Scenarios**:

1. **Given** the user is on the Customers page, **When** they click "Measurements" on a customer row, **Then** the Measurements page opens for that customer
2. **Given** the Measurements page is open for a customer, **When** the user fills in measurement fields (chest, waist, hips, length, shoulders, sleeve_length, neck, piece_type) and saves, **Then** the measurement set is saved and linked to that customer
3. **Given** a customer has saved measurements, **When** viewing their measurements page, **Then** all measurement sets are listed with piece type and date
4. **Given** a measurement set exists, **When** the user clicks Edit, **Then** the form pre-fills with existing values for updating

---

### User Story 4 - App Shell & Navigation (Priority: P1)

The application has a custom Electron title bar with app name centered, window controls (minimize/maximize/close), a sidebar with navigation links to all pages, and a "New Order" CTA button at the bottom of the sidebar. The active page is highlighted in the sidebar.

**Why this priority**: The app shell and navigation are the foundation that all pages live within. Without it, no page is accessible.

**Independent Test**: Can be tested by clicking each sidebar link and verifying the correct page renders.

**Acceptance Scenarios**:

1. **Given** the app launches, **When** the main window opens, **Then** the custom title bar shows "Etiquette Tailor" centered with minimize/maximize/close buttons on the right
2. **Given** the app is open, **When** the user clicks a sidebar link (Dashboard, Customers, Measurements, Orders, Workers, Worker Rates, Invoice, Reports, Backup), **Then** the corresponding page loads in the main content area
3. **Given** a page is active, **When** viewing the sidebar, **Then** the active page link is highlighted with a white background and purple text
4. **Given** the sidebar is visible, **When** the user clicks "New Order" button at the bottom, **Then** the New Order page opens

---

### Edge Cases

- What happens when the user tries to create an order without selecting a customer? → Form validation shows error on required fields
- What happens when the user enters Paid > Price? → System should allow it (overpayment possible) but show a warning
- What happens when searching customers with Arabic text? → Search works with both Arabic and English
- What happens when the database file is corrupted or missing? → Schema auto-initializes on app start
- What happens when the user tries to delete a customer who has orders? → System should warn but allow soft delete
- What happens when order counters reach A-999? → Counter continues incrementing (A-1000, A-1001...)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a custom Electron title bar with app name centered and window controls (minimize, maximize, close) on the right
- **FR-002**: System MUST provide sidebar navigation with links to: Dashboard, Customers, Measurements, Orders, Workers, Worker Rates, Invoice, Reports, Backup Settings
- **FR-003**: System MUST highlight the active page in the sidebar with distinct styling
- **FR-004**: System MUST provide a "New Order" CTA button at the bottom of the sidebar
- **FR-005**: System MUST display all customers in a table with columns: Name, Phone, Notes, and action buttons (Edit, Measurements, Delete)
- **FR-006**: System MUST provide a modal form for Add/Edit Customer with fields: Name (required), Phone, Notes, Branch (A/B dropdown)
- **FR-007**: System MUST support Arabic and English text in customer names and all data fields
- **FR-008**: System MUST provide real-time search/filter on the Customers page (by name or phone)
- **FR-009**: System MUST auto-calculate Balance as (Price - Paid) and display it in the order form
- **FR-010**: System MUST auto-generate order numbers with branch prefix (A-001, B-001) using per-branch counters
- **FR-011**: System MUST provide a New Order form with fields: Customer (dropdown), Piece Type, Description, Price, Paid, Balance (auto), Due Date, Worker (dropdown), Worker Wage Type (percentage/fixed), Worker Wage Rate, Worker Wage (auto-calculated), Payment Type (Cash/Card), Branch, Notes
- **FR-012**: System MUST auto-calculate worker wage based on: percentage → price × rate/100, fixed → direct value
- **FR-013**: System MUST display orders in a tracking table with columns: Order#, Customer, Item, Price, Status (chip), Due Date, Actions
- **FR-014**: System MUST provide status filter buttons on the Orders page (All, In Progress, Ready, Delivered)
- **FR-015**: System MUST display order status as colored chips: In Progress → primary_fixed bg, Ready → tertiary_fixed bg, Delivered → secondary_container bg
- **FR-016**: System MUST allow updating order status via Edit form
- **FR-017**: System MUST provide a Measurements page per customer with fields: Piece Type, Chest, Waist, Hips, Length, Shoulders, Sleeve Length, Neck, Notes
- **FR-018**: System MUST support multiple measurement sets per customer
- **FR-019**: System MUST perform soft delete (is_deleted = 1) for all delete operations
- **FR-020**: System MUST validate all required fields before saving (customer name, order customer/price/due date/worker/piece type)
- **FR-021**: System MUST use the "Bespoke Atelier" design system with Plum (#763952) primary and Slate (#505f76) secondary colors
- **FR-022**: System MUST use Manrope font for headlines and Inter font for body/UI text
- **FR-023**: System MUST follow the "No-Line" rule - no 1px solid borders for sectioning, use background color shifts instead
- **FR-024**: System MUST provide input fields with surface_container_high (#e7e8e9) background and 2px bottom-only primary highlight on focus

### Key Entities

- **Customer**: name, phone, notes, branch (A/B), timestamps. Soft-deletable.
- **Measurement**: piece_type, chest, waist, hips, length, shoulders, sleeve_length, neck, notes. Linked to Customer.
- **Order**: order_number (auto), customer (FK), worker (FK), piece_type, measurements (FK), price, paid, balance (auto = price - paid), due_date, status (In Progress/Ready/Delivered), payment_type (Cash/Card), branch (A/B), notes. Soft-deletable.
- **Worker**: name, branch (A/B), wage_type (percentage/fixed), wage_rate. Already implemented in DB layer.
- **Order Counter**: branch (A/B), counter (integer). Per-branch auto-increment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can add a new customer in under 30 seconds using the modal form
- **SC-002**: Staff can create a new order with worker assignment in under 1 minute
- **SC-003**: Balance auto-calculation is always accurate (Price - Paid) with no manual input needed
- **SC-004**: Order numbers auto-increment correctly per branch (A-001, A-002... and B-001, B-002...)
- **SC-005**: Worker wage auto-calculates correctly for both percentage and fixed types
- **SC-006**: All Arabic text renders correctly in customer names, notes, and order descriptions
- **SC-007**: The UI matches the Stitch "Bespoke Atelier" design system colors, fonts, and component styles
- **SC-008**: Navigation between all pages works seamlessly with active state indication

## Assumptions

- The database schema and DB layer (customers.ts, orders.ts, workers.ts) are already implemented and working
- IPC handlers in main process are already registered for all CRUD operations
- Preload script already exposes all necessary API methods (getAllCustomers, createCustomer, etc.)
- Workers are already manageable via the DB layer (but no UI yet - that's Phase 002)
- The app will use Electron's frameless window with custom titlebar for the desktop feel
- No authentication/login in this phase - that's Phase 005
- Dashboard page will be a placeholder in this phase (full dashboard in Phase 004)
- react-router-dom or similar routing is acceptable for page navigation
- The Stitch HTML designs in `design/` folder serve as the visual reference for implementation
