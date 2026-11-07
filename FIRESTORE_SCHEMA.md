# AVORA Firestore Schema

All documents are below an Auth UID. The client uses the Firebase JavaScript SDK and owner-scoped Security Rules; there is no Express API or Firebase Admin backend.

## Collections and core fields

| Path | Core fields / role |
| --- | --- |
| `users/{uid}` | `uid`, `email`, `displayName`, `fullName?`, `currencyCode`, optional `countryCode`, `timeZone`, `dateOfBirth`, `gender`, `onboardingStatus?`, `onboardingCompletedAt?`, `primaryAccountId?`, timestamps. Missing onboarding status means legacy-complete. |
| `users/{uid}/onboarding/state` | `currentStep`, draft `answers` map, `updatedAt`; deleted after successful completion. |
| `users/{uid}/financialProfile/general` | Occupation, optional occupation label, income sources/frequency/estimate/channels, historical financial habits/estimates, household information, selected financial objectives, timestamps. Not a ledger. |
| `users/{uid}/accounts/{accountId}` | Name, `accountType`, `classification`, source currency, `openingBalanceMinor`, cached integer `balanceMinor`, `openingBalanceDate?`, provider/subtype/purpose/description, active/archived status, timestamps, last operation ID after activity. |
| `users/{uid}/ledgerEntries/{operationId}` | Financial kind, amount minor string, date, account IDs, optional category snapshots, signed `postings`, note, operation ID, timestamps, void/edit metadata. Includes opening balance events. |
| `users/{uid}/transactions/{operationId}` | Mirror of account-backed income/expense/transfers/external transfers for list and report queries, plus preserved legacy accountless transaction records. Opening balances are excluded. |
| `users/{uid}/financialOperations/{operationId}` | Immutable `{uid, kind, deltas, createdAt}` record used for idempotency and rule validation. |
| `users/{uid}/financeState/summary` | Cached `savingsBalanceMinor`, `goalAllocatedMinor`, `updatedAt`. |
| `users/{uid}/settings/preferences` | Display currency, privacy, dashboard, appearance, transaction defaults, reminders. |
| `users/{uid}/categories/{categoryId}` | Income, expense, or saving category, name snapshot target, archive/default flags, timestamps. |
| `users/{uid}/goalAllocations/{goalId}` | Amount reserved from real savings and linked goal. This is not another account balance. |
| `users/{uid}/auditEvents/{auditId}` | Account or transaction audit metadata and correction history. |
| `users/{uid}/budgets/{budgetId}` | Monthly/yearly limit and optional category snapshot. |
| `users/{uid}/goals/{goalId}` | Goal name, target, optional date, status. |
| `users/{uid}/recurringSchedules/{scheduleId}` | Recurring definition. |
| `users/{uid}/recurringOccurrences/{id}` | Deterministic pending/processed schedule occurrence. |
| `users/{uid}/currencyRates/{baseCurrency}` | Legacy read/delete-only cache. The active shared rate cache is outside Firestore in Worker KV. |

## Relationships and write paths

- Firebase Auth `uid` is the owner key; frontend-supplied paths are not trusted by Firestore Rules.
- Account-backed transaction `accountId` and optional `destinationAccountId` reference accounts below the same UID. Category snapshots must match an active category for income/expense events.
- Internal transfer uses one event ID and two signed postings. External transfers use one posting. Opening balances are represented in the account's opening field and one non-income ledger event; the ledger calculation skips that informational entry to avoid double counting.
- Financial account operations use `runTransaction` so related account, ledger/mirror, idempotency, finance-state, goal-allocation, and audit writes commit or fail together.
- `financialProfile/general` and onboarding answers are private profile data and are only readable by the same Auth UID.

## Rules, queries, and indexes

`firestore.rules` denies unauthenticated and cross-owner access. It validates onboarding/profile shape, account type/currency/status, nonnegative balances, category ownership, event amounts/dates, and account posting deltas linked to a `financialOperations` document. The app does not treat React route guards as authorization. Rules cannot recompute every account total or stop an authenticated owner from editing their own records through another client; see `FINANCIAL_DATA_INTEGRITY.md`.

Transaction/ledger history orders by `occurredOn` and batches up to 400 docs. Existing composite index definitions are in `firestore.indexes.json`; run emulator tests when changing a compound query or rule. Firestore queries are scoped to one user's subcollection; the app does not query other users' profile data.

## Migration and deletion

No migration reassigns historical accountless transactions or makes up opening balances. Existing profiles without onboarding status are treated as legacy complete. Account deletion explicitly removes direct user subcollections (including `onboarding` and `financialProfile`) in bounded batches before removing the Auth identity. Firestore does not cascade delete subcollections automatically.
