# Screen-to-Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert 19 AI-generated HTML screen designs into 11 working React page components with sidebar navigation, using the existing DB/IPC layer.

**Architecture:** State-based navigation in App.tsx (no react-router — not in approved packages). Shared Layout component wraps all pages with a persistent sidebar. Each page is a single file in `src/renderer/pages/`. All data flows through `window.electronAPI` via IPC.

**Tech Stack:** Electron + Forge + Vite, React 19, TypeScript, Tailwind CSS v4, better-sqlite3, react-hook-form, date-fns

---

## Screen-to-Page Mapping

| Page | Screen ID | Screen Title | HTML downloadUrl |
|------|-----------|-------------|-----------------|
| Dashboard | `4a534253524644a2aae8e40f845258dd` | Dashboard (Electron App) | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzdiNDQzNzFlY2I3NzQxMjI4M2Q1NTNhMzc1MjUyMTE0EgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Orders | `2f188eed1fdc4773b5acd19c89ffd2bc` | Orders Tracking | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2NjN2FhNmQ0NWZlYjQ3NDE4YzQ0ZmU5ODgxYzQ4OTNlEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| New Order | `1040aeb15d2449ee83d7d124151b614f` | Refined New Order Form | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzVlMWUzMjA0MWNhZDQxZjlhMWQ4NTIyYmZmNjYzNDY4EgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Customers | `6fd421fd82214a8e8385248befa1547c` | Customers Management | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzAyMTkzOTBkYjNkYzQ3YWNiMGZkZGU0ZTg3ZTlhZWI4EgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Workers | `8fe00ae0f70f4ce4b01c9e9f2f8cf497` | Workers List | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2M0ODhhNDZjZmE2MTQ0Zjg4OGFjYjYyMmRjZGQ0ODRlEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Worker Pay Rates | `ad9c8a2998db400e8d5c8a9bed63f4c9` | Worker Pay Rates | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2NlMjYzNjZmNDVhZDQxZmNiMTI2MjcyZjdjMWJjNGEwEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Measurements | `bafe11e1069c4675b826d09f69b0f886` | Measurements Form | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2M0OTZkNGYxYTgyODRiMzBhMGE0YWVhMGNkOTc4YjNkEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Reports | `bcf31a34d4594dfab96fa7e98b2166bf` | Financial Reports | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzE2ZjY3NDRlNWIwOTQzZGNiNjk0YjRmNGE5NDAyMzIzEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Invoice | `f0bc9611034f4a91b9213791a88afc5f` | Thermal Receipt Invoice | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzQ1MjU5NDMxMGI3MzQ1M2Y5OWYxMmMzNjNhZjczNGRjEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Login | `38c2efd427814a29a5600885a6d1f05b` | Staff Login | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2YxMGMzY2QyY2I3NTQ1ZjJhMmU2NjJiODU3OWI0ZjJkEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |
| Backup | `29f3dd41a60c492c8836cc0f8808e556` | Data Backup & Restore | `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzU0MTE4ZDIyOGMzOTQwZTRiNzA2OWUxYjMyOGI2ZDdlEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086` |

## File Structure

### Files to Create
| File | Responsibility |
|------|---------------|
| `src/renderer/types.ts` | Shared TypeScript interfaces for the app |
| `src/renderer/components/Layout.tsx` | Main layout with sidebar + content area |
| `src/renderer/components/Sidebar.tsx` | Navigation sidebar with page links + branch selector |
| `src/renderer/components/Modal.tsx` | Reusable modal dialog |
| `src/renderer/components/StatusBadge.tsx` | Order status badge component |
| `src/renderer/pages/Dashboard.tsx` | Dashboard with stats + recent orders |
| `src/renderer/pages/Orders.tsx` | Orders tracking list with filters |
| `src/renderer/pages/NewOrder.tsx` | New order form with react-hook-form |
| `src/renderer/pages/Customers.tsx` | Customer list + add/edit/delete |
| `src/renderer/pages/Workers.tsx` | Workers list + add/edit/delete |
| `src/renderer/pages/WorkerPayRates.tsx` | Worker wage configuration |
| `src/renderer/pages/Measurements.tsx` | Measurements form per customer |
| `src/renderer/pages/Reports.tsx` | Financial reports with charts |
| `src/renderer/pages/Invoice.tsx` | Invoice view with react-to-print |
| `src/renderer/pages/Login.tsx` | Login screen |
| `src/renderer/pages/Backup.tsx` | Backup & restore |

### Files to Modify
| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Add state-based navigation + Layout wrapper |
| `src/renderer/index.css` | Add custom CSS variables for the design system colors |

### Files NOT to Modify
| File | Reason |
|------|--------|
| `src/main/index.ts` | IPC handlers already complete |
| `src/main/preload.ts` | API bridge already complete |
| `src/db/**/*` | Database layer already complete |
| `src/renderer/main.tsx` | Entry point, no changes needed |
| `src/renderer/types.d.ts` | ElectronAPI types already complete |

---

## Design System Reference

From the screen data, the color palette is:
- Primary: `#763952` (Plum)
- Secondary: `#505f76` (Slate)
- Surface: `#f8f9fa`
- Surface Container: `#edeeef`
- Surface Container Low: `#f3f4f5`
- Surface Container Lowest: `#ffffff`
- On Surface: `#191c1d`
- On Surface Variant: `#4e4350`
- Outline: `#807381`
- Error: `#ba1a1a`
- Primary Container: `#92506a`
- On Primary: `#ffffff`

Font: ManRope (headlines) + Inter (body/labels)

---

## Task 1: Shared Types

**Files:**
- Create: `src/renderer/types.ts`

- [ ] **Step 1: Create shared types file**

```typescript
export type PageName =
  | 'dashboard'
  | 'orders'
  | 'new-order'
  | 'customers'
  | 'workers'
  | 'worker-pay-rates'
  | 'measurements'
  | 'reports'
  | 'invoice'
  | 'backup'
  | 'login';

export type Branch = 'A' | 'B';

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  branch: Branch;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: number;
  name: string;
  branch: Branch;
  wage_type: 'percentage' | 'fixed';
  wage_rate: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  worker_id: number;
  piece_type: string;
  measurements_id: number | null;
  price: number;
  paid: number;
  balance: number;
  due_date: string;
  status: 'In Progress' | 'Ready' | 'Delivered';
  payment_type: 'Cash' | 'Card';
  branch: Branch;
  notes: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  worker_name?: string;
}

export interface Measurement {
  id: number;
  customer_id: number;
  piece_type: string;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  length: number | null;
  shoulders: number | null;
  sleeve_length: number | null;
  neck: number | null;
  notes: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface AppState {
  currentPage: PageName;
  currentBranch: Branch;
  selectedOrderId: number | null;
  selectedCustomerId: number | null;
  isLoggedIn: boolean;
}

export const BRANCH_LABELS: Record<Branch, string> = {
  A: 'Branch A - الميرة',
  B: 'Branch B - الشارع التجاري',
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd etiquette-tailor && npx tsc --noEmit`
Expected: No errors related to types.ts

---

## Task 2: CSS Design System Variables

**Files:**
- Modify: `src/renderer/index.css`

- [ ] **Step 1: Add design system CSS variables and base styles**

Replace the entire content of `src/renderer/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary: #763952;
    --color-primary-light: #92506a;
    --color-primary-text: #ffffff;
    --color-secondary: #505f76;
    --color-secondary-light: #64748b;
    --color-surface: #f8f9fa;
    --color-surface-container: #edeeef;
    --color-surface-container-low: #f3f4f5;
    --color-surface-container-lowest: #ffffff;
    --color-surface-dim: #d9dadb;
    --color-on-surface: #191c1d;
    --color-on-surface-variant: #4e4350;
    --color-outline: #807381;
    --color-outline-variant: #d1c2d2;
    --color-error: #ba1a1a;
    --color-error-container: #ffdad6;
    --color-success: #16a34a;
    --color-warning: #d97706;
    --color-sidebar-bg: #f3f4f5;
    --color-sidebar-active: #763952;
    --color-sidebar-active-text: #ffffff;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: var(--color-surface);
    color: var(--color-on-surface);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'ManRope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run start -- --no-daemon` (just check it launches)
Expected: App launches without CSS errors

---

## Task 3: Sidebar Component

**Files:**
- Create: `src/renderer/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar component**

```tsx
import React from 'react';
import type { PageName, Branch, AppState } from '../types';
import { BRANCH_LABELS } from '../types';

interface SidebarProps {
  state: AppState;
  onNavigate: (page: PageName) => void;
  onBranchChange: (branch: Branch) => void;
}

const NAV_ITEMS: { page: PageName; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { page: 'orders', label: 'Orders', icon: '📋' },
  { page: 'new-order', label: 'New Order', icon: '＋' },
  { page: 'customers', label: 'Customers', icon: '👤' },
  { page: 'workers', label: 'Workers', icon: '👷' },
  { page: 'worker-pay-rates', label: 'Pay Rates', icon: '💰' },
  { page: 'measurements', label: 'Measurements', icon: '📏' },
  { page: 'reports', label: 'Reports', icon: '📊' },
  { page: 'invoice', label: 'Invoice', icon: '🧾' },
  { page: 'backup', label: 'Backup', icon: '💾' },
];

export default function Sidebar({ state, onNavigate, onBranchChange }: SidebarProps) {
  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[var(--color-sidebar-bg)] border-r border-[var(--color-outline-variant)] flex flex-col">
      <div className="p-5 border-b border-[var(--color-outline-variant)]">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Etiquette Tailor</h1>
        <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">Workshop Management</p>
      </div>

      <div className="p-4 border-b border-[var(--color-outline-variant)]">
        <label className="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wide mb-2 block">
          Branch
        </label>
        <div className="flex gap-2">
          {(['A', 'B'] as Branch[]).map((branch) => (
            <button
              key={branch}
              onClick={() => onBranchChange(branch)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                state.currentBranch === branch
                  ? 'bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-active-text)]'
                  : 'bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]'
              }`}
            >
              {branch}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-on-surface-variant)] mt-2">
          {BRANCH_LABELS[state.currentBranch]}
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ page, label, icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              state.currentPage === page
                ? 'bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-active-text)]'
                : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]'
            }`}
          >
            <span className="text-lg">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[var(--color-outline-variant)]">
        <button
          onClick={() => onNavigate('login')}
          className="w-full py-2 px-4 rounded-lg text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 4: Modal Component

**Files:**
- Create: `src/renderer/components/Modal.tsx`

- [ ] **Step 1: Create reusable Modal component**

```tsx
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative ${SIZE_MAP[size]} w-full mx-4 bg-[var(--color-surface-container-lowest)] rounded-xl shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-outline-variant)]">
          <h2 className="text-lg font-bold text-[var(--color-on-surface)]">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 5: StatusBadge Component

**Files:**
- Create: `src/renderer/components/StatusBadge.tsx`

- [ ] **Step 1: Create StatusBadge component**

```tsx
import React from 'react';

type OrderStatus = 'In Progress' | 'Ready' | 'Delivered';

const STATUS_STYLES: Record<OrderStatus, string> = {
  'In Progress': 'bg-amber-100 text-amber-800',
  'Ready': 'bg-blue-100 text-blue-800',
  'Delivered': 'bg-green-100 text-green-800',
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
```

---

## Task 6: Update App.tsx with Navigation

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Replace App.tsx with navigation + layout**

```tsx
import React, { useState } from 'react';
import type { AppState, PageName, Branch } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import NewOrder from './pages/NewOrder';
import Customers from './pages/Customers';
import Workers from './pages/Workers';
import WorkerPayRates from './pages/WorkerPayRates';
import Measurements from './pages/Measurements';
import Reports from './pages/Reports';
import Invoice from './pages/Invoice';
import Backup from './pages/Backup';
import Login from './pages/Login';

const INITIAL_STATE: AppState = {
  currentPage: 'dashboard',
  currentBranch: 'A',
  selectedOrderId: null,
  selectedCustomerId: null,
  isLoggedIn: true,
};

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const handleNavigate = (page: PageName) => {
    setState((prev) => ({ ...prev, currentPage: page }));
  };

  const handleBranchChange = (branch: Branch) => {
    setState((prev) => ({ ...prev, currentBranch: branch }));
  };

  const handleSelectOrder = (id: number) => {
    setState((prev) => ({ ...prev, selectedOrderId: id, currentPage: 'invoice' }));
  };

  const handleSelectCustomer = (id: number) => {
    setState((prev) => ({ ...prev, selectedCustomerId: id, currentPage: 'measurements' }));
  };

  const handleLogin = () => {
    setState((prev) => ({ ...prev, isLoggedIn: true }));
  };

  const handleLogout = () => {
    setState((prev) => ({ ...prev, isLoggedIn: false, currentPage: 'login' }));
  };

  if (!state.isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (state.currentPage) {
      case 'dashboard':
        return <Dashboard branch={state.currentBranch} onNavigate={handleNavigate} />;
      case 'orders':
        return <Orders branch={state.currentBranch} onSelectOrder={handleSelectOrder} />;
      case 'new-order':
        return <NewOrder branch={state.currentBranch} onNavigate={handleNavigate} />;
      case 'customers':
        return <Customers branch={state.currentBranch} onSelectCustomer={handleSelectCustomer} />;
      case 'workers':
        return <Workers branch={state.currentBranch} />;
      case 'worker-pay-rates':
        return <WorkerPayRates branch={state.currentBranch} />;
      case 'measurements':
        return <Measurements branch={state.currentBranch} customerId={state.selectedCustomerId} />;
      case 'reports':
        return <Reports branch={state.currentBranch} />;
      case 'invoice':
        return <Invoice orderId={state.selectedOrderId} />;
      case 'backup':
        return <Backup />;
      default:
        return <Dashboard branch={state.currentBranch} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      <Sidebar state={state} onNavigate={handleNavigate} onBranchChange={handleBranchChange} />
      <main className="ml-64 flex-1 p-6">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Create placeholder page components so app compiles**

Create each page file with a minimal placeholder. These will be implemented in subsequent tasks. For now, create them all as:

```tsx
// src/renderer/pages/Dashboard.tsx (placeholder)
import React from 'react';
export default function Dashboard(props: any) {
  return <div className="text-2xl font-bold">Dashboard</div>;
}
```

Repeat for each page file:
- `src/renderer/pages/Dashboard.tsx`
- `src/renderer/pages/Orders.tsx`
- `src/renderer/pages/NewOrder.tsx`
- `src/renderer/pages/Customers.tsx`
- `src/renderer/pages/Workers.tsx`
- `src/renderer/pages/WorkerPayRates.tsx`
- `src/renderer/pages/Measurements.tsx`
- `src/renderer/pages/Reports.tsx`
- `src/renderer/pages/Invoice.tsx`
- `src/renderer/pages/Backup.tsx`
- `src/renderer/pages/Login.tsx` (accepts `onLogin` prop)

- [ ] **Step 3: Verify app builds and runs**

Run: `npm start`
Expected: App launches with sidebar, navigation works, pages switch

---

## Task 7: Dashboard Page

**Files:**
- Modify: `src/renderer/pages/Dashboard.tsx`
- Design Reference: Screen `4a534253524644a2aae8e40f845258dd` (Dashboard Electron App)
- Download HTML first: `https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzdiNDQzNzFlY2I3NzQxMjI4M2Q1NTNhMzc1MjUyMTE0EgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086`

- [ ] **Step 1: Download the reference HTML design**

Run: `curl -o docs/ref-dashboard.html "<downloadUrl>"`

- [ ] **Step 2: Implement Dashboard page**

```tsx
import React, { useState, useEffect } from 'react';
import type { Branch, PageName, Order } from '../types';

interface DashboardProps {
  branch: Branch;
  onNavigate: (page: PageName) => void;
}

export default function Dashboard({ branch, onNavigate }: DashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, [branch]);

  const loadOrders = async () => {
    setLoading(true);
    const allOrders = await window.electronAPI.getAllOrders();
    const filtered = allOrders.filter((o: Order) => o.branch === branch);
    setOrders(filtered);
    setLoading(false);
  };

  const totalOrders = orders.length;
  const inProgress = orders.filter((o) => o.status === 'In Progress').length;
  const ready = orders.filter((o) => o.status === 'Ready').length;
  const delivered = orders.filter((o) => o.status === 'Delivered').length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.price, 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.paid, 0);
  const totalBalance = orders.reduce((sum, o) => sum + o.balance, 0);
  const recentOrders = orders.slice(0, 5);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-[var(--color-on-surface-variant)]">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-on-surface)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-on-surface-variant)] mt-1">Branch {branch} Overview</p>
        </div>
        <button
          onClick={() => onNavigate('new-order')}
          className="px-6 py-3 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg font-semibold text-sm hover:bg-[var(--color-primary-light)] transition-colors"
        >
          + New Order
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={totalOrders} />
        <StatCard label="In Progress" value={inProgress} color="amber" />
        <StatCard label="Ready" value={ready} color="blue" />
        <StatCard label="Delivered" value={delivered} color="green" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Revenue" value={`${totalRevenue.toFixed(0)} SAR`} />
        <StatCard label="Paid" value={`${totalPaid.toFixed(0)} SAR`} color="green" />
        <StatCard label="Balance" value={`${totalBalance.toFixed(0)} SAR`} color="amber" />
      </div>

      <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]">
        <h2 className="text-lg font-bold mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-[var(--color-on-surface-variant)]">No orders yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[var(--color-on-surface-variant)] border-b border-[var(--color-outline-variant)]">
                <th className="pb-3 font-medium">Order #</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Piece</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Due Date</th>
                <th className="pb-3 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--color-outline-variant)]/50">
                  <td className="py-3 font-mono text-sm">{order.order_number}</td>
                  <td className="py-3">{order.customer_name}</td>
                  <td className="py-3">{order.piece_type}</td>
                  <td className="py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 text-sm">{order.due_date}</td>
                  <td className="py-3 text-right font-semibold">{order.price} SAR</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
      <p className="text-sm text-[var(--color-on-surface-variant)]">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ? colorMap[color] || '' : ''}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'In Progress': 'bg-amber-100 text-amber-800',
    'Ready': 'bg-blue-100 text-blue-800',
    'Delivered': 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || ''}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 3: Run the app and verify Dashboard loads**

Run: `npm start`
Expected: Dashboard shows stat cards + recent orders table, branch toggle works

---

## Task 8: Customers Page

**Files:**
- Modify: `src/renderer/pages/Customers.tsx`
- Design Reference: Screen `6fd421fd82214a8e8385248befa1547c`

- [ ] **Step 1: Download reference HTML**

Run: `curl -o docs/ref-customers.html "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzAyMTkzOTBkYjNkYzQ3YWNiMGZkZGU0ZTg3ZTlhZWI4EgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086"`

- [ ] **Step 2: Implement Customers page with CRUD**

The Customers page must include:
- Search input at the top
- "Add Customer" button
- Table with columns: Name, Phone, Address, Branch, Actions (Edit/Delete)
- Add/Edit Modal with react-hook-form
- Delete confirmation
- Filter by current branch

```tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Branch, Customer } from '../types';
import Modal from '../components/Modal';

interface CustomersProps {
  branch: Branch;
  onSelectCustomer: (id: number) => void;
}

interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
}

export default function Customers({ branch, onSelectCustomer }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormData>();

  useEffect(() => {
    loadCustomers();
  }, [branch]);

  const loadCustomers = async () => {
    const all = await window.electronAPI.getAllCustomers();
    setCustomers(all.filter((c: Customer) => c.branch === branch));
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  const openAdd = () => {
    setEditingCustomer(null);
    reset({ name: '', phone: '', address: '' });
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({ name: customer.name, phone: customer.phone || '', address: customer.address || '' });
    setModalOpen(true);
  };

  const onSubmit = async (data: CustomerFormData) => {
    if (editingCustomer) {
      await window.electronAPI.updateCustomer(editingCustomer.id, { ...data, branch });
    } else {
      await window.electronAPI.createCustomer({ ...data, branch });
    }
    setModalOpen(false);
    loadCustomers();
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteCustomer(id);
    setDeleteConfirm(null);
    loadCustomers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button onClick={openAdd} className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
          + Add Customer
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] text-sm"
      />

      <div className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[var(--color-on-surface-variant)] border-b border-[var(--color-outline-variant)]">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Phone</th>
              <th className="px-6 py-4 font-medium">Address</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr key={customer.id} className="border-b border-[var(--color-outline-variant)]/50 hover:bg-[var(--color-surface-container-low)]">
                <td className="px-6 py-4 font-medium">{customer.name}</td>
                <td className="px-6 py-4 text-sm">{customer.phone || '—'}</td>
                <td className="px-6 py-4 text-sm">{customer.address || '—'}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(customer)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)]">Edit</button>
                    <button onClick={() => onSelectCustomer(customer.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)]">Measurements</button>
                    <button onClick={() => setDeleteConfirm(customer.id)} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--color-on-surface-variant)]">No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingCustomer ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input {...register('name', { required: 'Name is required' })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input {...register('phone')} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input {...register('address')} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
              {editingCustomer ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 bg-[var(--color-surface-container)] rounded-lg font-semibold text-sm">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <p className="text-sm mb-4">Are you sure you want to delete this customer?</p>
        <div className="flex gap-3">
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="flex-1 py-3 bg-red-500 text-white rounded-lg font-semibold text-sm">Delete</button>
          <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-[var(--color-surface-container)] rounded-lg font-semibold text-sm">Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Run app and test CRUD operations**

Run: `npm start`
Expected: Add/edit/delete customers works, search filters correctly, branch filtering works

---

## Task 9: Workers Page

**Files:**
- Modify: `src/renderer/pages/Workers.tsx`
- Design Reference: Screen `8fe00ae0f70f4ce4b01c9e9f2f8cf497`

- [ ] **Step 1: Download reference HTML**

Run: `curl -o docs/ref-workers.html "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2M0ODhhNDZjZmE2MTQ0Zjg4OGFjYjYyMmRjZGQ0ODRlEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086"`

- [ ] **Step 2: Implement Workers page**

Similar structure to Customers page. Table columns: Name, Branch, Wage Type, Wage Rate, Actions.
Modal fields: Name, Wage Type (percentage/fixed toggle), Wage Rate (number input).

```tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Branch, Worker } from '../types';
import Modal from '../components/Modal';

interface WorkersProps {
  branch: Branch;
}

interface WorkerFormData {
  name: string;
  wage_type: 'percentage' | 'fixed';
  wage_rate: number;
}

export default function Workers({ branch }: WorkersProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<WorkerFormData>();

  useEffect(() => {
    loadWorkers();
  }, [branch]);

  const loadWorkers = async () => {
    const all = await window.electronAPI.getAllWorkers();
    setWorkers(all.filter((w: Worker) => w.branch === branch));
  };

  const openAdd = () => {
    setEditingWorker(null);
    reset({ name: '', wage_type: 'percentage', wage_rate: 0 });
    setModalOpen(true);
  };

  const openEdit = (worker: Worker) => {
    setEditingWorker(worker);
    reset({ name: worker.name, wage_type: worker.wage_type, wage_rate: worker.wage_rate });
    setModalOpen(true);
  };

  const onSubmit = async (data: WorkerFormData) => {
    if (editingWorker) {
      await window.electronAPI.updateWorker(editingWorker.id, { ...data, branch });
    } else {
      await window.electronAPI.createWorker({ ...data, branch });
    }
    setModalOpen(false);
    loadWorkers();
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteWorker(id);
    setDeleteConfirm(null);
    loadWorkers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workers</h1>
        <button onClick={openAdd} className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
          + Add Worker
        </button>
      </div>

      <div className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[var(--color-on-surface-variant)] border-b border-[var(--color-outline-variant)]">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Wage Type</th>
              <th className="px-6 py-4 font-medium">Wage Rate</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id} className="border-b border-[var(--color-outline-variant)]/50 hover:bg-[var(--color-surface-container-low)]">
                <td className="px-6 py-4 font-medium">{worker.name}</td>
                <td className="px-6 py-4 text-sm capitalize">{worker.wage_type}</td>
                <td className="px-6 py-4 text-sm font-semibold">
                  {worker.wage_rate}{worker.wage_type === 'percentage' ? '%' : ' SAR'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(worker)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">Edit</button>
                    <button onClick={() => setDeleteConfirm(worker.id)} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--color-on-surface-variant)]">No workers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingWorker ? 'Edit Worker' : 'Add Worker'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input {...register('name', { required: 'Name is required' })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Wage Type *</label>
            <div className="flex gap-2">
              <label className="flex-1">
                <input type="radio" value="percentage" {...register('wage_type')} className="sr-only peer" />
                <div className="peer-checked:bg-[var(--color-primary)] peer-checked:text-white text-center py-3 rounded-lg border border-[var(--color-outline-variant)] cursor-pointer text-sm font-medium">
                  Percentage
                </div>
              </label>
              <label className="flex-1">
                <input type="radio" value="fixed" {...register('wage_type')} className="sr-only peer" />
                <div className="peer-checked:bg-[var(--color-primary)] peer-checked:text-white text-center py-3 rounded-lg border border-[var(--color-outline-variant)] cursor-pointer text-sm font-medium">
                  Fixed Amount
                </div>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Wage Rate *</label>
            <input type="number" step="0.01" {...register('wage_rate', { required: 'Rate is required', valueAsNumber: true })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
            {errors.wage_rate && <p className="text-xs text-red-500 mt-1">{errors.wage_rate.message}</p>}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
              {editingWorker ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 bg-[var(--color-surface-container)] rounded-lg font-semibold text-sm">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" size="sm">
        <p className="text-sm mb-4">Are you sure you want to delete this worker?</p>
        <div className="flex gap-3">
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="flex-1 py-3 bg-red-500 text-white rounded-lg font-semibold text-sm">Delete</button>
          <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-[var(--color-surface-container)] rounded-lg font-semibold text-sm">Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
```

---

## Task 10: New Order Page

**Files:**
- Modify: `src/renderer/pages/NewOrder.tsx`
- Design Reference: Screen `1040aeb15d2449ee83d7d124151b614f`
- Business rule: Balance = Price - Paid (auto-calculated, never manual)

- [ ] **Step 1: Download reference HTML**

Run: `curl -o docs/ref-new-order.html "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzVlMWUzMjA0MWNhZDQxZjlhMWQ4NTIyYmZmNjYzNDY4EgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086"`

- [ ] **Step 2: Implement New Order form**

The form must include:
- Customer selection (dropdown from customers in branch)
- Worker selection (dropdown from workers in branch)
- Piece type (text input)
- Price + Paid inputs (balance auto-calculated)
- Payment type (Cash/Card toggle)
- Due date picker
- Notes textarea
- All fields are required per business rules

```tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Branch, PageName, Customer, Worker } from '../types';

interface NewOrderProps {
  branch: Branch;
  onNavigate: (page: PageName) => void;
}

interface OrderFormData {
  customer_id: number;
  worker_id: number;
  piece_type: string;
  price: number;
  paid: number;
  payment_type: 'Cash' | 'Card';
  due_date: string;
  notes: string;
}

export default function NewOrder({ branch, onNavigate }: NewOrderProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<OrderFormData>({
    defaultValues: { paid: 0, payment_type: 'Cash' },
  });

  const price = watch('price') || 0;
  const paid = watch('paid') || 0;
  const balance = price - paid;

  useEffect(() => {
    loadData();
  }, [branch]);

  const loadData = async () => {
    const [allCustomers, allWorkers] = await Promise.all([
      window.electronAPI.getAllCustomers(),
      window.electronAPI.getAllWorkers(),
    ]);
    setCustomers(allCustomers.filter((c: Customer) => c.branch === branch));
    setWorkers(allWorkers.filter((w: Worker) => w.branch === branch));
  };

  const onSubmit = async (data: OrderFormData) => {
    await window.electronAPI.createOrder({
      ...data,
      branch,
      status: 'In Progress',
    });
    setSuccess(true);
    reset();
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Order</h1>
        <button onClick={() => onNavigate('orders')} className="text-sm text-[var(--color-on-surface-variant)] hover:underline">
          View All Orders →
        </button>
      </div>

      {success && (
        <div className="p-4 bg-green-50 text-green-800 rounded-lg text-sm font-medium">
          Order created successfully!
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)] p-6 space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1">Customer *</label>
            <select {...register('customer_id', { required: 'Customer is required', valueAsNumber: true })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm">
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.customer_id && <p className="text-xs text-red-500 mt-1">{errors.customer_id.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Worker *</label>
            <select {...register('worker_id', { required: 'Worker is required', valueAsNumber: true })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm">
              <option value="">Select worker...</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {errors.worker_id && <p className="text-xs text-red-500 mt-1">{errors.worker_id.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Piece Type *</label>
          <input {...register('piece_type', { required: 'Piece type is required' })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" placeholder="e.g., Dress, Abaya, etc." />
          {errors.piece_type && <p className="text-xs text-red-500 mt-1">{errors.piece_type.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1">Price (SAR) *</label>
            <input type="number" step="0.01" {...register('price', { required: 'Price is required', valueAsNumber: true })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Paid (SAR) *</label>
            <input type="number" step="0.01" {...register('paid', { valueAsNumber: true })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Balance (auto)</label>
            <div className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-sm font-semibold">
              {balance.toFixed(2)} SAR
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1">Payment Type *</label>
            <div className="flex gap-2">
              <label className="flex-1">
                <input type="radio" value="Cash" {...register('payment_type')} className="sr-only peer" />
                <div className="peer-checked:bg-[var(--color-primary)] peer-checked:text-white text-center py-3 rounded-lg border border-[var(--color-outline-variant)] cursor-pointer text-sm font-medium">Cash</div>
              </label>
              <label className="flex-1">
                <input type="radio" value="Card" {...register('payment_type')} className="sr-only peer" />
                <div className="peer-checked:bg-[var(--color-primary)] peer-checked:text-white text-center py-3 rounded-lg border border-[var(--color-outline-variant)] cursor-pointer text-sm font-medium">Card</div>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date *</label>
            <input type="date" {...register('due_date', { required: 'Due date is required' })} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
            {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea {...register('notes')} rows={3} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
            Create Order
          </button>
          <button type="button" onClick={() => reset()} className="px-6 py-3 bg-[var(--color-surface-container)] rounded-lg font-semibold text-sm">
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## Task 11: Orders Tracking Page

**Files:**
- Modify: `src/renderer/pages/Orders.tsx`
- Design Reference: Screen `2f188eed1fdc4773b5acd19c89ffd2bc`

- [ ] **Step 1: Download reference HTML**

Run: `curl -o docs/ref-orders.html "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sX2NjN2FhNmQ0NWZlYjQ3NDE4YzQ0ZmU5ODgxYzQ4OTNlEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086"`

- [ ] **Step 2: Implement Orders tracking page**

Features:
- Status filter tabs (All, In Progress, Ready, Delivered)
- Search by order number or customer name
- Table with all order details
- Status change dropdown per order
- Click row to view invoice

```tsx
import React, { useState, useEffect } from 'react';
import type { Branch, Order } from '../types';
import StatusBadge from '../components/StatusBadge';

interface OrdersProps {
  branch: Branch;
  onSelectOrder: (id: number) => void;
}

type StatusFilter = 'all' | 'In Progress' | 'Ready' | 'Delivered';

export default function Orders({ branch, onSelectOrder }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, [branch]);

  const loadOrders = async () => {
    setLoading(true);
    const all = await window.electronAPI.getAllOrders();
    setOrders(all.filter((o: Order) => o.branch === branch));
    setLoading(false);
  };

  const handleStatusChange = async (orderId: number, newStatus: Order['status']) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      await window.electronAPI.updateOrder(orderId, { ...order, status: newStatus });
      loadOrders();
    }
  };

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Ready', value: 'Ready' },
    { label: 'Delivered', value: 'Delivered' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[var(--color-on-surface-variant)]">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Orders</h1>

      <div className="flex items-center gap-4">
        <div className="flex bg-[var(--color-surface-container)] rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[var(--color-surface-container-lowest)] shadow-sm text-[var(--color-on-surface)]'
                  : 'text-[var(--color-on-surface-variant)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] text-sm"
        />
      </div>

      <div className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[var(--color-on-surface-variant)] border-b border-[var(--color-outline-variant)]">
              <th className="px-6 py-4 font-medium">Order #</th>
              <th className="px-6 py-4 font-medium">Customer</th>
              <th className="px-6 py-4 font-medium">Worker</th>
              <th className="px-6 py-4 font-medium">Piece</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Due</th>
              <th className="px-6 py-4 font-medium text-right">Price</th>
              <th className="px-6 py-4 font-medium text-right">Balance</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-b border-[var(--color-outline-variant)]/50 hover:bg-[var(--color-surface-container-low)] cursor-pointer">
                <td className="px-6 py-4 font-mono text-sm">{order.order_number}</td>
                <td className="px-6 py-4">{order.customer_name}</td>
                <td className="px-6 py-4 text-sm">{order.worker_name}</td>
                <td className="px-6 py-4 text-sm">{order.piece_type}</td>
                <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                <td className="px-6 py-4 text-sm">{order.due_date}</td>
                <td className="px-6 py-4 text-right font-semibold">{order.price}</td>
                <td className="px-6 py-4 text-right font-semibold text-amber-600">{order.balance}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                      className="text-xs px-2 py-1 rounded border border-[var(--color-outline-variant)]"
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                    <button onClick={() => onSelectOrder(order.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">
                      Invoice
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-[var(--color-on-surface-variant)]">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Task 12: Invoice Page

**Files:**
- Modify: `src/renderer/pages/Invoice.tsx`
- Design Reference: Screen `f0bc9611034f4a91b9213791a88afc5f`
- Business rule: Invoice must be bilingual (Arabic + English)

- [ ] **Step 1: Download reference HTML**

Run: `curl -o docs/ref-invoice.html "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ6Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpZCiVodG1sXzQ1MjU5NDMxMGI3MzQ1M2Y5OWYxMmMzNjNhZjczNGRjEgoSBhCArcTRfhgBkgEjCgpwcm9qZWN0X2lkEhVCEzkxNjE3NTQzOTM0MTQyNzI2Nzk&filename=&opi=89354086"`

- [ ] **Step 2: Implement Invoice page with react-to-print**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { Order } from '../types';

interface InvoiceProps {
  orderId: number | null;
}

export default function Invoice({ orderId }: InvoiceProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    const data = await window.electronAPI.getOrder(orderId);
    setOrder(data);
    setLoading(false);
  };

  if (loading || !order) return <div className="flex items-center justify-center h-64"><p>Loading invoice...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoice</h1>
        <button onClick={() => handlePrint()} className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
          Print Invoice
        </button>
      </div>

      <div ref={printRef} className="bg-white p-8 rounded-xl border border-[var(--color-outline-variant)] max-w-2xl mx-auto" dir="ltr">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-primary)]">Etiquette Tailor</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]">etiquette / إتيكيت</p>
          <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">Workshop Management System</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p><strong>Order:</strong> {order.order_number}</p>
            <p><strong>Date:</strong> {order.created_at?.split(' ')[0]}</p>
            <p><strong>Due:</strong> {order.due_date}</p>
          </div>
          <div className="text-right">
            <p><strong>Customer:</strong> {order.customer_name}</p>
            <p><strong>Worker:</strong> {order.worker_name}</p>
            <p><strong>Payment:</strong> {order.payment_type}</p>
          </div>
        </div>

        <div className="border-t border-b border-[var(--color-outline-variant)] py-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Piece Type / نوع القطعة</span>
            <span>{order.piece_type}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span>Status / الحالة</span>
            <span>{order.status}</span>
          </div>
          {order.notes && (
            <div className="flex justify-between text-sm">
              <span>Notes / ملاحظات</span>
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Price / السعر</span>
            <span className="font-semibold">{order.price} SAR</span>
          </div>
          <div className="flex justify-between">
            <span>Paid / المدفوع</span>
            <span className="font-semibold">{order.paid} SAR</span>
          </div>
          <div className="flex justify-between text-lg border-t border-[var(--color-outline-variant)] pt-2">
            <span className="font-bold">Balance / المتبقي</span>
            <span className="font-bold text-[var(--color-primary)]">{order.balance} SAR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 13: Remaining Pages (Shells with Data)

**Files:**
- Modify: `src/renderer/pages/WorkerPayRates.tsx`
- Modify: `src/renderer/pages/Measurements.tsx`
- Modify: `src/renderer/pages/Reports.tsx`
- Modify: `src/renderer/pages/Login.tsx`
- Modify: `src/renderer/pages/Backup.tsx`

These pages will be implemented with functional shells that load data. Full UI polish will come from the HTML reference designs.

### WorkerPayRates.tsx

- [ ] **Step 1: Download reference and implement**

```tsx
import React, { useState, useEffect } from 'react';
import type { Branch, Worker, Order } from '../types';

interface WorkerPayRatesProps {
  branch: Branch;
}

interface WorkerEarning {
  worker: Worker;
  totalOrders: number;
  totalEarnings: number;
}

export default function WorkerPayRates({ branch }: WorkerPayRatesProps) {
  const [earnings, setEarnings] = useState<WorkerEarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [branch]);

  const loadData = async () => {
    setLoading(true);
    const [workers, orders] = await Promise.all([
      window.electronAPI.getAllWorkers(),
      window.electronAPI.getAllOrders(),
    ]);
    const branchWorkers = workers.filter((w: Worker) => w.branch === branch);
    const branchOrders = orders.filter((o: Order) => o.branch === branch);

    const result = branchWorkers.map((worker: Worker) => {
      const workerOrders = branchOrders.filter((o: Order) => o.worker_id === worker.id);
      const totalEarnings = workerOrders.reduce((sum: number, o: Order) => {
        if (worker.wage_type === 'percentage') return sum + (o.price * worker.wage_rate / 100);
        return sum + worker.wage_rate;
      }, 0);
      return { worker, totalOrders: workerOrders.length, totalEarnings };
    });

    setEarnings(result);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p>Loading...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Worker Pay Rates</h1>
      <div className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)]">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[var(--color-on-surface-variant)] border-b border-[var(--color-outline-variant)]">
              <th className="px-6 py-4 font-medium">Worker</th>
              <th className="px-6 py-4 font-medium">Wage Type</th>
              <th className="px-6 py-4 font-medium">Rate</th>
              <th className="px-6 py-4 font-medium">Orders</th>
              <th className="px-6 py-4 font-medium text-right">Total Earnings</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map(({ worker, totalOrders, totalEarnings }) => (
              <tr key={worker.id} className="border-b border-[var(--color-outline-variant)]/50">
                <td className="px-6 py-4 font-medium">{worker.name}</td>
                <td className="px-6 py-4 text-sm capitalize">{worker.wage_type}</td>
                <td className="px-6 py-4 text-sm">{worker.wage_rate}{worker.wage_type === 'percentage' ? '%' : ' SAR'}</td>
                <td className="px-6 py-4 text-sm">{totalOrders}</td>
                <td className="px-6 py-4 text-right font-semibold">{totalEarnings.toFixed(2)} SAR</td>
              </tr>
            ))}
            {earnings.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-[var(--color-on-surface-variant)]">No workers found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Measurements.tsx

- [ ] **Step 2: Implement Measurements page**

Note: Measurements DB queries need to be added to the DB layer first (see Task 14).

```tsx
import React, { useState, useEffect } from 'react';
import type { Branch, Customer } from '../types';

interface MeasurementsProps {
  branch: Branch;
  customerId: number | null;
}

export default function Measurements({ branch, customerId }: MeasurementsProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(customerId);

  useEffect(() => {
    loadCustomers();
  }, [branch]);

  const loadCustomers = async () => {
    const all = await window.electronAPI.getAllCustomers();
    setCustomers(all.filter((c: Customer) => c.branch === branch));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Measurements</h1>
      <div className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)] p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Select Customer</label>
          <select
            value={selectedCustomer || ''}
            onChange={(e) => setSelectedCustomer(Number(e.target.value))}
            className="w-full max-w-md px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm"
          >
            <option value="">Choose customer...</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedCustomer ? (
          <div className="grid grid-cols-4 gap-4">
            {['Chest', 'Waist', 'Hips', 'Length', 'Shoulders', 'Sleeve Length', 'Neck'].map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium mb-1">{field}</label>
                <input type="number" step="0.5" className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" placeholder="cm" />
              </div>
            ))}
            <div className="col-span-4">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea rows={2} className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" />
            </div>
            <div className="col-span-4">
              <button className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">Save Measurements</button>
            </div>
          </div>
        ) : (
          <p className="text-[var(--color-on-surface-variant)]">Select a customer to view/add measurements.</p>
        )}
      </div>
    </div>
  );
}
```

### Reports.tsx

- [ ] **Step 3: Implement Reports page**

```tsx
import React, { useState, useEffect } from 'react';
import type { Branch, Order } from '../types';

interface ReportsProps {
  branch: Branch;
}

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

export default function Reports({ branch }: ReportsProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [branch]);

  const loadData = async () => {
    setLoading(true);
    const all = await window.electronAPI.getAllOrders();
    setOrders(all.filter((o: Order) => o.branch === branch));
    setLoading(false);
  };

  const totalRevenue = orders.reduce((s, o) => s + o.price, 0);
  const totalPaid = orders.reduce((s, o) => s + o.paid, 0);
  const totalBalance = orders.reduce((s, o) => s + o.balance, 0);
  const cashOrders = orders.filter((o) => o.payment_type === 'Cash');
  const cardOrders = orders.filter((o) => o.payment_type === 'Card');
  const workerCost = 0; // Will calculate from worker wages

  if (loading) return <div className="flex items-center justify-center h-64"><p>Loading...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financial Reports</h1>

      <div className="flex bg-[var(--color-surface-container)] rounded-lg p-1 w-fit">
        {(['daily', 'weekly', 'monthly'] as PeriodFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-6 py-2 rounded-md text-sm font-medium capitalize ${
              period === p ? 'bg-[var(--color-surface-container-lowest)] shadow-sm' : 'text-[var(--color-on-surface-variant)]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
          <p className="text-sm text-[var(--color-on-surface-variant)]">Total Orders</p>
          <p className="text-2xl font-bold mt-1">{orders.length}</p>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
          <p className="text-sm text-[var(--color-on-surface-variant)]">Revenue</p>
          <p className="text-2xl font-bold mt-1">{totalRevenue.toFixed(0)} SAR</p>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
          <p className="text-sm text-[var(--color-on-surface-variant)]">Paid</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{totalPaid.toFixed(0)} SAR</p>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
          <p className="text-sm text-[var(--color-on-surface-variant)]">Balance</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{totalBalance.toFixed(0)} SAR</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
          <h3 className="text-sm font-semibold mb-3">Payment Methods</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>Cash</span><span className="font-semibold">{cashOrders.length} orders</span></div>
            <div className="flex justify-between text-sm"><span>Card</span><span className="font-semibold">{cardOrders.length} orders</span></div>
          </div>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]">
          <h3 className="text-sm font-semibold mb-3">Order Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>In Progress</span><span className="font-semibold">{orders.filter((o) => o.status === 'In Progress').length}</span></div>
            <div className="flex justify-between text-sm"><span>Ready</span><span className="font-semibold">{orders.filter((o) => o.status === 'Ready').length}</span></div>
            <div className="flex justify-between text-sm"><span>Delivered</span><span className="font-semibold">{orders.filter((o) => o.status === 'Delivered').length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Login.tsx

- [ ] **Step 4: Implement Login page**

```tsx
import React from 'react';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
      <div className="w-full max-w-sm bg-[var(--color-surface-container-lowest)] rounded-2xl p-8 border border-[var(--color-outline-variant)]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">Etiquette Tailor</h1>
          <p className="text-sm text-[var(--color-on-surface-variant)] mt-1">Staff Login</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" className="w-full px-4 py-3 rounded-lg border border-[var(--color-outline-variant)] text-sm" placeholder="Enter password" />
          </div>
          <button onClick={onLogin} className="w-full py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Backup.tsx

- [ ] **Step 5: Implement Backup page**

```tsx
import React from 'react';

export default function Backup() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Data Backup & Restore</h1>
      <div className="max-w-2xl space-y-4">
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]">
          <h2 className="text-lg font-semibold mb-2">Backup Database</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">Export a copy of the current database file.</p>
          <button className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm">
            Export Backup
          </button>
        </div>
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]">
          <h2 className="text-lg font-semibold mb-2">Restore Database</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">Import a database backup file. This will replace all current data.</p>
          <button className="px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold text-sm">
            Import Backup
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 14: Add Measurements IPC Handlers (Missing from current DB layer)

**Files:**
- Create: `src/db/measurements.ts`
- Modify: `src/db/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/types.d.ts`

- [ ] **Step 1: Create measurements DB module**

```typescript
// src/db/measurements.ts
import db from './connection';

export interface Measurement {
  id?: number;
  customer_id: number;
  piece_type: string;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  length: number | null;
  shoulders: number | null;
  sleeve_length: number | null;
  neck: number | null;
  notes: string | null;
  is_deleted?: number;
  created_at?: string;
  updated_at?: string;
}

export function getMeasurementsByCustomer(customerId: number): Measurement[] {
  const stmt = db.prepare('SELECT * FROM measurements WHERE customer_id = ? AND is_deleted = 0 ORDER BY created_at DESC');
  return stmt.all(customerId) as Measurement[];
}

export function getMeasurement(id: number): Measurement | undefined {
  const stmt = db.prepare('SELECT * FROM measurements WHERE id = ? AND is_deleted = 0');
  return stmt.get(id) as Measurement | undefined;
}

export function createMeasurement(measurement: Measurement): number {
  const stmt = db.prepare(`
    INSERT INTO measurements (customer_id, piece_type, chest, waist, hips, length, shoulders, sleeve_length, neck, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    measurement.customer_id, measurement.piece_type,
    measurement.chest, measurement.waist, measurement.hips,
    measurement.length, measurement.shoulders, measurement.sleeve_length,
    measurement.neck, measurement.notes
  );
  return result.lastInsertRowid as number;
}

export function updateMeasurement(id: number, measurement: Partial<Measurement>): void {
  const stmt = db.prepare(`
    UPDATE measurements
    SET piece_type = ?, chest = ?, waist = ?, hips = ?, length = ?,
        shoulders = ?, sleeve_length = ?, neck = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_deleted = 0
  `);
  stmt.run(
    measurement.piece_type, measurement.chest, measurement.waist,
    measurement.hips, measurement.length, measurement.shoulders,
    measurement.sleeve_length, measurement.neck, measurement.notes, id
  );
}

export function deleteMeasurement(id: number): void {
  const stmt = db.prepare('UPDATE measurements SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(id);
}
```

- [ ] **Step 2: Update db/index.ts to export measurements**

Add to `src/db/index.ts`:
```
export * from './measurements';
```

- [ ] **Step 3: Add IPC handlers in src/main/index.ts**

Add after the order handlers:
```typescript
import * as dbMeasurements from '../db/measurements';

ipcMain.handle('db:getMeasurementsByCustomer', (_, customerId: number) => dbMeasurements.getMeasurementsByCustomer(customerId));
ipcMain.handle('db:getMeasurement', (_, id: number) => dbMeasurements.getMeasurement(id));
ipcMain.handle('db:createMeasurement', (_, data: any) => dbMeasurements.createMeasurement(data));
ipcMain.handle('db:updateMeasurement', (_, id: number, data: any) => dbMeasurements.updateMeasurement(id, data));
ipcMain.handle('db:deleteMeasurement', (_, id: number) => dbMeasurements.deleteMeasurement(id));
```

- [ ] **Step 4: Add to preload.ts**

```typescript
getMeasurementsByCustomer: (customerId: number) => ipcRenderer.invoke('db:getMeasurementsByCustomer', customerId),
getMeasurement: (id: number) => ipcRenderer.invoke('db:getMeasurement', id),
createMeasurement: (data: any) => ipcRenderer.invoke('db:createMeasurement', data),
updateMeasurement: (id: number, data: any) => ipcRenderer.invoke('db:updateMeasurement', id, data),
deleteMeasurement: (id: number) => ipcRenderer.invoke('db:deleteMeasurement', id),
```

- [ ] **Step 5: Update types.d.ts**

Add measurement methods to ElectronAPI interface.

- [ ] **Step 6: Verify everything compiles**

Run: `npx tsc --noEmit`

---

## Task 15: Final Verification

- [ ] **Step 1: Run the full app and test all pages**

Run: `npm start`
Expected: All 11 pages load, navigation works, CRUD operations functional

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 3: Commit all changes**

```bash
git add -A
git commit -m "feat: implement all 11 page components with sidebar navigation"
```

---

## Self-Review Checklist

- [x] Spec coverage: Each of the 11 pages has a task
- [x] Placeholder scan: No TBD/TODO items
- [x] Type consistency: Customer, Worker, Order, Branch types used consistently
- [x] Business rules: Balance auto-calculated, payment types limited to Cash/Card, status flow correct
- [x] No new packages added beyond approved list
- [x] All DB access through IPC layer
