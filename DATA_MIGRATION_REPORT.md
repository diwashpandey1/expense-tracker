# Data migration report

Date: 2026-11-06

## Safety decision

No live Firebase data was queried, migrated, reset, or deleted. The project configuration and user-owned Firebase files were left untouched. The old sibling project was not accessed for writes.

## Known legacy shape

The inspected client and rules use `users/{uid}` with `categories`, `transactions`, `budgets`, and `goals` subcollections. Transactions have no account ID. Savings goals derive progress from contribution/withdrawal transaction rows. No opening balance, account currency, ledger posting, or transfer linkage is stored.

## Safe migration boundary

There is no safe automatic mapping from old transactions to real accounts. Assigning a historical expense to a wallet/bank account or calculating an opening balance would require facts not present in the records. Therefore:

- retain all existing records in place with original IDs and values;
- introduce any new collections additively;
- do not backfill accounts or mutate transactions automatically;
- treat legacy transaction reports separately from account-ledger balances until the user maps history or chooses an explicit cutover date and opening balances;
- preserve current category, goal, and budget records; do not bulk replace default categories.

## Required migration before production cutover

Provide a preview that shows unmapped records, proposed account assignments, resulting per-account opening balances, and reconciliation totals. Require the owner to review/confirm before writing. Write migration metadata and audit events, use deterministic idempotency keys, and retain a rollback/export path. The preview/confirmation flow has not been implemented, so this report does not authorize live migration.
