# Credit Card Transaction Tracking System — Design Document

**Version:** 1.1  
**Date:** 2026-05-12  
**Project:** fsapps-pfmg  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Domain Model](#3-domain-model)
4. [SQL Data Model](#4-sql-data-model)
5. [Business Logic](#5-business-logic)
6. [Angular Feature Structure](#6-angular-feature-structure)
7. [Java Feature Structure](#7-java-feature-structure)
8. [API Endpoints](#8-api-endpoints)
9. [Open Questions](#9-open-questions)

---

## 1. Overview

This system tracks personal credit card spending across multiple cards and currencies (PEN and USD). Users import transactions from Excel files exported by their bank, review and categorize them, and perform monthly cycle reconciliation to detect interest charges and verify their balance.

Core capabilities:

- Multi-card management with per-card closing-day configuration
- Multi-account management: credit cards (with cycle conciliation) and debit accounts (savings, no conciliation)
- Excel import with duplication detection and auto-categorization
- Category and rule management for automatic transaction labeling
- Cycle-based reconciliation with mid-cycle snapshot support
- Soft-delete on transactions (status flag, never physically deleted)
- Recurrent transaction tracking for known monthly/yearly charges with manual or automatic matching

---

## 2. Tech Stack

### Frontend

| Concern | Choice |
|---|---|
| Framework | Angular 19 |
| UI Components | Angular Material 19 |
| Styling | Tailwind CSS 3 |
| State management | RxJS `BehaviorSubject` (no NgRx) |
| Module loading | Lazy-loaded feature modules |
| Routing catalog | `src/app/application/app.routes.catalog.ts` |
| HTTP | `HttpClient` via `BaseService` pattern |

### Backend

| Concern | Choice |
|---|---|
| Runtime | Java 21 |
| Framework | Spring Boot 3.3.6 |
| Hosting | Azure Functions (HTTP triggers) |
| Database | MS SQL Server via `JdbcTemplate` |
| Data access | Stored procedures only; `CustomRowMapper` for `ResultSet` mapping |
| Async | `AsyncDBHelper` wrapping `CompletableFuture` |
| Excel parsing | Apache POI (`.xlsx`) |

---

## 3. Domain Model

### 3.1 Entity Relationships (text diagram)

```
M_CREDIT_CARD
  ├── M_IMPORT_BATCH (accountId)
  │     └── M_TRANSACTION (importBatchId, accountId)
  ├── M_TRANSACTION (accountId)
  ├── M_CYCLE_SNAPSHOT (cardId)
  └── M_CYCLE_CLOSE (cardId)
        └── M_TRANSACTION (interestTransactionId — one special row)

M_DEBIT_ACCOUNT
  ├── M_IMPORT_BATCH (accountId)
  └── M_TRANSACTION (accountId)

M_CATEGORY
  └── M_SUBCATEGORY (categoryId)
        ├── M_TRANSACTION (subcategoryId)
        └── M_CATEGORY_RULE (subcategoryId)

M_DUPLICATION_COLLECTION
  └── M_DUPLICATION_COLLECTION_STRING (collectionId)

M_RECURRENT_TRANSACTION (accountId → M_CREDIT_CARD or M_DEBIT_ACCOUNT)
  └── M_RECURRENT_TRANSACTION_MATCH (recurrentTransactionId, transactionId)
```

### 3.2 Field Definitions

#### CreditCard

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| strName | VARCHAR(200) | Display name, e.g. "BCP Visa" |
| intClosingDay | INT | Day of month (1–31) when the billing cycle closes |
| intPaymentDay | INT | Payment due day (1–31) |
| decCurrentBalance | DECIMAL(18,4) | Last calculated balance (negative = owed); updated after every import and conciliation |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### DebitAccount

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| strName | NVARCHAR(100) | Display name |
| decCurrentBalance | DECIMAL(18,4) | Last calculated balance; updated after every import |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### Transaction

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| accountId | UNIQUEIDENTIFIER | FK → M_CREDIT_CARD or M_DEBIT_ACCOUNT |
| accountType | NVARCHAR(20) | 'CREDIT_CARD' \| 'DEBIT_ACCOUNT' |
| importBatchId | UNIQUEIDENTIFIER | FK → M_IMPORT_BATCH (nullable for manually entered rows) |
| dateTransaction | DATE | Date only, no time component |
| strDescription | VARCHAR(500) | Original text from bank file |
| strCurrency | VARCHAR(3) | "PEN" or "USD" |
| decAmount | DECIMAL(18,2) | Negative = charge/spending; positive = payment/refund |
| decAmountPen | DECIMAL(18,2) | Always in PEN; for USD rows: decAmount × usdExchangeRate at import time |
| subcategoryId | UNIQUEIDENTIFIER | FK → M_SUBCATEGORY (nullable) |
| strNotes | VARCHAR(1000) | Free-text user comment |
| strOperationNumber | NVARCHAR(50) NULL | Debit accounts only; used for D1 duplication rule |
| transferGroupId | UNIQUEIDENTIFIER NULL | Shared ID linking two transactions in a transfer pair |
| strStatus | VARCHAR(20) | 'ACTIVE' \| 'DELETED' \| 'PENDING' |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

**Sign convention:** `decAmount` follows bank statement logic — a purchase is negative, a payment (credit) is positive. All balance calculations use the same sign. The UI may display amounts as absolute values with a visual indicator, but the stored value is always signed.

#### ImportBatch

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| accountId | UNIQUEIDENTIFIER | FK → M_CREDIT_CARD or M_DEBIT_ACCOUNT |
| accountType | NVARCHAR(20) | 'CREDIT_CARD' \| 'DEBIT_ACCOUNT' |
| dateImport | DATETIME | When the import was executed |
| decUsdExchangeRate | DECIMAL(10,4) | USD/PEN rate applied to all USD rows in this batch |
| decBalanceAtImport | DECIMAL(18,2) | User-provided balance at time of import (negative = owed) |
| dateCreation | DATETIME | Auto-set |

#### Category

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| strName | VARCHAR(200) | e.g. "Home", "Technology" |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### Subcategory

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| categoryId | UNIQUEIDENTIFIER | FK → M_CATEGORY |
| strName | VARCHAR(200) | e.g. "Housing", "Maintenance" |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### CategoryRule

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| subcategoryId | UNIQUEIDENTIFIER | FK → M_SUBCATEGORY |
| strMatchString | VARCHAR(500) | The text to match against the transaction description |
| strMatchType | VARCHAR(20) | "STARTS_WITH", "CONTAINS", "ENDS_WITH", "EQUALS" |
| intPriority | INT | Lower number = evaluated first |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### DuplicationCollection

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| strName | VARCHAR(200) | e.g. "Uber variants" |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### DuplicationCollectionString

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| collectionId | UNIQUEIDENTIFIER | FK → M_DUPLICATION_COLLECTION |
| strValue | VARCHAR(500) | e.g. "UBER", "UBER EATS", "UBER TRIP" |
| dateCreation | DATETIME | Auto-set |

#### CycleSnapshot

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| cardId | UNIQUEIDENTIFIER | FK → M_CREDIT_CARD |
| dateSnapshot | DATE | The date the balance was recorded |
| decBalanceAtSnapshot | DECIMAL(18,2) | User-provided balance at that date (negative = owed) |
| strType | VARCHAR(20) | "SNAPSHOT" (mid-cycle) or "CYCLE_CLOSE" (end of cycle) |
| dateCreation | DATETIME | Auto-set |

#### CycleClose

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| cardId | UNIQUEIDENTIFIER | FK → M_CREDIT_CARD |
| dateClosing | DATE | Official closing date of the cycle (e.g. the 10th) |
| decOpeningBalance | DECIMAL(18,2) | Closing balance of the previous cycle |
| decClosingBalance | DECIMAL(18,2) | Computed balance at closing date (`amountB` from reconciliation) |
| decInterestAmount | DECIMAL(18,2) | 0 if no discrepancy; otherwise `amountB - amountA` |
| interestTransactionId | UNIQUEIDENTIFIER | FK → M_TRANSACTION (the auto-created interest charge row; nullable) |
| dateCreation | DATETIME | Auto-set |

#### RecurrentTransaction

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| strName | NVARCHAR(200) | Display name |
| strNotes | NVARCHAR(max) NULL | Optional free-text notes |
| accountId | UNIQUEIDENTIFIER | FK → M_CREDIT_CARD or M_DEBIT_ACCOUNT |
| accountType | NVARCHAR(20) | 'CREDIT_CARD' \| 'DEBIT_ACCOUNT' |
| strFrequency | NVARCHAR(10) | 'MONTHLY' \| 'YEARLY' |
| strMatchMode | NVARCHAR(10) | 'MANUAL' \| 'AUTOMATIC' |
| strCurrency | NVARCHAR(3) NULL | Automatic-only; NULL for MANUAL |
| decApproxAmount | DECIMAL(18,4) NULL | Automatic-only; NULL for MANUAL |
| decAmountRange | DECIMAL(18,4) NULL | Automatic-only; NULL for MANUAL |
| strMatchString | NVARCHAR(200) NULL | Automatic-only; NULL for MANUAL |
| intApproxDay | INT NULL | Automatic-only; NULL for MANUAL |
| intApproxMonth | INT NULL | Automatic-only, YEARLY only; NULL for MANUAL/MONTHLY |
| intDayRange | INT NULL | Automatic-only; NULL for MANUAL |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

#### RecurrentTransactionMatch

| Field | Type | Notes |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| recurrentTransactionId | UNIQUEIDENTIFIER | FK → M_RECURRENT_TRANSACTION |
| strIterationKey | NVARCHAR(7) | 'YYYY-MM' for MONTHLY, 'YYYY' for YEARLY |
| transactionId | UNIQUEIDENTIFIER NULL | FK → M_TRANSACTION; null if manually done without linking |
| boolDone | BIT | Whether the recurrent charge has been satisfied for this iteration |
| dateDone | DATE NULL | Date it was marked done |
| strMatchMode | NVARCHAR(10) | 'MANUAL' \| 'AUTOMATIC' |
| dateCreation | DATETIME | Auto-set |
| dateModification | DATETIME | Auto-set |

---

## 4. SQL Data Model

All tables follow the conventions in `M_USER.sql`:
- `UNIQUEIDENTIFIER` PKs with `NEWSEQUENTIALID()` default
- `DATETIME` columns with `[dbo].[fn_getcurrentdate]()` default
- camelCase column names matching Java entity field names
- All data access via stored procedures

### 4.1 DDL — Create Tables

```sql
-- ============================================================
-- M_CREDIT_CARD
-- ============================================================
DROP TABLE IF EXISTS M_CREDIT_CARD
GO
CREATE TABLE M_CREDIT_CARD (
  id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  strName           VARCHAR(200)      NOT NULL,
  intClosingDay     INT               NOT NULL,  -- 1 to 31
  intPaymentDay     INT               NOT NULL DEFAULT 5,
  decCurrentBalance DECIMAL(18,4)     NOT NULL DEFAULT 0,
  dateCreation      DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  dateModification  DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_CREDIT_CARD PRIMARY KEY (id)
)
GO

-- ============================================================
-- M_DEBIT_ACCOUNT
-- ============================================================
DROP TABLE IF EXISTS M_DEBIT_ACCOUNT
GO
CREATE TABLE M_DEBIT_ACCOUNT (
    id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    strName           NVARCHAR(100) NOT NULL,
    decCurrentBalance DECIMAL(18,4) NOT NULL DEFAULT 0,
    dateCreation      DATETIME NOT NULL DEFAULT dbo.fn_getcurrentdate(),
    dateModification  DATETIME NOT NULL DEFAULT dbo.fn_getcurrentdate(),
    CONSTRAINT PK_tDebitAccount PRIMARY KEY (id)
)
GO

-- ============================================================
-- M_IMPORT_BATCH
-- ============================================================
DROP TABLE IF EXISTS M_IMPORT_BATCH
GO
CREATE TABLE M_IMPORT_BATCH (
  id                    UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  accountId             UNIQUEIDENTIFIER  NOT NULL,
  accountType           NVARCHAR(20)      NOT NULL DEFAULT 'CREDIT_CARD',
  dateImport            DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  decUsdExchangeRate    DECIMAL(10,4)     NOT NULL DEFAULT 1.0,
  decBalanceAtImport    DECIMAL(18,2)     NULL,
  dateCreation          DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_IMPORT_BATCH PRIMARY KEY (id)
)
GO
CREATE INDEX IDX_IMPORT_BATCH_ACCOUNT ON M_IMPORT_BATCH (accountId)
GO

-- ============================================================
-- M_CATEGORY
-- ============================================================
DROP TABLE IF EXISTS M_CATEGORY
GO
CREATE TABLE M_CATEGORY (
  id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  strName           VARCHAR(200)      NOT NULL,
  dateCreation      DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  dateModification  DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_CATEGORY PRIMARY KEY (id)
)
GO

-- ============================================================
-- M_SUBCATEGORY
-- ============================================================
DROP TABLE IF EXISTS M_SUBCATEGORY
GO
CREATE TABLE M_SUBCATEGORY (
  id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  categoryId        UNIQUEIDENTIFIER  NOT NULL,
  strName           VARCHAR(200)      NOT NULL,
  dateCreation      DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  dateModification  DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_SUBCATEGORY PRIMARY KEY (id),
  CONSTRAINT FK_SUBCATEGORY_CATEGORY FOREIGN KEY (categoryId) REFERENCES M_CATEGORY(id)
)
GO
CREATE INDEX IDX_SUBCATEGORY_CATEGORY ON M_SUBCATEGORY (categoryId)
GO

-- ============================================================
-- M_CATEGORY_RULE
-- ============================================================
DROP TABLE IF EXISTS M_CATEGORY_RULE
GO
CREATE TABLE M_CATEGORY_RULE (
  id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  subcategoryId     UNIQUEIDENTIFIER  NOT NULL,
  strMatchString    VARCHAR(500)      NOT NULL,
  strMatchType      VARCHAR(20)       NOT NULL,  -- STARTS_WITH | CONTAINS | ENDS_WITH | EQUALS
  intPriority       INT               NOT NULL DEFAULT 100,
  dateCreation      DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  dateModification  DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_CATEGORY_RULE PRIMARY KEY (id),
  CONSTRAINT FK_CATEGORY_RULE_SUBCATEGORY FOREIGN KEY (subcategoryId) REFERENCES M_SUBCATEGORY(id)
)
GO
CREATE INDEX IDX_CATEGORY_RULE_SUBCATEGORY ON M_CATEGORY_RULE (subcategoryId)
GO
CREATE INDEX IDX_CATEGORY_RULE_PRIORITY ON M_CATEGORY_RULE (intPriority ASC)
GO

-- ============================================================
-- M_DUPLICATION_COLLECTION
-- ============================================================
DROP TABLE IF EXISTS M_DUPLICATION_COLLECTION
GO
CREATE TABLE M_DUPLICATION_COLLECTION (
  id                UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  strName           VARCHAR(200)      NOT NULL,
  dateCreation      DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  dateModification  DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_DUPLICATION_COLLECTION PRIMARY KEY (id)
)
GO

-- ============================================================
-- M_DUPLICATION_COLLECTION_STRING
-- ============================================================
DROP TABLE IF EXISTS M_DUPLICATION_COLLECTION_STRING
GO
CREATE TABLE M_DUPLICATION_COLLECTION_STRING (
  id            UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  collectionId  UNIQUEIDENTIFIER  NOT NULL,
  strValue      VARCHAR(500)      NOT NULL,
  dateCreation  DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_DUPLICATION_COLLECTION_STRING PRIMARY KEY (id),
  CONSTRAINT FK_DUPLICATION_STRING_COLLECTION FOREIGN KEY (collectionId) REFERENCES M_DUPLICATION_COLLECTION(id)
)
GO
CREATE INDEX IDX_DUPLICATION_STRING_COLLECTION ON M_DUPLICATION_COLLECTION_STRING (collectionId)
GO

-- ============================================================
-- M_TRANSACTION
-- (depends on M_IMPORT_BATCH, M_SUBCATEGORY)
-- ============================================================
DROP TABLE IF EXISTS M_TRANSACTION
GO
CREATE TABLE M_TRANSACTION (
  id                  UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  accountId           UNIQUEIDENTIFIER  NOT NULL,
  accountType         NVARCHAR(20)      NOT NULL DEFAULT 'CREDIT_CARD',
  importBatchId       UNIQUEIDENTIFIER  NULL,
  dateTransaction     DATE              NOT NULL,
  strDescription      VARCHAR(500)      NOT NULL,
  strCurrency         VARCHAR(3)        NOT NULL,  -- PEN | USD
  decAmount           DECIMAL(18,2)     NOT NULL,  -- negative=charge, positive=payment
  decAmountPen        DECIMAL(18,2)     NOT NULL,  -- always PEN; USD converted at import rate
  subcategoryId       UNIQUEIDENTIFIER  NULL,
  strNotes            VARCHAR(1000)     NULL,
  strOperationNumber  NVARCHAR(50)      NULL,
  transferGroupId     UNIQUEIDENTIFIER  NULL,
  strStatus           VARCHAR(20)       NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | DELETED | PENDING
  dateCreation        DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  dateModification    DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_TRANSACTION PRIMARY KEY (id),
  CONSTRAINT FK_TRANSACTION_BATCH FOREIGN KEY (importBatchId) REFERENCES M_IMPORT_BATCH(id),
  CONSTRAINT FK_TRANSACTION_SUBCATEGORY FOREIGN KEY (subcategoryId) REFERENCES M_SUBCATEGORY(id),
  CONSTRAINT CHK_TRANSACTION_STATUS CHECK (strStatus IN ('ACTIVE','DELETED','PENDING'))
)
GO
CREATE INDEX IDX_TRANSACTION_ACCOUNT ON M_TRANSACTION (accountId)
GO
CREATE INDEX IDX_TRANSACTION_DATE ON M_TRANSACTION (dateTransaction)
GO
CREATE INDEX IDX_TRANSACTION_ACCOUNT_DATE ON M_TRANSACTION (accountId, dateTransaction)
GO
CREATE INDEX IDX_TRANSACTION_BATCH ON M_TRANSACTION (importBatchId)
GO
CREATE INDEX IDX_TRANSACTION_STATUS ON M_TRANSACTION (strStatus)
GO

-- ============================================================
-- M_CYCLE_SNAPSHOT
-- ============================================================
DROP TABLE IF EXISTS M_CYCLE_SNAPSHOT
GO
CREATE TABLE M_CYCLE_SNAPSHOT (
  id                    UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  cardId                UNIQUEIDENTIFIER  NOT NULL,
  dateSnapshot          DATE              NOT NULL,
  decBalanceAtSnapshot  DECIMAL(18,2)     NOT NULL,  -- negative=owed
  strType               VARCHAR(20)       NOT NULL,   -- SNAPSHOT | CYCLE_CLOSE
  dateCreation          DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_CYCLE_SNAPSHOT PRIMARY KEY (id),
  CONSTRAINT FK_CYCLE_SNAPSHOT_CARD FOREIGN KEY (cardId) REFERENCES M_CREDIT_CARD(id)
)
GO
CREATE INDEX IDX_CYCLE_SNAPSHOT_CARD ON M_CYCLE_SNAPSHOT (cardId)
GO
CREATE INDEX IDX_CYCLE_SNAPSHOT_DATE ON M_CYCLE_SNAPSHOT (cardId, dateSnapshot)
GO

-- ============================================================
-- M_CYCLE_CLOSE
-- ============================================================
DROP TABLE IF EXISTS M_CYCLE_CLOSE
GO
CREATE TABLE M_CYCLE_CLOSE (
  id                      UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWSEQUENTIALID(),
  cardId                  UNIQUEIDENTIFIER  NOT NULL,
  dateClosing             DATE              NOT NULL,
  decOpeningBalance       DECIMAL(18,2)     NOT NULL,
  decClosingBalance       DECIMAL(18,2)     NOT NULL,
  decInterestAmount       DECIMAL(18,2)     NOT NULL DEFAULT 0,
  interestTransactionId   UNIQUEIDENTIFIER  NULL,
  dateCreation            DATETIME          NULL DEFAULT [dbo].[fn_getcurrentdate](),
  CONSTRAINT PK_CYCLE_CLOSE PRIMARY KEY (id),
  CONSTRAINT FK_CYCLE_CLOSE_CARD FOREIGN KEY (cardId) REFERENCES M_CREDIT_CARD(id),
  CONSTRAINT FK_CYCLE_CLOSE_INTEREST_TRX FOREIGN KEY (interestTransactionId) REFERENCES M_TRANSACTION(id)
)
GO
CREATE INDEX IDX_CYCLE_CLOSE_CARD ON M_CYCLE_CLOSE (cardId)
GO
CREATE INDEX IDX_CYCLE_CLOSE_DATE ON M_CYCLE_CLOSE (cardId, dateClosing)
GO

-- ============================================================
-- M_RECURRENT_TRANSACTION
-- ============================================================
DROP TABLE IF EXISTS M_RECURRENT_TRANSACTION
GO
CREATE TABLE M_RECURRENT_TRANSACTION (
    id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    strName             NVARCHAR(200) NOT NULL,
    strNotes            NVARCHAR(MAX) NULL,
    accountId           UNIQUEIDENTIFIER NOT NULL,
    accountType         NVARCHAR(20) NOT NULL,
    strFrequency        NVARCHAR(10) NOT NULL,
    strMatchMode        NVARCHAR(10) NOT NULL,
    strCurrency         NVARCHAR(3) NULL,
    decApproxAmount     DECIMAL(18,4) NULL,
    decAmountRange      DECIMAL(18,4) NULL,
    strMatchString      NVARCHAR(200) NULL,
    intApproxDay        INT NULL,
    intApproxMonth      INT NULL,
    intDayRange         INT NULL,
    dateCreation        DATETIME NOT NULL DEFAULT dbo.fn_getcurrentdate(),
    dateModification    DATETIME NOT NULL DEFAULT dbo.fn_getcurrentdate(),
    CONSTRAINT PK_tRecurrentTransaction PRIMARY KEY (id),
    CONSTRAINT CHK_tRecurrentTransaction_Freq CHECK (strFrequency IN ('MONTHLY','YEARLY')),
    CONSTRAINT CHK_tRecurrentTransaction_Mode CHECK (strMatchMode IN ('MANUAL','AUTOMATIC'))
)
GO

-- ============================================================
-- M_RECURRENT_TRANSACTION_MATCH
-- ============================================================
DROP TABLE IF EXISTS M_RECURRENT_TRANSACTION_MATCH
GO
CREATE TABLE M_RECURRENT_TRANSACTION_MATCH (
    id                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    recurrentTransactionId  UNIQUEIDENTIFIER NOT NULL,
    strIterationKey         NVARCHAR(7) NOT NULL,
    transactionId           UNIQUEIDENTIFIER NULL,
    boolDone                BIT NOT NULL DEFAULT 0,
    dateDone                DATE NULL,
    strMatchMode            NVARCHAR(10) NOT NULL,
    dateCreation            DATETIME NOT NULL DEFAULT dbo.fn_getcurrentdate(),
    dateModification        DATETIME NOT NULL DEFAULT dbo.fn_getcurrentdate(),
    CONSTRAINT PK_tRecurrentTransactionMatch PRIMARY KEY (id),
    CONSTRAINT FK_RecurrentMatch_Recurrent FOREIGN KEY (recurrentTransactionId)
        REFERENCES M_RECURRENT_TRANSACTION(id),
    CONSTRAINT FK_RecurrentMatch_Transaction FOREIGN KEY (transactionId)
        REFERENCES M_TRANSACTION(id),
    CONSTRAINT UQ_RecurrentMatch_Iteration UNIQUE (recurrentTransactionId, strIterationKey)
)
GO
CREATE INDEX IX_tRecurrentTransactionMatch_RecurrentId ON M_RECURRENT_TRANSACTION_MATCH(recurrentTransactionId)
GO
```

### 4.2 DDL — Stored Procedures (representative set)

The following stored procedures are representative of the full set. Each feature's `.sql` file contains all procedures for that table.

```sql
-- ============================================================
-- CreditCard procedures
-- ============================================================
DROP PROCEDURE IF EXISTS spCreditCard_GetAll
GO
CREATE PROCEDURE spCreditCard_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM M_CREDIT_CARD ORDER BY strName;
END
GO

DROP PROCEDURE IF EXISTS spCreditCard_Get
GO
CREATE PROCEDURE spCreditCard_Get
  @cardId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM M_CREDIT_CARD WHERE id = @cardId;
END
GO

DROP PROCEDURE IF EXISTS spCreditCard_Create_ReturnId
GO
CREATE PROCEDURE spCreditCard_Create_ReturnId
  @strName        VARCHAR(200),
  @intClosingDay  INT,
  @insertedId     UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @tableInsertedId TABLE (id UNIQUEIDENTIFIER);
  INSERT INTO M_CREDIT_CARD (strName, intClosingDay)
  OUTPUT INSERTED.id INTO @tableInsertedId
  VALUES (@strName, @intClosingDay);
  SET @insertedId = (SELECT id FROM @tableInsertedId);
END
GO

DROP PROCEDURE IF EXISTS spCreditCard_Update
GO
CREATE PROCEDURE spCreditCard_Update
  @cardId         UNIQUEIDENTIFIER,
  @strName        VARCHAR(200) = NULL,
  @intClosingDay  INT          = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE M_CREDIT_CARD SET
    strName          = ISNULL(@strName,       strName),
    intClosingDay    = ISNULL(@intClosingDay, intClosingDay),
    dateModification = [dbo].[fn_getcurrentdate]()
  WHERE id = @cardId;
END
GO

-- ============================================================
-- Transaction procedures
-- ============================================================
DROP PROCEDURE IF EXISTS spTransaction_GetByCard
GO
CREATE PROCEDURE spTransaction_GetByCard
  @cardId       UNIQUEIDENTIFIER,
  @dateFrom     DATE = NULL,
  @dateTo       DATE = NULL,
  @strStatus    VARCHAR(20) = 'ACTIVE'
AS
BEGIN
  SET NOCOUNT ON;
  SELECT T.*,
         S.strName AS subcategoryName,
         C.strName AS categoryName
  FROM M_TRANSACTION T
  LEFT JOIN M_SUBCATEGORY S ON S.id = T.subcategoryId
  LEFT JOIN M_CATEGORY    C ON C.id = S.categoryId
  WHERE T.accountId   = @cardId
    AND T.accountType = 'CREDIT_CARD'
    AND T.strStatus = ISNULL(@strStatus, T.strStatus)
    AND (@dateFrom IS NULL OR T.dateTransaction >= @dateFrom)
    AND (@dateTo   IS NULL OR T.dateTransaction <= @dateTo)
  ORDER BY T.dateTransaction DESC, T.dateCreation DESC;
END
GO

DROP PROCEDURE IF EXISTS spTransaction_GetByBatch
GO
CREATE PROCEDURE spTransaction_GetByBatch
  @importBatchId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM M_TRANSACTION
  WHERE importBatchId = @importBatchId
  ORDER BY dateTransaction DESC, dateCreation DESC;
END
GO

DROP PROCEDURE IF EXISTS spTransaction_Create_ReturnId
GO
CREATE PROCEDURE spTransaction_Create_ReturnId
  @accountId        UNIQUEIDENTIFIER,
  @accountType      NVARCHAR(20),
  @importBatchId    UNIQUEIDENTIFIER = NULL,
  @dateTransaction  DATE,
  @strDescription   VARCHAR(500),
  @strCurrency      VARCHAR(3),
  @decAmount        DECIMAL(18,2),
  @decAmountPen     DECIMAL(18,2),
  @subcategoryId    UNIQUEIDENTIFIER = NULL,
  @strNotes         VARCHAR(1000)    = NULL,
  @insertedId       UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @tableInsertedId TABLE (id UNIQUEIDENTIFIER);
  INSERT INTO M_TRANSACTION (
    accountId, accountType, importBatchId, dateTransaction, strDescription,
    strCurrency, decAmount, decAmountPen, subcategoryId, strNotes
  )
  OUTPUT INSERTED.id INTO @tableInsertedId
  VALUES (
    @accountId, @accountType, @importBatchId, @dateTransaction, @strDescription,
    @strCurrency, @decAmount, @decAmountPen, @subcategoryId, @strNotes
  );
  SET @insertedId = (SELECT id FROM @tableInsertedId);
END
GO

DROP PROCEDURE IF EXISTS spTransaction_SoftDelete
GO
CREATE PROCEDURE spTransaction_SoftDelete
  @transactionId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE M_TRANSACTION SET
    strStatus        = 'DELETED',
    dateModification = [dbo].[fn_getcurrentdate]()
  WHERE id = @transactionId;
END
GO

DROP PROCEDURE IF EXISTS spTransaction_UpdateCategory
GO
CREATE PROCEDURE spTransaction_UpdateCategory
  @transactionId  UNIQUEIDENTIFIER,
  @subcategoryId  UNIQUEIDENTIFIER = NULL,
  @strNotes       VARCHAR(1000)    = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE M_TRANSACTION SET
    subcategoryId    = ISNULL(@subcategoryId, subcategoryId),
    strNotes         = ISNULL(@strNotes,      strNotes),
    dateModification = [dbo].[fn_getcurrentdate]()
  WHERE id = @transactionId;
END
GO

-- ============================================================
-- ImportBatch procedures
-- ============================================================
DROP PROCEDURE IF EXISTS spImportBatch_Create_ReturnId
GO
CREATE PROCEDURE spImportBatch_Create_ReturnId
  @accountId            UNIQUEIDENTIFIER,
  @accountType          NVARCHAR(20),
  @decUsdExchangeRate   DECIMAL(10,4),
  @decBalanceAtImport   DECIMAL(18,2) = NULL,
  @insertedId           UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @tableInsertedId TABLE (id UNIQUEIDENTIFIER);
  INSERT INTO M_IMPORT_BATCH (accountId, accountType, decUsdExchangeRate, decBalanceAtImport)
  OUTPUT INSERTED.id INTO @tableInsertedId
  VALUES (@accountId, @accountType, @decUsdExchangeRate, @decBalanceAtImport);
  SET @insertedId = (SELECT id FROM @tableInsertedId);
END
GO

-- Returns all active transactions from [dateFrom] forward for duplication checking
DROP PROCEDURE IF EXISTS spTransaction_GetForDuplicationCheck
GO
CREATE PROCEDURE spTransaction_GetForDuplicationCheck
  @accountId    UNIQUEIDENTIFIER,
  @accountType  NVARCHAR(20),
  @dateFrom     DATE
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, dateTransaction, strDescription, strCurrency, decAmount
  FROM M_TRANSACTION
  WHERE accountId   = @accountId
    AND accountType = @accountType
    AND strStatus   = 'ACTIVE'
    AND dateTransaction >= @dateFrom;
END
GO

-- ============================================================
-- Category / Subcategory procedures
-- ============================================================
DROP PROCEDURE IF EXISTS spCategory_GetAll
GO
CREATE PROCEDURE spCategory_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT C.*, S.id AS subcategoryId, S.strName AS subcategoryName
  FROM M_CATEGORY C
  LEFT JOIN M_SUBCATEGORY S ON S.categoryId = C.id
  ORDER BY C.strName, S.strName;
END
GO

DROP PROCEDURE IF EXISTS spCategoryRule_GetAllOrdered
GO
CREATE PROCEDURE spCategoryRule_GetAllOrdered
AS
BEGIN
  SET NOCOUNT ON;
  SELECT R.*, S.strName AS subcategoryName, C.strName AS categoryName, C.id AS categoryId
  FROM M_CATEGORY_RULE R
  JOIN M_SUBCATEGORY S ON S.id = R.subcategoryId
  JOIN M_CATEGORY    C ON C.id = S.categoryId
  ORDER BY R.intPriority ASC;
END
GO

-- ============================================================
-- Conciliation procedures
-- ============================================================
DROP PROCEDURE IF EXISTS spTransaction_SumByCardAndDateRange
GO
CREATE PROCEDURE spTransaction_SumByCardAndDateRange
  @cardId     UNIQUEIDENTIFIER,
  @dateFrom   DATE,
  @dateTo     DATE
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    SUM(decAmountPen) AS totalAmountPen,
    COUNT(*)          AS transactionCount
  FROM M_TRANSACTION
  WHERE accountId       = @cardId
    AND accountType     = 'CREDIT_CARD'
    AND strStatus       = 'ACTIVE'
    AND dateTransaction >= @dateFrom
    AND dateTransaction <= @dateTo;
END
GO

DROP PROCEDURE IF EXISTS spCycleClose_GetLatestByCard
GO
CREATE PROCEDURE spCycleClose_GetLatestByCard
  @cardId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 *
  FROM M_CYCLE_CLOSE
  WHERE cardId = @cardId
  ORDER BY dateClosing DESC;
END
GO

DROP PROCEDURE IF EXISTS spCycleClose_Create_ReturnId
GO
CREATE PROCEDURE spCycleClose_Create_ReturnId
  @cardId                   UNIQUEIDENTIFIER,
  @dateClosing              DATE,
  @decOpeningBalance        DECIMAL(18,2),
  @decClosingBalance        DECIMAL(18,2),
  @decInterestAmount        DECIMAL(18,2),
  @interestTransactionId    UNIQUEIDENTIFIER = NULL,
  @insertedId               UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @tableInsertedId TABLE (id UNIQUEIDENTIFIER);
  INSERT INTO M_CYCLE_CLOSE (
    cardId, dateClosing, decOpeningBalance,
    decClosingBalance, decInterestAmount, interestTransactionId
  )
  OUTPUT INSERTED.id INTO @tableInsertedId
  VALUES (
    @cardId, @dateClosing, @decOpeningBalance,
    @decClosingBalance, @decInterestAmount, @interestTransactionId
  );
  SET @insertedId = (SELECT id FROM @tableInsertedId);
END
GO

DROP PROCEDURE IF EXISTS spCycleSnapshot_Create_ReturnId
GO
CREATE PROCEDURE spCycleSnapshot_Create_ReturnId
  @cardId               UNIQUEIDENTIFIER,
  @dateSnapshot         DATE,
  @decBalanceAtSnapshot DECIMAL(18,2),
  @strType              VARCHAR(20),
  @insertedId           UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @tableInsertedId TABLE (id UNIQUEIDENTIFIER);
  INSERT INTO M_CYCLE_SNAPSHOT (cardId, dateSnapshot, decBalanceAtSnapshot, strType)
  OUTPUT INSERTED.id INTO @tableInsertedId
  VALUES (@cardId, @dateSnapshot, @decBalanceAtSnapshot, @strType);
  SET @insertedId = (SELECT id FROM @tableInsertedId);
END
GO
```

---

## 5. Business Logic

### 5.1 Cycle Definition

For a card with `intClosingDay = D`:

- **Cycle start:** Day `D + 1` of the previous calendar month
- **Cycle end:** Day `D` of the current calendar month

Example (D = 10, user runs closure on the 16th of June):
- Cycle: May 11 through June 10
- Post-close window: June 11 through June 16 (day user runs the process)

Edge case: if `D = 31` and the month has fewer than 31 days, use the last day of the month for the closing date.

### 5.2 Import Flow

```
Step 1 — Upload screen
  User selects:
    - Card (dropdown from M_CREDIT_CARD)
    - Excel file (.xlsx)
    - Current balance on card (will be stored in ImportBatch.decBalanceAtImport)
    - USD/PEN exchange rate for today

Step 2 — Backend processing (ImportBatchHandler)
  a. Parse Excel: read Fecha, Descripcion, Moneda, Monto columns
     - Moneda "S/" → strCurrency = "PEN"; decAmountPen = Monto
     - Moneda "$"  → strCurrency = "USD"; decAmountPen = Monto × usdExchangeRate
  b. Create ImportBatch record in DB
  c. Load existing ACTIVE transactions for this card from DB
     (fetch from earliest incoming date − 5 days onward, for display and dedup purposes)
  d. Run duplication detection (see 5.3)
  e. Run category auto-matching (see 5.4)
  f. Return ImportReviewPayload to frontend

Step 3 — Review screen (frontend)
  - Show incoming rows grouped by day (descending)
  - Each incoming row: checkbox, date, description, subcategory dropdown, amount, amountPen, context menu
  - Incoming rows flagged AUTO_DUPLICATE: unchecked by default, grayed out
  - Incoming rows flagged POTENTIAL_DUPLICATE: highlighted (yellow/orange), checked by default
    - Display the matching existing transaction directly beneath it as a reference row
  - Existing transactions within 5 days before the earliest incoming date:
    shown as read-only rows with a trash icon for deletion
  - Context menu on incoming rows: "Add additional info" → opens a modal with free-text note field
  - Subcategory dropdown is pre-filled from auto-match; user may override

Step 4 — Confirm (POST to /import-batch/{id}/confirm)
  - Send: list of checked incoming rows with final subcategoryId and notes for each
  - Backend inserts each as a M_TRANSACTION row linked to the ImportBatch
  - Any existing rows the user deleted via the trash icon are soft-deleted
```

### 5.3 Duplication Detection

All checks compare incoming transactions against existing ACTIVE transactions for the same card. Results are computed client-side after the backend returns the candidate dataset, or entirely server-side — either approach works; document assumes server-side in `DuplicationLogic.java`.

#### Auto-ignore rules (flag = `AUTO_DUPLICATE`, incoming row unchecked by default)

| Rule | Condition |
|---|---|
| Rule A1 — Exact match | Same dateTransaction + strDescription + strCurrency + decAmount |
| Rule A2 — USD same-amount date-window | USD only: same strDescription + same decAmount, existing date within ±3 days of incoming date |

#### Potential duplicate rules (flag = `POTENTIAL_DUPLICATE`, row highlighted, user decides)

| Rule | Condition |
|---|---|
| Rule P1 — Amount + prefix + date | Same decAmount AND first 10 chars of strDescription match (case-insensitive) AND date within ±3 days |
| Rule P2 — Amount + date only | Same decAmount AND date within ±3 days (regardless of description) |
| Rule P3 — Collection-based | Description contains any string from a DuplicationCollection (case-insensitive); AND existing transaction description also contains any string from that same collection; AND same decAmount + strCurrency + date within ±3 days |

#### Algorithm

```
For each incoming transaction T:
  1. Check A1 → if match: mark AUTO_DUPLICATE, stop further checks for T
  2. Check A2 → if match: mark AUTO_DUPLICATE, stop further checks for T
  3. Collect all P-rule matches for T into a list of (matchedExistingTrx, ruleType)
  4. If list non-empty: mark POTENTIAL_DUPLICATE, attach matchedExistingTrx list
  5. Otherwise: mark CLEAN (no flag)

All rules must be evaluated before any result is returned.
```

**Implementation note:** Load all existing transactions for the card from `(minIncomingDate − 3 days)` onward. Load all `M_DUPLICATION_COLLECTION_STRING` rows. Run the checks in Java (no SQL per-transaction). This is performed in `DuplicationLogic.java` as a stateless service call.

### 5.4 Category Auto-Matching

```java
// Pseudo-code for matching a single transaction description
List<CategoryRule> rules = ruleRepository.getAllOrderedByPriority();  // intPriority ASC
for (CategoryRule rule : rules) {
    String desc    = transaction.strDescription.toUpperCase();
    String pattern = rule.strMatchString.toUpperCase();
    boolean matches = switch (rule.strMatchType) {
        case "STARTS_WITH" -> desc.startsWith(pattern);
        case "ENDS_WITH"   -> desc.endsWith(pattern);
        case "EQUALS"      -> desc.equals(pattern);
        case "CONTAINS"    -> desc.contains(pattern);
        default            -> false;
    };
    if (matches) {
        transaction.suggestedSubcategoryId = rule.subcategoryId;
        break;  // first match wins
    }
}
```

The `suggestedSubcategoryId` is returned in the import review payload. The user's final subcategory selection overrides it at confirm time.

### 5.5 Cycle Reconciliation

```
Inputs (from user via UI):
  - cardId
  - currentBalance   (amount owed today, e.g. −1,350.00 in PEN)
  - todayDate        (date user is running the reconciliation)
  - usdExchangeRate  (only needed if any post-close transactions are USD; or use import-time rates)

Step 1 — Compute cycle boundaries
  closingDate  = last occurrence of intClosingDay on or before todayDate
  cycleStart   = closingDate of previous month + 1 day

Step 2 — Retrieve openingBalance
  Latest M_CYCLE_CLOSE.decClosingBalance for this card where dateClosing < cycleStart
  If none exists → openingBalance = 0  (see Open Question #2)

Step 3 — Sum cycle transactions
  cycleMovementsSum = SUM(decAmountPen) for ACTIVE transactions
                      WHERE accountId = @cardId
                        AND accountType = 'CREDIT_CARD'
                        AND dateTransaction BETWEEN cycleStart AND closingDate

Step 4 — Expected balance at closing date
  amountA = openingBalance + cycleMovementsSum

Step 5 — Sum post-close transactions (from day after closingDate to todayDate)
  postCloseMovementsSum = SUM(decAmountPen) for ACTIVE transactions
                          WHERE dateTransaction BETWEEN (closingDate + 1) AND todayDate

Step 6 — Implied balance at closing date
  amountB = currentBalance − postCloseMovementsSum

Step 7 — Interest detection
  interest = amountB − amountA
  (if amountA == amountB → no interest)

Step 8 — Persist results
  a. If interest != 0:
     Create M_TRANSACTION: accountId=cardId, accountType='CREDIT_CARD', dateTransaction=closingDate,
       strDescription="INTEREST CHARGE", strCurrency="PEN", decAmount=interest,
       decAmountPen=interest, strStatus='ACTIVE'
     Save interestTransactionId
  b. Create M_CYCLE_CLOSE:
     cardId, dateClosing=closingDate, decOpeningBalance=openingBalance,
     decClosingBalance=amountB, decInterestAmount=interest, interestTransactionId
  c. Create M_CYCLE_SNAPSHOT:
     cardId, dateSnapshot=closingDate, decBalanceAtSnapshot=amountB, strType='CYCLE_CLOSE'
```

**Sign convention:** All balances use the same sign as transactions. "I owe 1,350 soles" is stored as `−1350.00`. See Open Question #1 regarding how the UI collects this.

---

## 6. Angular Feature Structure

### 6.1 Directory Layout

```
src/app/
├── application/
│   ├── app.component.ts
│   ├── app.module.ts
│   ├── app.routes.catalog.ts        ← add CREDIT_CARD routes here
│   └── app.routes.module.ts         ← add lazy-load entry for credit-card module
├── features/
│   ├── app/                         ← existing home/about
│   └── credit-card/                 ← NEW lazy-loaded feature
│       ├── credit-card.module.ts
│       ├── credit-card.routes.ts
│       ├── list/                    ← card dashboard / card selector
│       │   ├── list.component.ts
│       │   └── list.component.html
│       ├── detail/                  ← transaction list for one card
│       │   ├── detail.component.ts
│       │   └── detail.component.html
│       ├── import/
│       │   ├── import-upload/       ← step 1: file upload + card + balance + rate
│       │   │   ├── import-upload.component.ts
│       │   │   └── import-upload.component.html
│       │   └── import-review/       ← step 2: review table, confirm
│       │       ├── import-review.component.ts
│       │       └── import-review.component.html
│       ├── conciliation/            ← reconciliation flow for one card
│       │   ├── conciliation.component.ts
│       │   └── conciliation.component.html
│       └── config/
│           ├── categories/          ← category + subcategory CRUD
│           │   ├── categories.component.ts
│           │   └── categories.component.html
│           ├── category-rules/      ← rule table, priority reorder, test field
│           │   ├── category-rules.component.ts
│           │   └── category-rules.component.html
│           └── duplication-collections/  ← collection CRUD
│               ├── duplication-collections.component.ts
│               └── duplication-collections.component.html
├── logic/
│   ├── constants.ts
│   ├── utilities.ts
│   ├── services/
│   │   ├── base.service.ts
│   │   ├── credit-card.service.ts   ← NEW
│   │   ├── transaction.service.ts   ← NEW
│   │   ├── import-batch.service.ts  ← NEW
│   │   ├── category.service.ts      ← NEW
│   │   └── conciliation.service.ts  ← NEW
│   └── types/
│       ├── user.ts
│       ├── credit-card.ts           ← NEW
│       ├── transaction.ts           ← NEW
│       ├── import-batch.ts          ← NEW
│       ├── category.ts              ← NEW
│       └── conciliation.ts          ← NEW
└── shared/
    └── shared.module.ts
```

### 6.2 Route Catalog Additions

Add to `app.routes.catalog.ts`:

```typescript
export const CatalogRoutes = {
  APP: 'app',
  HOME: 'home',
  ABOUT: 'about',
  ERROR: 'error',

  CREDIT_CARD: {
    BASE: 'credit-card',
    LIST: 'list',
    DETAIL: (cardId: string) => `detail/${cardId}`,
    IMPORT: (cardId: string) => `import/${cardId}`,
    IMPORT_REVIEW: 'import-review',
    CONCILIATION: (cardId: string) => `conciliation/${cardId}`,
    CONFIG: {
      BASE: 'config',
      CATEGORIES: 'categories',
      CATEGORY_RULES: 'category-rules',
      DUPLICATION_COLLECTIONS: 'duplication-collections',
    },
  },
} as const;
```

### 6.3 Lazy-Load Entry in `app.routes.module.ts`

```typescript
{
  path: routectlg.CREDIT_CARD.BASE,
  component: FrameComponent,
  loadChildren: () =>
    import('../features/credit-card/credit-card.module')
      .then(m => m.CreditCardModule)
}
```

### 6.4 TypeScript Types (`src/app/logic/types/`)

**`credit-card.ts`**
```typescript
export class CreditCard {
  id: string = '';
  strName: string = '';
  intClosingDay: number = 1;
  dateCreation: Date = new Date();
  dateModification: Date = new Date();
}
```

**`transaction.ts`**
```typescript
export class Transaction {
  id: string = '';
  accountId: string = '';
  accountType: string = 'CREDIT_CARD';  // 'CREDIT_CARD' | 'DEBIT_ACCOUNT'
  importBatchId: string | null = null;
  dateTransaction: string = '';    // 'YYYY-MM-DD'
  strDescription: string = '';
  strCurrency: string = 'PEN';     // 'PEN' | 'USD'
  decAmount: number = 0;
  decAmountPen: number = 0;
  subcategoryId: string | null = null;
  strNotes: string | null = null;
  strOperationNumber: string | null = null;
  transferGroupId: string | null = null;
  strStatus: string = 'ACTIVE';    // 'ACTIVE' | 'DELETED' | 'PENDING'
  // Joined fields (read-only, from SP)
  subcategoryName?: string;
  categoryName?: string;
}
```

**`import-batch.ts`**
```typescript
export class ImportReviewRow {
  // Parsed from Excel
  dateTransaction: string = '';
  strDescription: string = '';
  strCurrency: string = 'PEN';
  decAmount: number = 0;
  decAmountPen: number = 0;
  // Set by backend
  suggestedSubcategoryId: string | null = null;
  duplicationFlag: 'CLEAN' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE' = 'CLEAN';
  matchedExistingTransactions: Transaction[] = [];
  // UI state
  checked: boolean = true;
  selectedSubcategoryId: string | null = null;
  notes: string | null = null;
}

export class ImportReviewPayload {
  importBatchId: string = '';
  incomingRows: ImportReviewRow[] = [];
  existingNearbyRows: Transaction[] = [];  // read-only, within 5 days before earliest incoming
}
```

**`category.ts`**
```typescript
export class Category {
  id: string = '';
  strName: string = '';
  subcategories: Subcategory[] = [];
}

export class Subcategory {
  id: string = '';
  categoryId: string = '';
  strName: string = '';
}

export class CategoryRule {
  id: string = '';
  subcategoryId: string = '';
  subcategoryName: string = '';
  categoryId: string = '';
  categoryName: string = '';
  strMatchString: string = '';
  strMatchType: 'STARTS_WITH' | 'CONTAINS' | 'ENDS_WITH' | 'EQUALS' = 'CONTAINS';
  intPriority: number = 100;
}

export class DuplicationCollection {
  id: string = '';
  strName: string = '';
  strings: string[] = [];
}
```

**`conciliation.ts`**
```typescript
export class ConciliationRequest {
  cardId: string = '';
  currentBalance: number = 0;   // see Open Question #1
  todayDate: string = '';       // 'YYYY-MM-DD'
}

export class ConciliationPreview {
  cycleStart: string = '';
  closingDate: string = '';
  openingBalance: number = 0;
  cycleMovementsSum: number = 0;
  amountA: number = 0;
  postCloseMovementsSum: number = 0;
  amountB: number = 0;
  interest: number = 0;
  hasInterest: boolean = false;
}
```

### 6.5 Service Pattern

Each service extends `BaseService`. Example for `CreditCardService`:

```typescript
@Injectable({ providedIn: 'root' })
export class CreditCardService extends BaseService {
  private cards$ = new BehaviorSubject<CreditCard[]>([]);

  constructor(private http: HttpClient) {
    super('CreditCardService');
    this.apiBase = 'credit-card';
  }

  getAll(): Observable<CreditCard[]> {
    this.loading.next(true);
    return this.http.get<CreditCard[]>(this.buildURL('list')).pipe(
      tap(data => this.cards$.next(data)),
      catchError(this.handleError<CreditCard[]>('getAll', [])),
      finalize(() => this.loading.next(false))
    );
  }

  getCards$(): Observable<CreditCard[]> {
    return this.cards$.asObservable();
  }
}
```

### 6.6 Import Review Screen — UI Details

The import review screen (`import-review.component`) is the most complex UI component.

**Layout:**
- Full-width table grouped by day (mat-expansion-panel per day or sticky date headers)
- Each row has: checkbox | date | description | subcategory (mat-select) | amount | amountPen | action menu (mat-menu)
- Rows with `duplicationFlag = AUTO_DUPLICATE`: gray background, checkbox unchecked and disabled
- Rows with `duplicationFlag = POTENTIAL_DUPLICATE`: yellow/orange background; the matching existing transaction appears as a read-only indented sub-row beneath it
- Existing nearby rows (read-only): distinguished by a different row style (e.g., lighter background, italic description), with a trash icon button
- "Add additional info" in the context menu opens a `MatDialog` containing a single `<textarea>` for free-text notes

**State management:**
- `BehaviorSubject<ImportReviewRow[]>` holds the mutable list of incoming rows
- Checkbox toggle, subcategory change, and notes are all mutations on that subject
- "Confirm" button calls `importBatchService.confirm(batchId, checkedRows)` then navigates to the card detail

---

## 7. Java Feature Structure

### 7.1 Directory Layout

```
src/main/java/com/fsapps/pfmg/
├── config/
│   └── Config.java
├── handler/
│   └── AzureFunctionHandler.java    ← existing; add new @FunctionName methods or split into per-feature handlers
├── utils/
│   └── database/
│       ├── AsyncDBHelper.java
│       └── CustomRowMapper.java
└── features/
    ├── salutation/                  ← existing
    ├── creditcard/
    │   ├── CreditCardHandler.java   ← @FunctionName HTTP triggers
    │   ├── CreditCardLogic.java     ← business logic, implements Function<>
    │   └── card/
    │       ├── CreditCardEntity.java
    │       ├── CreditCardRepository.java
    │       └── M_CREDIT_CARD.sql
    ├── transaction/
    │   ├── TransactionHandler.java
    │   ├── TransactionLogic.java
    │   └── transaction/
    │       ├── TransactionEntity.java
    │       ├── TransactionRepository.java
    │       └── M_TRANSACTION.sql
    ├── importbatch/
    │   ├── ImportBatchHandler.java   ← file upload, parse, dedup, category match
    │   ├── ImportBatchLogic.java
    │   └── importbatch/
    │       ├── ImportBatchEntity.java
    │       ├── ImportBatchRepository.java
    │       ├── ImportReviewRow.java  ← DTO (incoming row + flags + suggested category)
    │       ├── ImportReviewPayload.java  ← full response for review screen
    │       ├── ImportConfirmRequest.java ← request body for confirm step
    │       └── M_IMPORT_BATCH.sql
    ├── category/
    │   ├── CategoryHandler.java
    │   ├── CategoryLogic.java
    │   └── category/
    │       ├── CategoryEntity.java
    │       ├── CategoryRepository.java
    │       ├── M_CATEGORY.sql
    │       ├── subcategory/
    │       │   ├── SubcategoryEntity.java
    │       │   ├── SubcategoryRepository.java
    │       │   └── M_SUBCATEGORY.sql
    │       └── categoryrule/
    │           ├── CategoryRuleEntity.java
    │           ├── CategoryRuleRepository.java
    │           └── M_CATEGORY_RULE.sql
    ├── conciliation/
    │   ├── ConciliationHandler.java
    │   ├── ConciliationLogic.java
    │   └── model/
    │       ├── CycleSnapshotEntity.java
    │       ├── CycleSnapshotRepository.java
    │       ├── CycleCloseEntity.java
    │       ├── CycleCloseRepository.java
    │       ├── M_CYCLE_SNAPSHOT.sql
    │       └── M_CYCLE_CLOSE.sql
    ├── duplication/
    │   ├── DuplicationCollectionHandler.java
    │   ├── DuplicationLogic.java      ← stateless; only input/output, no DB calls
    │   └── collection/
    │       ├── DuplicationCollectionEntity.java
    │       ├── DuplicationCollectionRepository.java
    │       ├── DuplicationCollectionStringEntity.java
    │       └── M_DUPLICATION_COLLECTION.sql
    ├── debitaccount/
    │   ├── DebitAccountHandler.java       ← @FunctionName HTTP trigger methods
    │   ├── DebitAccountService.java
    │   ├── DebitAccountRepository.java
    │   └── dto/
    │       ├── DebitAccountDto.java
    │       └── DebitAccountCreateRequest.java
    └── recurrent/
        ├── RecurrentTransactionHandler.java
        ├── RecurrentTransactionService.java
        ├── RecurrentTransactionRepository.java
        ├── RecurrentMatchingLogic.java   ← pure stateless matching algorithm (no DB calls)
        └── dto/
            ├── RecurrentTransactionDto.java
            ├── RecurrentTransactionCreateRequest.java
            ├── RecurrentMatchDto.java
            └── RecurrentDashboardItemDto.java  ← includes current iteration status
```

### 7.2 Key Entity Classes

**`CreditCardEntity.java`**
```java
public class CreditCardEntity {
  public String id;
  public String strName;
  public Integer intClosingDay;
  // dateCreation / dateModification are not required in response; omit or include as LocalDateTime
}
```

**`TransactionEntity.java`**
```java
public class TransactionEntity {
  public String id;
  public String accountId;
  public String accountType;
  public String importBatchId;
  public LocalDate dateTransaction;   // CustomRowMapper maps DATE → LocalDate
  public String strDescription;
  public String strCurrency;
  public Double decAmount;
  public Double decAmountPen;
  public String subcategoryId;
  public String strNotes;
  public String strOperationNumber;
  public String transferGroupId;
  public String strStatus;
  // Joined fields (populated from SP joins)
  public String subcategoryName;
  public String categoryName;
}
```

**`ImportReviewRow.java`** (DTO)
```java
public class ImportReviewRow {
  public LocalDate dateTransaction;
  public String strDescription;
  public String strCurrency;
  public Double decAmount;
  public Double decAmountPen;
  public String suggestedSubcategoryId;
  public String duplicationFlag;           // "CLEAN" | "AUTO_DUPLICATE" | "POTENTIAL_DUPLICATE"
  public List<TransactionEntity> matchedExistingTransactions;
}
```

**`ImportConfirmRequest.java`** (request body)
```java
public class ImportConfirmRequest {
  public String importBatchId;
  public List<ConfirmedRow> rows;
  public List<String> transactionIdsToDelete;  // existing rows the user deleted via trash icon

  public static class ConfirmedRow {
    public LocalDate dateTransaction;
    public String strDescription;
    public String strCurrency;
    public Double decAmount;
    public Double decAmountPen;
    public String subcategoryId;
    public String strNotes;
  }
}
```

### 7.3 Handler Pattern

Each handler class holds `@FunctionName` methods following the pattern in `AzureFunctionHandler.java`. One handler class per domain feature is preferred; for large features (transaction), split into multiple `@Component` handler classes and register them in `Config.java`.

```java
@Component
public class CreditCardHandler {

  @Autowired
  private CreditCardLogic creditCardLogic;

  @FunctionName("creditCard_GetAll")
  public HttpResponseMessage getAll(
      @HttpTrigger(name = "req",
                   methods = { HttpMethod.GET },
                   authLevel = AuthorizationLevel.ANONYMOUS,
                   route = "credit-card/list")
      HttpRequestMessage<Optional<String>> request,
      ExecutionContext context) {

    List<CreditCardEntity> cards = creditCardLogic.getAll();
    return request.createResponseBuilder(HttpStatus.OK)
        .body(cards)
        .header("Content-Type", "application/json")
        .build();
  }
}
```

### 7.4 `DuplicationLogic.java` Signature

`DuplicationLogic` is a stateless Spring `@Component`. All data must be passed in; it makes no DB calls.

```java
@Component
public class DuplicationLogic {

  /**
   * Annotates each incoming transaction with a duplication flag.
   *
   * @param incoming   Parsed rows from the Excel file
   * @param existing   Existing ACTIVE transactions for this card
   * @param collections All DuplicationCollections with their string lists
   * @return           Same list with duplicationFlag and matchedExistingTransactions populated
   */
  public List<ImportReviewRow> detectDuplicates(
      List<ImportReviewRow> incoming,
      List<TransactionEntity> existing,
      List<DuplicationCollectionEntity> collections) { ... }
}
```

### 7.5 `RecurrentMatchingLogic.java` Signature

`RecurrentMatchingLogic` is a pure stateless class. All data is passed in; it makes no DB calls and has no `@Autowired` dependencies.

```java
// Pure stateless service; all data passed in. No @Autowired DB dependencies.
public class RecurrentMatchingLogic {
    public List<RecurrentMatchResult> findAutomaticMatches(
        List<RecurrentTransactionDto> recurrents,
        List<RecurrentMatchDto> existingMatches,
        List<TransactionDto> activeTransactions,
        LocalDate todayDate
    ) { ... }
}
```

---

## 8. API Endpoints

All routes are Azure Functions HTTP triggers. Base URL is the Azure Function App URL. Routes follow the pattern `/{feature}/{action}`.

Request and response bodies are JSON. All IDs are UUID strings.

### 8.1 Credit Card

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `creditCard_GetAll` | GET | `/credit-card/list` | — | `CreditCard[]` |
| `creditCard_Get` | GET | `/credit-card/{cardId}` | — | `CreditCard` |
| `creditCard_Create` | POST | `/credit-card/create` | `{ strName, intClosingDay }` | `{ id }` |
| `creditCard_Update` | PUT | `/credit-card/{cardId}/update` | `{ strName?, intClosingDay? }` | `204` |

### 8.2 Transaction

> **Note:** The `cardId` field in request bodies is replaced by `accountId` + `accountType`.

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `transaction_GetByCard` | GET | `/transaction/list` | Query: `accountId`, `accountType`, `dateFrom?`, `dateTo?` | `Transaction[]` |
| `transaction_UpdateCategory` | PUT | `/transaction/{transactionId}/category` | `{ subcategoryId?, strNotes? }` | `204` |
| `transaction_Delete` | DELETE | `/transaction/{transactionId}` | — | `204` |

### 8.3 Import Batch

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `importBatch_Upload` | POST | `/import-batch/upload` | `multipart/form-data`: `file` (.xlsx), `accountId`, `accountType`, `decBalanceAtImport`, `decUsdExchangeRate` | `ImportReviewPayload` |
| `importBatch_Confirm` | POST | `/import-batch/{importBatchId}/confirm` | `ImportConfirmRequest` | `{ savedCount: number }` |
| `importBatch_GetByCard` | GET | `/import-batch/list` | Query: `accountId`, `accountType` | `ImportBatch[]` |

**`ImportReviewPayload` response shape:**
```json
{
  "importBatchId": "uuid",
  "incomingRows": [
    {
      "dateTransaction": "2026-05-10",
      "strDescription": "UBER EATS",
      "strCurrency": "PEN",
      "decAmount": -28.50,
      "decAmountPen": -28.50,
      "suggestedSubcategoryId": "uuid-or-null",
      "duplicationFlag": "CLEAN",
      "matchedExistingTransactions": []
    }
  ],
  "existingNearbyRows": [
    {
      "id": "uuid",
      "dateTransaction": "2026-05-06",
      "strDescription": "SAGA FALABELLA",
      "strCurrency": "PEN",
      "decAmount": -150.00,
      "decAmountPen": -150.00,
      "strStatus": "ACTIVE"
    }
  ]
}
```

### 8.4 Category

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `category_GetAll` | GET | `/category/list` | — | `Category[]` (with nested subcategories) |
| `category_Create` | POST | `/category/create` | `{ strName }` | `{ id }` |
| `category_Update` | PUT | `/category/{categoryId}/update` | `{ strName }` | `204` |
| `category_Delete` | DELETE | `/category/{categoryId}` | — | `204` |
| `subcategory_Create` | POST | `/subcategory/create` | `{ categoryId, strName }` | `{ id }` |
| `subcategory_Update` | PUT | `/subcategory/{subcategoryId}/update` | `{ strName }` | `204` |
| `subcategory_Delete` | DELETE | `/subcategory/{subcategoryId}` | — | `204` |

### 8.5 Category Rules

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `categoryRule_GetAll` | GET | `/category-rule/list` | — | `CategoryRule[]` (ordered by intPriority) |
| `categoryRule_Create` | POST | `/category-rule/create` | `{ subcategoryId, strMatchString, strMatchType, intPriority }` | `{ id }` |
| `categoryRule_Update` | PUT | `/category-rule/{ruleId}/update` | `{ strMatchString?, strMatchType?, intPriority?, subcategoryId? }` | `204` |
| `categoryRule_Delete` | DELETE | `/category-rule/{ruleId}` | — | `204` |
| `categoryRule_ReorderBulk` | POST | `/category-rule/reorder` | `{ orderedIds: string[] }` | `204` |
| `categoryRule_Test` | POST | `/category-rule/test` | `{ strDescription: string }` | `{ matchedRuleId, suggestedSubcategoryId, subcategoryName, categoryName }` |

**`categoryRule_ReorderBulk` behavior:** accepts an ordered list of rule IDs and assigns `intPriority` values as `(index + 1) * 10` (e.g., first item = 10, second = 20) to leave room for future insertions.

### 8.6 Duplication Collections

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `duplicationCollection_GetAll` | GET | `/duplication-collection/list` | — | `DuplicationCollection[]` (with nested strings) |
| `duplicationCollection_Create` | POST | `/duplication-collection/create` | `{ strName }` | `{ id }` |
| `duplicationCollection_Update` | PUT | `/duplication-collection/{collectionId}/update` | `{ strName }` | `204` |
| `duplicationCollection_Delete` | DELETE | `/duplication-collection/{collectionId}` | — | `204` |
| `duplicationCollectionString_Add` | POST | `/duplication-collection/{collectionId}/string` | `{ strValue }` | `{ id }` |
| `duplicationCollectionString_Delete` | DELETE | `/duplication-collection-string/{stringId}` | — | `204` |

### 8.7 Conciliation

| Function Name | Method | Route | Request | Response |
|---|---|---|---|---|
| `conciliation_Preview` | POST | `/conciliation/preview` | `{ cardId, currentBalance, todayDate }` | `ConciliationPreview` |
| `conciliation_Close` | POST | `/conciliation/close` | `{ cardId, currentBalance, todayDate }` | `{ cycleCloseId }` |
| `conciliation_Snapshot` | POST | `/conciliation/snapshot` | `{ cardId, balanceAtSnapshot, snapshotDate }` | `{ snapshotId }` |
| `conciliation_GetHistory` | GET | `/conciliation/history` | Query: `cardId` | `CycleClose[]` |

**`ConciliationPreview` response shape:**
```json
{
  "cycleStart": "2026-04-11",
  "closingDate": "2026-05-10",
  "openingBalance": -450.00,
  "cycleMovementsSum": -900.00,
  "amountA": -1350.00,
  "postCloseMovementsSum": -85.00,
  "amountB": -1350.00,
  "interest": 0.00,
  "hasInterest": false
}
```

The frontend should call `conciliation_Preview` first, display the breakdown to the user, and only call `conciliation_Close` upon explicit confirmation.

### 8.8 Debit Accounts

| Method | Route | Request | Response |
|---|---|---|---|
| GET | `/api/debit-accounts` | — | `DebitAccount[]` |
| POST | `/api/debit-accounts` | `{ strName, decCurrentBalance }` | `{ id }` |
| PUT | `/api/debit-accounts/{id}` | `{ strName?, decCurrentBalance? }` | `204` |
| DELETE | `/api/debit-accounts/{id}` | — | `204` |

### 8.9 Recurrent Transactions

| Method | Route | Request | Response |
|---|---|---|---|
| GET | `/api/recurrent-transactions` | — | `RecurrentTransaction[]` |
| GET | `/api/recurrent-transactions/{id}` | — | `RecurrentTransaction` |
| POST | `/api/recurrent-transactions` | Full `RecurrentTransaction` body | `{ id }` |
| PUT | `/api/recurrent-transactions/{id}` | Partial or full `RecurrentTransaction` body | `204` |
| DELETE | `/api/recurrent-transactions/{id}` | — | `204` |
| GET | `/api/recurrent-transactions/dashboard?date=YYYY-MM-DD` | — | `RecurrentDashboardItem[]` (all recurrents with current iteration match status) |
| POST | `/api/recurrent-transactions/{id}/matches` | `{ iterationKey, transactionId?, boolDone, strMatchMode }` | `{ id }` |
| PUT | `/api/recurrent-transactions/matches/{matchId}` | `{ transactionId?, boolDone?, dateDone?, strMatchMode? }` | `204` |

---

## 9. Open Questions

The following design decisions require product confirmation before implementation. Default assumptions are noted where applicable.

---

**OQ-1 — Balance sign convention in the UI**

When the user enters "current balance" during import or conciliation, should the UI:
- **(Option A)** Accept a positive number ("I owe 1,350 soles") and internally negate it before storing/computing? This is more natural for users.
- **(Option B)** Require the user to enter the raw negative value (−1,350), consistent with the internal sign convention?

*Default assumption:* Option A. The UI displays a label like "Amount you owe (e.g. 1350)" and multiplies by −1 before sending to the API. The API always receives and stores the signed (negative) value. This must be documented clearly in the UI with a label or helper text.

---

**OQ-2 — First cycle opening balance**

For a brand-new card with no prior `M_CYCLE_CLOSE` records, what is the opening balance for the first cycle close?

*Default assumption:* Zero (no prior debt). The conciliation logic treats a missing prior `CycleClose` as `openingBalance = 0`. A manual override field should be provided in the conciliation UI for the first cycle only, so the user can set an initial balance if the card already had a balance when they started using the app.

---

**OQ-3 — Multi-currency conciliation**

The card can hold both PEN and USD transactions. Is the card's overall balance always expressed in PEN for conciliation purposes?

*Default assumption:* Yes. `decAmountPen` (which is set at import time using the exchange rate of that day) is always used for conciliation sums. USD transactions are never re-converted at reconciliation time. The exchange rate is fixed per import batch. Confirm this assumption, as it means the reconciliation balance may not precisely reflect the card's real balance if USD exchange rates have moved significantly since import.

---

**OQ-4 — Transaction ordering within the same day**

The import Excel file has no time component, only a date. Within the same day, the order of transactions is arbitrary (insertion order). Is this acceptable, or is there a secondary sort key the user expects (e.g., by description alphabetically, or by amount)?

*Default assumption:* Within the same day, sort by `dateCreation ASC` (the order they were inserted, which typically mirrors the order in the Excel file). No user-facing reorder within a day.

---

**OQ-5 — Category rule priority: tiebreaker**

When multiple category rules match the same description, the first match by `intPriority ASC` wins. If two rules have the same `intPriority` value, the tiebreaker is undefined.

*Default assumption:* Enforce a UNIQUE constraint on `intPriority` per the UI's reorder bulk-assign approach (priorities assigned as 10, 20, 30 ...). Alternatively, add a secondary sort by `dateCreation ASC` as a deterministic tiebreaker in `spCategoryRule_GetAllOrdered`. Confirm which approach is preferred.

---

*End of document.*
