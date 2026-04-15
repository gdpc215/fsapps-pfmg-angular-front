FULL SYSTEM SPECIFICATION — PERSONAL FINANCE APP (v1)
________________________________________
1. SYSTEM OVERVIEW
1.1 Objective
A frontend-only Angular application that:
	Ingests non-deterministic financial data exports 
	Reconstructs a consistent financial ledger 
	Tracks: 
	Accounts 
	Credit cards 
	Transactions 
	Recurring obligations 
	Savings goals 
	Uses: 
	Reconciliation logic (core engine) 
	User-controlled corrections 
________________________________________
1.2 Core System Paradigm
The system is:
Event-based ledger + heuristic reconciliation + snapshot validation
________________________________________
1.3 Key Principles
	Transactions are the source of truth 
	Bank data is inconsistent and non-idempotent 
	Reconciliation is heuristic, not exact 
	User input overrides automation 
	System is fully deterministic after user resolution 
________________________________________
2. DOMAIN MODEL (FINAL)
________________________________________
2.1 FinancialSource
FinancialSource {
  id: string
  name: string
  type: 'ACCOUNT' | 'CREDIT_CARD'

  currency?: 'PEN' | 'USD' // only for accounts

  // credit card only
  closingDay?: number
  dueDay?: number
  creditLinePen?: number
}
________________________________________
2.2 Transaction
Transaction {
  id: string
  sourceId: string

  date: string // YYYY-MM-DD

  amount: number
  currency: 'PEN' | 'USD'

  amountPen?: number
  exchangeRate?: number

  description: string
  normalizedDescription: string

  userDescription?: string
  category?: string

  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'PAYMENT' | 'INTEREST'

  operationNumber?: string

  isManualOverride: boolean

  recurringMatchId?: string

  linkedTransactionId?: string // for transfers
}
________________________________________
2.3 BalanceSnapshot
BalanceSnapshot {
  id: string
  sourceId: string

  datetime: string // ISO

  balance: number
  currency: 'PEN' | 'USD'
}
________________________________________
2.4 RecurringRule
RecurringRule {
  id: string

  name: string
  matchString: string

  expectedAmount: number
  tolerance: number // fixed: 0.1

  frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM'

  dayOfMonth?: number
  dayOfWeek?: number

  sourceId: string

  lastMatchedDate?: string
}
________________________________________
2.5 SavingsGoal
SavingsGoal {
  id: string

  name: string
  targetAmount: number

  contributions: {
    date: string
    amount: number
  }[]
}
________________________________________
3. CORE MODULES
________________________________________
3.1 ImportProcessingModule
Responsibility
Orchestrates full import lifecycle.
________________________________________
Pipeline
Step 1 — File Parsing
Input:
	Excel file 
Output:
ParsedRow {
  date
  description
  amount
  currency
}
________________________________________
Step 2 — Validation
Fail entirely if:
	Missing required columns 
	Invalid types 
	Unexpected format 
	Corrupt values 
________________________________________
Step 3 — Enrichment
For each row:
enriched = {
  ...parsed,
  sourceId,
  normalizedDescription,
  exchangeRate (if USD),
  amountPen,
  type (default EXPENSE unless positive),
}
________________________________________
Step 4 — Reconciliation
result = DuplicateDetectionService.check(enriched, existingTransactions)
________________________________________
Step 5 — Classification
	CONFIRMED → skip 
	POTENTIAL → conflict queue 
	NONE → candidate insert 
________________________________________
Step 6 — User Resolution
User resolves:
	conflicts only 
________________________________________
Step 7 — Persistence
Insert:
	only resolved + new 
________________________________________
3.2 DuplicateDetectionModule (CRITICAL)
________________________________________
Purpose
Resolve:
	duplicates 
	pending vs posted transitions 
	inconsistent bank exports 
________________________________________
Output
DuplicateCheckResult {
  status: 'CONFIRMED' | 'POTENTIAL' | 'NONE'
  matchedTransaction?: Transaction
}
________________________________________
Pre-filter
Exclude:
if existing.isManualOverride → skip
________________________________________
Matching Layers (in order)
________________________________________
Layer 1 — Operation Number
If both have:
operationNumber === operationNumber
→ CONFIRMED
________________________________________
Layer 2 — Exact Match
same date
AND same amount
AND normalizedDescription equal
→ CONFIRMED
________________________________________
Layer 3 — Rule-Based Matching
Using:
DuplicateDetectionRule {
  descriptionGroup: string[]
}
Match if both descriptions belong to same group.
→
	same amount → CONFIRMED 
	else → POTENTIAL 
________________________________________
Layer 4 — Heuristic Matching
________________________________________
Description Similarity
desc1.includes(desc2) || desc2.includes(desc1)
________________________________________
Date Tolerance
	Same date OR 
	±3 days 
________________________________________
Amount Comparison
	Exact match OR 
	PEN-normalized match 
________________________________________
Result
Condition Strength	Output
Strong	CONFIRMED
Medium	POTENTIAL
Weak	NONE
________________________________________
3.3 TransactionModule
________________________________________
Responsibility
	Store transactions 
	Provide query access 
	No logic 
________________________________________
Constraints
	No balance mutation 
	No reconciliation 
________________________________________
3.4 SnapshotModule
________________________________________
Behavior
	User inputs snapshots manually 
	Stored per source 
________________________________________
Validation Rules
Before:
	Credit card interest calculation 
Require:
snapshot_before_closing
AND snapshot_after_closing
If missing → block
________________________________________
3.5 CreditCardModule
________________________________________
Currency Logic
At import:
amountPen = amount * exchangeRate
Stored permanently.
________________________________________
Interest Calculation
I=B_after-B_before-∑T
________________________________________
Rules
	B_before = last snapshot before closing 
	B_after = first snapshot after closing 
	Sum = all transactions within cycle 
________________________________________
Output
Create:
Transaction {
  type: 'INTEREST'
}
________________________________________
3.6 RecurringModule
________________________________________
Matching
description.includes(matchString)
AND amount within ±10%
________________________________________
Behavior
	Match → mark as paid 
	Multiple matches → conflict 
	No match → pending 
	Pending persists indefinitely 
________________________________________
3.7 TransferDetectionModule
________________________________________
Detection
Two transactions:
	Same amount 
	Opposite sign 
	Close dates 
	Different sources 
________________________________________
Result
type = TRANSFER
linkedTransactionId assigned
________________________________________
4. EDITING LOGIC
________________________________________
Editable Fields
	amount 
	date 
	description 
	category 
	type 
________________________________________
Rule
Any edit:
isManualOverride = true
________________________________________
Effect
	Excluded from: 
	duplicate detection 
	recurring matching 
________________________________________
5. CATEGORY SYSTEM
________________________________________
Behavior
	Predefined categories 
	Assignable at import 
	Editable later 
________________________________________
Storage
Stored per transaction:
category
userDescription
________________________________________
6. STORAGE
________________________________________
Structure
{
  sources
  transactions
  snapshots
  recurringRules
  savingsGoals
}
________________________________________
Persistence
	localStorage (primary) 
	JSON export/import 
________________________________________
7. UI LOGIC
________________________________________
Import View
	Upload 
	Preview 
	Inline edit 
	Duplicate detection visualization 
________________________________________
Conflict Resolution
User chooses:
	Merge 
	Accept new 
	Discard 
________________________________________
Transactions View
	Full edit 
	Filtering 
________________________________________
Snapshot View
	Manual entry 
________________________________________
8. SYSTEM INVARIANTS
________________________________________
	No duplicate insertion when CONFIRMED 
	All USD transactions must have exchangeRate 
	No balance stored as mutable state 
	Snapshots required for credit card calculations 
	Manual override blocks automation 
	Import must be fully valid or rejected 
________________________________________
9. NON-GOALS
________________________________________
	No bank integrations 
	No real-time sync 
	No analytics (v1) 
	No OCR 
	No multi-device sync 
________________________________________
10. FINAL VALIDATION CHECK
Before moving to implementation, validate:
	Duplicate logic matches your current behavior exactly 
	Snapshot dependency feels correct (not intrusive) 
	Credit card interest estimation is sufficient 
	Manual override behavior is acceptable 
	Import flow UX is acceptable

