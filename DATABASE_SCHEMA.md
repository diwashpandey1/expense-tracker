# Expense Tracker 2.0 — Firestore Data Schema

## Conventions

- Firestore is the sole application database.
- All records are under users/{uid}/{collection}/{documentId}; UID is the Firebase Auth UID and is enforced by rules.
- Money uses positive integer minor units encoded as decimal strings, such as "12345". Arithmetic uses BigInt.
- A user selects one ISO 4217 currency during profile creation and may change the display currency later. Existing amount values are never converted when that preference changes.
- occurredOn and month are YYYY-MM-DD calendar-date strings. createdAt/updatedAt use Firestore server timestamps.
- No document stores an avatar URL, image path, or uploaded file metadata.

## users/{uid}

Fields: uid, email, displayName, currencyCode, createdAt, updatedAt. Authentication credentials/providers are managed by Firebase Authentication and are not copied into Firestore. Either email/password or Google sign-in creates/resolves a Firebase Auth UID, which scopes all user paths. Provider linking is not implemented; when the same email already belongs to another provider, the user must use that existing sign-in method. Security rules require uid to match the path and auth claim; updates may change displayName, currencyCode, and updatedAt only. A currency change affects formatting, not stored minor-unit amounts.

## users/{uid}/settings/preferences

One document (`preferences`) stores normalized user options, with `updatedAt` set by a Firestore server timestamp. Top-level maps are `appearance`, `dashboard`, `transactions`, `budget`, `notifications`, and `privacy`. Defaults: system theme, lime accent, comfortable density, normal font size, expanded sidebar, animations enabled; all dashboard widgets visible, monthly default dashboard period, pie analytics chart, five recent transactions, amounts visible; expense transaction type, no fixed account/category, ISO dates, Monday week start, comfortable list, newest sort, no save confirmation; 80% budget warning threshold, monthly budget period, bar progress; in-app alert types enabled except monthly summary; balance hiding off. Dashboard periods also support weekly/yearly/lifetime. Account/category defaults are IDs, checked against the owner's active account/non-archived category records, and fall back when unusable.

Preferences are loaded and saved by `PreferencesProvider` through a Firestore transaction. Section patches merge with existing values; old or invalid values normalize to defaults. Firestore Rules scope read/write/delete to `request.auth.uid` and validate supported fields/enums and references. Preferences affect display, reminders, or new-entry defaults only; they never alter historical transaction dates, amounts, categories, budgets, or balances. Budgets support monthly and yearly periods; changing the default affects the selected period for new budget work but does not convert existing limits. Reset removes this document and resets the active app session to defaults; account deletion removes it with the rest of the user's records.

## users/{uid}/categories/{categoryId}

Fields: kind (income|expense|saving), name (1–60 chars), normalizedName, isArchived, isDefault, createdAt, updatedAt. The original project's 18 expense, 8 income, and 9 saving defaults are seeded for each user. Existing accounts receive missing defaults when categories are first read; existing category IDs are kept. Used categories are archived to preserve transaction history. Rules require valid fields and owner path.

## users/{uid}/transactions/{transactionId}

Legacy records retain their original shape: kind (income|expense|savings_contribution|savings_withdrawal), amountMinor, occurredOn, category/goal snapshots, note, timestamps. New account-backed records are mirrored here for the transaction UI and also stored in `ledgerEntries`; they add accountId, destinationAccountId, savingsAccountId, signed postings, operationKind, allocationAdjustments, lastOperationId, and optional void metadata. A void is retained and hidden from normal transaction views; the ledger entry is reversed atomically.

## users/{uid}/budgets/{budgetId}

Monthly fields: month (YYYY-MM), categoryId (null for overall budget), amountMinor (positive decimal string), createdAt, updatedAt. Existing monthly documents without a period field remain supported. Yearly fields: period=`yearly`, year (YYYY), categoryId, amountMinor, createdAt, updatedAt. Deterministic IDs include the period key and category/overall marker. Monthly and yearly limits are independent planning limits; utilization reads expenses inside that calendar period. No weekly or lifetime budgets are supported.

## users/{uid}/goals/{goalId}

Fields: name, targetMinor (positive decimal string), targetDate (optional YYYY-MM-DD), status (active|completed|archived), createdAt, updatedAt. New goal progress comes from `goalAllocations`, which reserve existing savings and never change account balances. Legacy contributions/withdrawals remain readable as legacy transaction records.

## Account-backed financial collections

- `accounts/{accountId}`: name, accountType, classification (`spending|savings`), currencyCode, openingBalanceMinor (decimal string), balanceMinor (safe integer minor units), status, timestamps, and lastOperationId. Current balance is materialized and changed atomically with each posting.
- `financeState/summary`: serialized savingsBalanceMinor and goalAllocatedMinor totals, updated in the same transactions as account postings and goal allocations. The UI uses this small summary in allocation and withdrawal transactions to avoid unsupported collection queries inside Firestore transactions.
- `ledgerEntries/{operationId}`: immutable posting history with kind, operationKind, amount, date, account postings, allocation adjustments, and reversal/edit metadata. Corrections are represented through linked writes and audit events.
- `financialOperations/{operationId}`: idempotency and signed per-account deltas used by Firestore Rules to pair balance changes with an operation.
- `goalAllocations/{goalId}`: goalId/name, amountMinor, timestamps. The value is reserved savings, not a separate balance.
- `auditEvents/{auditId}`: account creation/adjustment, transaction edit, and transaction void snapshots.
- `recurringSchedules/{scheduleId}` and `recurringOccurrences/{scheduleId_dueDate}`: client-processed schedule definitions and deterministic occurrence records. Expected income stays pending until confirmed; unfunded expenses stay pending for review.

## Indexes and query rules

Composite indexes support transaction period/type/category sort and monthly budgets. Query by occurredOn and limit/paginate transaction history. Default dashboard reads the selected month plus a bounded recent list. Avoid unbounded listeners. Index definitions live in firestore.indexes.json.

## Derived values and legacy boundary

New account-backed events use actual account balances and do not use the legacy monthly-income cap. Legacy entries remain preserved and continue to contribute to income/expense flow reports, but cannot be assigned to account balances without an owner-selected opening balance and reconciliation. Budget utilization counts actual expense events only; 80% and 100% warn, while posting is limited by available account money and explicit savings funding.

## Migration boundary

No old-project data is queried or modified. Existing transaction, budget, category, and goal records in this Firebase project are retained. There is no automatic backfill from legacy transactions into accounts because historical account assignment and opening balances are ambiguous. `DATA_MIGRATION_REPORT.md` documents the remaining owner-reviewed reconciliation step; until then, legacy cash-flow totals and account-backed balances are shown as separate measures.

## Reset and account deletion

No old Firebase project is queried or imported, and no destructive migration is run. Reset deletes transactions, budgets, and goals in sequential batches of up to 400 documents; categories and profile are retained. Account deletion reauthenticates the current user, removes transactions, budgets, goals, categories, then the profile, and finally removes the Firebase Auth identity. If Firestore cleanup fails, Auth deletion is not attempted so the user can retry. This is client-driven and can be interrupted; it does not provide a server-side deletion job or atomically roll back earlier batches.
