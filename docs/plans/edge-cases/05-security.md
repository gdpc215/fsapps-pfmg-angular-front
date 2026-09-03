# Edge Cases — Security

Design ref: DESIGN_LOCAL_v4.md §1 (local-only, no HTTP), §3 (interfaces), §9 (import wizard)

This is a **local-only, single-user** personal finance app. There is no authentication, no server, and no network communication. The threat model is therefore different from a typical web app — the primary risks are data exposure on the client machine and XSS via imported content.

---

## Data Exposure

### localStorage is accessible to any JavaScript on the same origin
- All financial data (transaction amounts, credit card names, account balances) lives unencrypted in `localStorage`. Any JavaScript running on the same origin can read it with `localStorage.getItem('pfmg_transactions')`. In a development environment on `localhost`, this is any script on `localhost:4200`.
- **Mitigation:** Since this is a local-only app, exposure is limited to scripts already running in the user's browser on that origin. The primary risk is third-party browser extensions with broad `<all_urls>` permissions. Document this in a privacy notice. For sensitive deployments, consider IndexedDB with client-side encryption (e.g., `SubtleCrypto`).

### localStorage is accessible via browser DevTools
- Any user (or anyone with physical access) can open Chrome DevTools → Application → localStorage and read or modify all financial data in plain text.
- **Mitigation:** This is inherent to the local-only design. If data confidentiality at rest is required, encrypt the JSON before storing. At minimum, document that the app is not suitable for use on shared computers.

### `localStorage.clear()` wipes all data
- The user (or a malicious script) calling `localStorage.clear()` from the console deletes all app data permanently.
- **Mitigation:** Provide an "Export backup" feature that lets users download a JSON snapshot. Without this, data loss from accidental clear has no recovery path.

---

## XSS via Imported Content

### Excel descriptions rendered via Angular template binding (SAFE)
- Transaction `strDescription` values imported from Excel are displayed in Angular templates via `{{ t.strDescription }}` interpolation. Angular automatically HTML-escapes interpolated values — a description like `<script>alert(1)</script>` is rendered as literal text, not executed.
- **Status:** Safe by default as long as no view uses `[innerHTML]` or `DomSanitizer.bypassSecurityTrustHtml()` on transaction fields. Audit all templates: never bind transaction data to `[innerHTML]`.

### User-provided `strNotes` field
- `strNotes` is free-text entered by the user in the import wizard context menu ("Add additional info"). Same safety applies — render via interpolation only. If a rich-text (markdown/HTML) notes feature is ever added, re-evaluate XSS exposure.

### Malicious xlsx payload
- SheetJS parses Excel files; it does not execute VBA macros or embedded scripts. Large embedded images or OLE objects could increase memory usage. A crafted xlsx with millions of cells could trigger an OOM crash in the browser tab.
- **Mitigation:** Enforce a file-size limit before calling `file.arrayBuffer()` (e.g., 10 MB). Check that SheetJS strips external references/formulas — confirm that `sheet_to_json` does not evaluate `=HYPERLINK()` or external data connections.

### Formula injection (CSV injection equivalent)
- Some exports from banking portals include cell values that start with `=`, `+`, `-`, or `@`. These are formula injection payloads for CSV/Excel. SheetJS with `sheet_to_json` returns the raw cell value (not the evaluated formula) when the cell is a string type. However, if SheetJS encounters a formula cell (`cellFormula`), it may evaluate it.
- **Mitigation:** After parsing, validate that `amount` is a finite number and `dateTransaction` is a valid YYYY-MM-DD string. Reject or sanitize rows that fail validation.

---

## `crypto.randomUUID()` Availability

- `crypto.randomUUID()` is only available in **secure contexts** (HTTPS or `localhost`). If the app is ever served over plain HTTP on a non-localhost hostname (e.g., local network share at `http://192.168.1.x:4200`), `crypto.randomUUID()` throws a `TypeError: crypto.randomUUID is not a function`.
- **Mitigation:** Use a polyfill fallback: check `crypto.randomUUID` availability and fall back to a manual UUID v4 generator (`'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(...)`) if unavailable.

---

## Import File Risks

### No MIME-type validation
- The file input uses `type="file"` with no `accept` attribute restriction beyond what the design implies. Add `accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"` to the input element. Note that MIME-type spoofing is still possible (rename a file to `.xlsx`) — validate the file's magic bytes (PK header: `50 4B 03 04`) as an additional check.

### No file-size limit (DoS via memory exhaustion)
- Covered in import wizard section but security-relevant: a user who opens a 1 GB file brings down their own browser tab. Cap at 10 MB in the upload handler.

---

## Data Integrity / Tamper Detection

### No checksums or signatures on localStorage data
- A user (or malicious script) can modify any `pfmg_*` key — change balances, delete transactions, forge import dates. Since this is a personal finance tracker, tampered data leads to wrong decisions.
- **Mitigation:** This is accepted risk for a local-only app. If integrity guarantees are needed in the future, sign the entire localStorage snapshot with a user-provided password key using `SubtleCrypto.sign`.

### `transferGroupId` can be set to any string
- If a user manually edits localStorage to give multiple transactions the same `transferGroupId`, the app will treat them all as part of the same transfer. Add a validation in the UI that enforces exactly two transactions per `transferGroupId`.

---

## Future Backend Migration Security (§16)

When migrating to the full-stack design:

- All localStorage data is user-supplied and should be treated as **untrusted input** by the backend — validate every field server-side.
- `crypto.randomUUID()`-generated IDs must not be trusted as unique by the backend; the server should generate its own IDs on insert.
- User-provided `strDescription` and `strNotes` must be HTML-escaped at render time on any backend-rendered view (though Angular's template engine handles this for SPA views).
- The exchange rate (`decUsdExchangeRate`) must be validated as a positive finite number on the backend — it controls financial calculations.
