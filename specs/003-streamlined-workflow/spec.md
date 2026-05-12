# Feature Specification: Streamlined Production Workflow

**Feature Branch**: `003-streamlined-workflow`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User request to simplify the order creation flow into a guided wizard: Customer+Measurements → Order → Assign Cutter → Assign Tailors → Payment

## Design Reference

| File | Purpose |
|------|---------|
| `docs/superpowers/plans/2026-04-03-streamlined-workflow.md` | Full implementation plan with tasks |
| `specs/002-workers-tasks-wages/research.md` | UI/UX audit findings applied to this feature |

## User Scenarios

### User Story 1 — Guided Order Creation Wizard (Priority: P0)

A receptionist or admin needs to create a new order for a customer who just walked in. Instead of navigating between 3-4 different pages, they use a single guided wizard:

1. **Step 1 - Customer**: Search existing customers or create a new one inline. Take measurements (chest, waist, hips, length, sleeve, shoulder) right here — no separate page needed.
2. **Step 2 - Order**: Select piece types, quantities, unit prices, delivery date, payment method.
3. **Step 3 - Workers**: Assign a cutter (from master_cutters) and distribute tailoring among available tailors. See wage previews.
4. **Step 4 - Review & Payment**: See full summary, record initial payment, confirm.

**Why this priority**: This is the core daily operation. Currently requires navigating NewOrder → OrderDetail → Assign Workers across multiple page loads. A single wizard reduces the flow from ~15 clicks to ~8 clicks.

### User Story 2 — Cutter Production Flow (Priority: P1)

A master cutter logs in and sees their cutting queue (existing CuttingQueue page). They can see order details and measurements for each task. They mark tasks as done when cutting is complete. This is unchanged from current behavior.

### User Story 3 — Tailor Production Flow (Priority: P1)

A tailor logs in and sees their assigned sewing tasks (existing MyTasks page). They mark tasks as in_progress and done. This is unchanged from current behavior.

### User Story 4 — Admin Status Management (Priority: P1)

After all cutting and sewing tasks are complete, an admin updates the order status to Ready → Delivered and records final payment. This happens on the existing OrderDetail page.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a wizard flow at `/workflow` with 4 steps: Customer, Order, Workers, Confirm
- **FR-002**: Step 1 MUST allow searching existing customers by name/phone with debounced search
- **FR-003**: Step 1 MUST allow creating a new customer inline (name, phone, notes)
- **FR-004**: Step 1 MUST allow taking measurements (6 fields + notes) as part of the customer step
- **FR-005**: Step 2 MUST allow adding multiple order items (piece type, quantity, unit price, fabric source)
- **FR-006**: Step 2 MUST auto-fill unit price from piece type base_price
- **FR-007**: Step 2 MUST require delivery date and payment method before proceeding
- **FR-008**: Step 3 MUST list all master_cutter workers for cutter assignment per item
- **FR-009**: Step 3 MUST list all tailor workers for tailor assignment per item
- **FR-010**: Step 3 MUST fetch and display worker wage rates and calculate wage previews
- **FR-011**: Step 3 MUST require cutter assignment for all items before proceeding
- **FR-012**: Step 3 MUST allow multiple tailors per item with quantity distribution
- **FR-013**: Step 4 MUST show full order summary: customer, measurements, items, worker assignments, total
- **FR-014**: Step 4 MUST allow recording initial payment with auto-calculated balance
- **FR-015**: On submit, system MUST atomically create: order, items, measurements, tasks, and payment in single transaction
- **FR-016**: On success, system MUST navigate to the order detail page
- **FR-017**: "New Order" button in sidebar MUST navigate to `/workflow`
- **FR-018**: Existing `/orders/new` route MUST remain functional for advanced use

### Non-Functional

- **NFR-001**: Wizard step transitions must be instant (< 50ms)
- **NFR-002**: Final submission must complete in < 500ms
- **NFR-003**: Steps must be navigable backward (click completed step indicators)
- **NFR-004**: No new npm packages allowed
- **NFR-005**: No database schema changes

## Success Criteria

- **SC-001**: Admin can create a complete order with customer, measurements, items, cutter, tailors, and payment in under 90 seconds
- **SC-002**: All data created atomically — no partial orders if submission fails
- **SC-003**: Worker tasks appear immediately in cutter/tailor queues after order creation
- **SC-004**: Existing pages (Orders list, OrderDetail, Customers, TaskBoard) continue to work unchanged

## Assumptions

- The existing DB layer (`createOrder`, `createOrderItem`, `createOrderTask`, `addOrderPayment`, `updateOrderMeasurements`) functions work correctly
- A new atomic `createOrderWithTasks` function will wrap these in a SQLite transaction
- Workers page already has master_cutters and tailors with rates configured
- The existing `generateOrderNumber()` function works per-branch
- react-hook-form is available for form validation
- The CuttingQueue and MyTasks pages are already working for production tracking
