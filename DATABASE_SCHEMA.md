# AVORA Database Schema

The production data store is Cloud Firestore. All application documents belong to one Firebase Auth UID under `users/{uid}`. No PostgreSQL service, relational ORM, Express API, Firebase Storage, or user-image URL is part of this design.

| Document/collection | Purpose |
| --- | --- |
| `users/{uid}` | Minimal account identity, primary currency, personal profile fields, onboarding status, and the onboarding-selected primary account ID. |
| `users/{uid}/onboarding/state` | Resumable onboarding step and draft answers; removed after completion. |
| `users/{uid}/financialProfile/general` | Occupation, income profile, historical estimates, household details, selected objectives. Private; never used as a ledger. |
| `users/{uid}/accounts/{accountId}` | Account metadata, currency, opening balance, current balance cache, status. |
| `users/{uid}/ledgerEntries/{operationId}` | Account-backed financial event, signed postings, date, note, category snapshots, reversal/edit fields. |
| `users/{uid}/transactions/{operationId}` | Query/report mirror of account-backed non-opening events plus legacy accountless transactions. |
| `users/{uid}/financialOperations/{operationId}` | Immutable operation ID and deltas used for retries/rule validation. |
| `users/{uid}/financeState/summary` | Savings total and current goal-allocation total. |
| `users/{uid}/goalAllocations/{goalId}` | Portion of existing savings reserved for an actual goal. |
| `users/{uid}/categories/{categoryId}` | Category catalog and archive status. |
| `users/{uid}/budgets/{budgetId}` | Monthly/yearly planning limits. |
| `users/{uid}/goals/{goalId}` | Goal target and status. |
| `users/{uid}/settings/preferences` | Display and interaction preferences. |
| `users/{uid}/auditEvents/{auditId}` | Audit information for account and financial mutations. |

## Money representation

Money inputs are parsed at the currency's minor-unit precision. Ledger amounts and signed deltas are decimal integer strings. Account cache balances and operation maps are safe integer numbers, validated before write. Each account-backed event carries its currency. Currently, tracked account currencies must match the user's primary currency; raw mixed-currency totals are not supported.

Opening balances use `openingBalanceMinor` and one history event of kind `opening_balance`. It is informational because calculations start from the account's opening field; it is not copied into income/expense transaction queries. Income and expense reports count only their corresponding kinds. Internal/external transfers and corrections are excluded.

## Authorization and migration

See `firestore.rules` for owner checks and write validation. Missing onboarding status on existing root documents signals a legacy user; no forced re-onboarding or automatic opening-balance migration occurs. Account deletion explicitly clears each direct subcollection because Firestore has no cascading deletion. Full field-level documentation and query relationships are in `FIRESTORE_SCHEMA.md`.
