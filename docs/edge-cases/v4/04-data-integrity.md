# Edge Cases — Data Integrity and Storage

Design ref: DESIGN_LOCAL_v4.md §4–§5, §15

---

## StorageService

### No error handling on `localStorage.setItem`
- `persist()` calls `localStorage.setItem(key, JSON.stringify(data))` with no try-catch. `setItem` throws `QuotaExceededError` (a `DOMException`) when the 5–10 MB quota is exceeded. This exception is uncaught and propagates up to the caller, potentially leaving data in a partially written state (e.g., ImportBatch saved, Transactions not). Wrap `persist()` in try-catch; on failure, throw a typed error that the caller can handle (show a toast, attempt cleanup).

### No schema validation on reads
- `getAll<T>()` deserializes raw JSON into `T[]` without any validation. If localStorage is corrupted (manually edited, written by a future version of the app, or stored by another app that happens to use `pfmg_*` keys), the app receives malformed objects that can crash components when accessing missing properties. Add a lightweight validation step: at minimum, check that each record has the expected `id`, `dateCreation`, and `dateModification` fields before returning.

### `changes$` emits on every single save
- Every `storage.save()` call emits `changes$.next()`, which causes ALL feature services to re-read their entire collection from localStorage and push a new array to their `BehaviorSubject`. For `saveMany()` with 100 transactions, this fires once (uses `saveAll`). But a loop of individual `save()` calls would fire N times, causing N full re-reads and N component re-renders. Document that batched writes must use `saveAll`.

### `save()` UPDATE path: `dateCreation` preservation
- On UPDATE: `saved = { ...(all[idx] as any), ...saved, dateModification: now }` — this spreads the existing record first, then the incoming record. If the incoming record has `dateCreation` set to a wrong value, it is overwritten by the spread of the existing record. This is actually correct behavior. However, if `all[idx]` somehow lacks `dateCreation` (corrupted record), the existing record wins and `dateCreation` remains undefined. This could cause downstream issues in date displays. A defensive fallback: `dateCreation: all[idx].dateCreation ?? now`.

---

## Cascade and Referential Integrity

### Deleting a CreditCard does not cascade
- `CreditCardService.delete(id)` removes the card record but leaves behind:
  - `Transaction[]` with `accountId === id`
  - `ImportBatch[]` with `accountId === id`
  - `CycleClose[]` and `CycleSnapshot[]` with `cardId === id`
  - `RecurrentTransaction[]` with `accountId === id`
  - `RecurrentTransactionMatch[]` whose `recurrentTransactionId` links to now-orphaned recurrents
- These orphaned records are invisible in the UI but consume storage and could cause mismatches if an ID is ever reused. Add a pre-delete summary dialog: "Deleting this card will also remove X transactions and Y cycle records. Confirm?"

### Deleting a DebitAccount does not cascade
- Same issue as credit card: leaves orphaned transactions, import batches, and recurrent transactions.

### Deleting a Category does not cascade
- `CategoryService.deleteCategory(id)` removes the category but leaves:
  - `Subcategory[]` with `categoryId === id` — these still appear in all subcategory lookups
  - Transactions with `subcategoryId` pointing to subcategories of the deleted category
- Subcategories of deleted categories should be soft-removed or reassigned.

### Deleting a Subcategory does not update transactions
- `CategoryService.deleteSubcategory(id)` removes the subcategory but leaves all transactions that reference it with a non-null `subcategoryId` pointing to a deleted record. These transactions:
  - Show "(unknown)" or crash in any view that resolves `subcategoryId → Subcategory`
  - Are unreachable in the Transaction Explorer (subcategory won't appear in the dropdown)
  - Are not correctly grouped in dashboards (grouped under "unknown subcategory")
- On delete, either nullify `subcategoryId` across affected transactions or block deletion if transactions reference the subcategory.

### Deleting a CategoryRule: no impact on already-categorized transactions
- This is acceptable behavior (rules only apply at import time). Documenting it as "by design" avoids confusion.

---

## Balance Staleness

### `decCurrentBalance` on CreditCard updated only at import/conciliation
- Manual transaction edits (e.g., user corrects a description and saves) do not update `decCurrentBalance`. If the user creates or edits a transaction outside the import wizard, the displayed balance on the card is wrong.
- Option A: remove `decCurrentBalance` from the `CreditCard` model and always compute it on the fly from transactions.
- Option B: keep it but only display it as "last known balance" with an import date stamp.

### `decCurrentBalance` on DebitAccount updated only at import
- Same issue. A user who manually adds a debit transaction (e.g., cash withdrawal) must re-run import or manually update the balance. Consider a "Recalculate balance" action.

---

## Validation Gaps

### `intClosingDay` not validated on input (1–31)
- The spec states `intClosingDay: number; // 1–31` but the form doesn't enforce this. A user could enter 0 or 32, causing `buildCycleWindow` to produce an invalid date. Validate at the card-form level: min 1, max 31.

### `intPaymentDay` not validated on input (1–31)
- Same issue. `intPaymentDay` is stored but currently unused in any logic, so the impact is future-risk only.

### No uniqueness constraint on `CreditCard.strName`
- A user can create two credit cards named "BCP Visa" — this is not a bug but causes ambiguity in account selectors throughout the app (two items with identical labels in `<mat-select>`). Recommend: either enforce uniqueness, or display a disambiguating suffix (e.g., last 4 digits, or the closing day).

### `CategoryRule.intPriority` uniqueness
- BUSINESS_LOGIC.md §3.6 states each rule must have a unique `intPriority`. No enforcement exists at the storage or service level. If two rules share the same priority, the matching result is insertion-order dependent and non-deterministic across localStorage serialization. Add a uniqueness check in `CategoryService` or in the rule-list UI.

### `RecurrentTransaction` AUTOMATIC mode: required fields not enforced
- AUTOMATIC mode recurrents need `decApproxAmount`, `decAmountRange`, and `strMatchString` to be meaningful. If these are undefined, `findMatch` defaults to `approxAmt = 0`, `range = 0` — matching only zero-amount transactions. The form should require these fields when `strMatchMode === 'AUTOMATIC'`.

---

## localStorage Key Collisions

### Other apps on the same origin can read/write `pfmg_*` keys
- If another app runs on `localhost:4200` (common in development), it can accidentally overwrite `pfmg_credit_cards`. The `pfmg_` prefix helps but does not guarantee isolation. Use a more specific prefix in development (e.g., `pfmg_dev_`) or document this risk.

### No versioning on the localStorage schema
- If the model evolves (e.g., a new required field is added to `Transaction`), old data in localStorage won't have that field. The app silently uses `undefined` for the missing field. Add a `schemaVersion` key to localStorage and run migrations on app startup.
