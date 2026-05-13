# PFMG — Personal Finance Manager (Angular Frontend)

**PFMG** (Personal Finance Manager) is an Angular 17 single-page application for personal/household financial management. It stores data locally (localStorage) and optionally connects to a backend REST API.

---

## Table of Contents

- [Overview](#overview)
- [Core Domain](#core-domain)
  - [Movements (Transactions)](#movements-transactions)
  - [Accounts & Cards](#accounts--cards)
  - [Categories & Subcategories](#categories--subcategories)
  - [Category Rules](#category-rules)
  - [Currencies](#currencies)
  - [Recurrent Transactions](#recurrent-transactions)
  - [Duplicate Detection Rules](#duplicate-detection-rules)
- [Key Features](#key-features)
- [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [State Management](#state-management)
  - [Data Persistence](#data-persistence)
- [Getting Started](#getting-started)

---

## Overview

PFMG is a frontend-only capable personal finance tool. Users can manage bank accounts and credit cards, import bank transactions, classify them into categories, define recurring transactions, and configure automated categorization rules — all without requiring a backend (data is persisted in `localStorage`).

---

## Core Domain

### Movements (Transactions)

The central entity of the application. Each movement represents a financial transaction and can be one of three types:

| Type | Description |
|---|---|
| `EXPENSE` | Outgoing money (negative amount) |
| `INCOME` | Incoming money (positive amount) |
| `TRANSFER` | Movement of funds between two accounts/cards |

**Key fields:**

| Field | Description |
|---|---|
| `accountOrCardId` | The account or card this movement belongs to |
| `date` | Transaction date |
| `payee` | Payer or payee name |
| `bankDescription` | Short description/title as received from the bank |
| `additionalInfo` | User-provided additional information |
| `notes` | Free-text notes |
| `currency` | Currency code (e.g., `PEN`, `USD`) |
| `amount` | Transaction amount |
| `operationNumber` | Bank operation number (accounts only) |
| `categoryId` / `subcategoryId` | Category classification |
| `labels` | Tags for custom classification |
| `isStub` | Marks auto-generated discrepancy movements |
| `linkedMovementId` | For transfers: ID of the paired movement |
| `targetAccountOrCardId` | For transfers: destination account |

---

### Accounts & Cards

Supports two account types:

| Type | Description |
|---|---|
| `DEBIT` | Standard bank account |
| `CREDIT` | Credit card with additional billing/payment fields |

**Key fields:**

| Field | Description |
|---|---|
| `name` | Account display name |
| `color` | Hex color for visual identification (default `#ba68c8`) |
| `currencyId` | Primary currency |
| `initialBalance` | User-defined starting balance (editable) |
| `currentBalance` | Calculated: `initialBalance + Σ movements` (read-only) |
| `lastCheckpointBalance` | Balance at last reconciliation checkpoint |
| `lastCheckpointDate` | Date of the last checkpoint |

**Credit card extra fields:**

| Field | Description |
|---|---|
| `paymentCurrencyId` | Currency used for payments (may differ from the card currency) |
| `paymentDate` | Day of month when payment is due (1–31) |
| `billingDate` | Day of month for billing/interest calculation (1–31) |
| `creditLimit` | Maximum credit allowed |

---

### Categories & Subcategories

A two-level hierarchical category tree:

- **Top-level categories**: `parentId = null`
- **Subcategories**: `parentId` points to the parent category ID

Categories are used to classify movements and are referenced by both manual assignment and automated rules.

---

### Category Rules

Pattern-matching rules that automatically assign categories to movements based on their description during import or categorization.

| Rule Type | Behavior |
|---|---|
| `exact` | Description must exactly match the pattern |
| `startsWith` | Description must start with the pattern |
| `contains` | Description must contain the pattern (anywhere) |

Each rule targets a specific `categoryId` (which may include a subcategory).

---

### Currencies

Multi-currency support. Each account and movement references a currency code. Credit cards can have a separate `paymentCurrencyId` for cross-currency billing scenarios.

---

### Recurrent Transactions

Scheduled/recurring transactions that model predictable future expenses or incomes (e.g., monthly subscriptions, annual fees, salary).

**Recurrence patterns:**

| Type | Description |
|---|---|
| `DAY_OF_MONTH` | Executes on a specific day each month (e.g., the 2nd of every month) |
| `DAY_OF_YEAR` | Executes on a specific day of a specific month each year (e.g., January 15th) |

**Execution modes:**

| Mode | Description |
|---|---|
| `AUTOMATIC` | The recurrent transaction is automatically detected and tagged when a matching movement is imported from the bank |
| `MANUAL` | The user must manually trigger execution; supports a `maxDaysToExecute` window |

**Tracking fields:**

| Field | Description |
|---|---|
| `lastExecuted` | Timestamp of the last successful execution |
| `nextExecution` | Calculated next scheduled date |
| `skippedUntil` | If set, execution is deferred until this date |
| `active` | Whether the recurrence is currently enabled |

---

### Duplicate Detection Rules

Configurable rules that identify potential duplicate movements during the import process:

| Field | Description |
|---|---|
| `descriptionGroup` | A list of description strings considered equivalent (e.g., a bank may use slightly different descriptions for the same transaction type) |
| `accountType` | Scope: `debit`, `credit`, or `all` |
| `currencies` | List of applicable currency codes, or `['all']` for any currency |

Detected duplicates are assigned one of three statuses:

| Status | Meaning |
|---|---|
| `NONE` | Not a duplicate |
| `POTENTIAL` | Flagged as a possible duplicate (shows an alert) |
| `CONFIRMED` | Confirmed as a duplicate |

---

## Key Features

| Feature | Description |
|---|---|
| **Movement Import** | Import bank statement files. Detects duplicates, proposes categories via rules or recurrences, allows per-movement exclusion before committing to storage |
| **Movement Management** | View, create, edit, and delete movements per account. Supports categorization dialog, description editing, and movement form dialog |
| **Manual Recurrents** | View upcoming recurrent transactions and manually execute them from a dedicated screen |
| **Settings** | Full configuration panel covering: accounts, cards, currencies, categories, category rules, recurrent transactions, duplicate detection rules, and storage clearing |
| **Dashboard** | High-level transaction overview (in development) |
| **Category/Subcategory Dropdown** | Shared reusable component for selecting categories and subcategories across the app |

---

## Architecture

### Project Structure

```
src/
├── app/
│   ├── application/          # App shell: root component, module, and routing
│   ├── features/
│   │   ├── app/              # Generic app-level pages (Home, About)
│   │   ├── error/            # Error page
│   │   └── transactions/     # Core finance feature module
│   │       ├── dashboard/
│   │       ├── import-movements/
│   │       ├── manual-recurrents/
│   │       ├── movements/
│   │       │   ├── categorize-dialog/
│   │       │   ├── description-dialog/
│   │       │   ├── import-dialog/
│   │       │   └── movement-form-dialog/
│   │       └── settings/
│   │           ├── accounts/
│   │           ├── categories/
│   │           ├── category-rules/
│   │           ├── clear-storage/
│   │           ├── currencies/
│   │           ├── duplicate-detection-rules/
│   │           └── recurrent-transactions/
│   ├── logic/
│   │   ├── constants.ts      # App-wide constants and localStorage keys
│   │   ├── utilities.ts      # Shared utility functions
│   │   ├── animations.ts     # Angular animation definitions
│   │   ├── services/         # Injectable services (one per domain entity)
│   │   └── types/            # Domain model classes and enums
│   └── shared/
│       ├── shared.module.ts
│       ├── _frame/           # App layout/frame component
│       ├── category-subcategory-dropdown/
│       └── directives/       # Custom directives (e.g., click-outside)
├── assets/
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
└── styles/
    ├── styles.css
    ├── base.css
    └── tokens.css            # Design tokens (CSS variables)
```

### State Management

- Each domain entity has a dedicated `Injectable` service (e.g., `MovementService`, `AccountService`, `CategoryService`).
- Services expose state via **RxJS `BehaviorSubject`** streams, allowing reactive subscriptions from components.
- A `BaseService` base class provides shared infrastructure: URL building, error handling, `localStorage` read/write helpers, and a `loading` stream.

### Data Persistence

The application operates in two modes:

| Mode | Description |
|---|---|
| **Offline / localStorage** | All data is serialized to `localStorage` using well-defined keys (`StorageTags`). The app is fully functional without a backend. |
| **Backend API** | `BaseService` supports building REST API URLs via a configurable `apiBase` endpoint (set per environment in `environment.ts`). |

**localStorage keys:**

| Key | Purpose |
|---|---|
| `USER_OBJECT` | Logged-in user data |
| `CURRENCIES` | Currency list |
| `ACCOUNTS` | Account list |
| `CARDS` | Card list |
| `MOVEMENTS` | All movements |
| `MOVEMENTS_BY_ACCOUNT` | Movements indexed by account ID |
| `CATEGORIES` | Category tree |
| `CATEGORY_RULES` | Categorization rules |
| `RECURRENT_TRANSACTIONS` | Recurrent transaction definitions |
| `DUPLICATE_DETECTION_RULES` | Duplicate detection configuration |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Angular CLI 17+

### Installation

```bash
npm install
```

### Running the App

```bash
npm start
```

The application will be available at `http://localhost:8888`.

### Available Scripts

| Script | Description |
|---|---|
| `npm start` | Start the development server |
| `npm run build` | Build for production |
| `npm test` | Run unit tests |
| `npm run lint` | Lint the source code |

### Environment Configuration

Update `src/environments/environment.ts` to point to your backend API:

```typescript
export const environment = {
  production: false,
  apiBase: 'http://localhost:8080/api'
};
```

If `apiBase` is empty or not set, the app falls back to `localStorage`-only mode.
