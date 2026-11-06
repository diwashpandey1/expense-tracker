# Pennywise financial system audit

Audit date: 2026-11-06. Scope: the current `expense-tracker-new` source, Firestore rules, indexes, and local documentation. No production Firestore data was read or changed.

## Existing model

- Firebase Authentication identifies a person; all Firestore records are scoped under `users/{uid}`.
- A profile stores display name and currency. Subcollections are `categories`, `transactions`, `budgets`, and `goals`.
- Transactions currently store `kind`, positive integer `amountMinor` as a string, date, category and optional goal snapshots, note, and timestamps. There is no account, transfer, recurring occurrence, adjustment, or audit record.
- Income and expenses are summed from transaction rows. Savings contributions and withdrawals are separate transaction kinds, and goals derive progress from those rows. This treats savings as a spending-flow adjustment rather than cash held in an account.
- Monthly expense and savings-contribution validation compares against income recorded in that same month. Income edits and deletions also check monthly outflows and budgets.
- Budgets are monthly documents, keyed by month and category (or overall). Service/UI validation currently caps them at recorded income and constrains category totals.
- Dashboard and analytics derive aggregates by reading transaction history. The current summary's `available`/`balance` figures are not account balances and cannot reconcile to real-world cash.
- Firestore Rules enforce user ownership and document shapes/references, but cannot aggregate the user's transaction history to enforce a nonnegative total. Service-side monthly checks are also race-prone because their reads are outside the write transaction.
- Categories preserve snapshots on transaction rows. Existing seeded categories include the original project's broader list; this audit does not remove or rewrite them.

## Findings and risks

1. There is no account ledger, so the app cannot tell whether an expense is funded by a wallet, bank account, or savings account.
2. The current monthly-income cap rejects legitimate spending funded by opening cash or savings carried forward from another month. It also prevents a budget above income even though a budget is only a planning limit.
3. Savings goals currently describe amounts contributed in the app, not allocations backed by actual savings-account balances. Goals can therefore be double-counted if later added to account totals without redesign.
4. Historical transactions have no account IDs. Neither their source account nor the historical account balances can be inferred safely.
5. Writes to transactions and aggregate validation are not atomic with an account ledger; concurrent changes can invalidate a check.
6. Edits and deletions directly change source rows, with no durable financial audit record.
7. Recurrence, due occurrences, pending income confirmation, and idempotent occurrence history do not exist.
8. Analytics show transaction totals, but do not support lifetime/monthly/yearly/custom opening and closing account balances.

## Retain

- Firebase Auth UID as the one user identity, Firestore owner-scoped paths, integer minor-unit money, calendar-date strings, server timestamps, category/name snapshots, and the current React/JavaScript-only Firebase architecture.
- Existing records and their IDs. No Storage, profile images, old project credentials, backend, or paid Firebase service is introduced.

## Redesign proposal

Introduce accounts with an explicit opening-balance journal, posted income/expense/transfer ledger entries, savings-account classifications, goal allocation records, recurring schedules and occurrence records, and append-only audit events. Treat budgets solely as expense thresholds. Use a single atomic Firestore transaction per financial operation to write the ledger events and update any materialized account balances, with idempotency keys and reconciliation checks. Historical edits/deletes should use reversal/adjustment events or write an audit snapshot before applying a corrected posting.

The existing client-only Firebase architecture creates an important security boundary: Rules can enforce ownership, allowed fields, and nonnegative account documents, but cannot safely sum an arbitrary history. The implementation must either validate each account delta against a paired immutable posting in Rules or disclose the exact boundary; UI-only aggregate checks are insufficient for hostile clients. No server-side or paid service is approved to solve this.

## Migration plan and integrity gate

Add new collections additively. Keep legacy transactions/goals/budgets readable and unchanged. Do not assign old transactions to accounts or invent opening balances. Start an account ledger only after the user supplies a real opening balance and a tracking start date for each account. Keep legacy reports identified as legacy activity; never combine them with post-cutover account closing balances unless a user-reviewed migration maps every historical record. A migration UI/confirmation and the exact historic account allocation are outstanding design/implementation work; no automatic migration has been run.

## Current completion state

This is the initial audit and implementation baseline, not a claim that the requested ledger redesign is complete. See `IMPLEMENTATION_REPORT.md` for the work delivered in this pass and remaining milestones.
