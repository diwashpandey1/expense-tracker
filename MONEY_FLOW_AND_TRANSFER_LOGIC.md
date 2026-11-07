# AVORA Money Flow and Transfer Logic

## Financial event types

All new account-backed events are stored as a single `ledgerEntries/{operationId}` record mirrored to `transactions/{operationId}` for list/report queries. Each event carries one or more signed account postings. A `financialOperations/{operationId}` record contains the matching signed deltas. The event, mirror, account balance changes, savings summary, and any goal-allocation changes commit in one Firestore transaction.

| Kind | Account effect | Income/expense report |
| --- | --- | --- |
| `opening_balance` | Establishes starting account balance; informational ledger event | Neither |
| `income` | Increases selected active account | Income |
| `expense` | Decreases selected spending account; may atomically transfer an approved shortfall from savings | Expense |
| `transfer` | Debits one tracked account and credits another same-currency account | Neither |
| `external_transfer_in` | Credits one tracked account from an untracked source | Neither |
| `external_transfer_out` | Debits one tracked account to an untracked destination | Neither |
| `adjustment` | Applies an explicit signed balance correction | Neither |

## Worked examples

### Opening position

An owner starts with a Cash Wallet of NPR 15,000. AVORA stores the account opening and one `opening_balance` history event for NPR 15,000. Reported income remains NPR 0 and expense remains NPR 0. The opening event does not get added to `transactions`; this prevents it from entering income or expense totals.

### Internal withdrawal from bank to cash

Starting positions: Bank NPR 35,000; Cash NPR 15,000. A transfer of NPR 5,000 creates postings `bank: -5000`, `cash: +5000` in minor units. Result: Bank NPR 30,000; Cash NPR 20,000; combined position remains NPR 50,000. Income and expense totals do not change.

### External incoming money

An owner receives NPR 5,000 from an account they do not track. `external_transfer_in` credits the selected account; it is labelled external and is excluded from income/expense reports. If it is salary or another earned source, the user should record it as actual income instead.

### Actual income and expense

Salary received into a tracked bank account is `income` and requires an income category. Spending at a shop is `expense` and requires an expense category. Each operation changes the selected account and the matching income/expense report. Expenses cannot make account balances negative. If a spending account is short, the existing confirmation flow can cover the shortfall from an active savings account in the same atomic operation.

## Confirmation, idempotency, edits, and reversals

Transfer events always show a confirmation before posting. The confirmation names the source and destination accounts and explains the accounting effect. Stable operation IDs are attached to a form attempt; retries after a network interruption reuse the same ID and do not apply the same event twice. CSV rows use deterministic IDs.

An internal transfer is represented by one linked event with two postings, not two independently editable rows. Editing updates both account sides in one transaction. Voiding the event reverses both sides atomically and restores related savings allocations when applicable. External transfers have one account posting and can be edited or voided by reversing that one posting. Entries with allocation history must be voided and replaced to avoid corrupting goal history.

## Currency handling and reporting

The current account-backed ledger requires all tracked accounts to use the user's primary currency. Internal transfers between different currencies are rejected; no implicit 1:1 conversion is performed. Display-currency conversion changes presentation only and does not rewrite ledger amounts. If account-level multi-currency is introduced, it must store an explicit rate, original and destination amounts, precision/rounding details, and both currencies.

Dashboard and analytics include only `income` and `expense` as those report categories. Internal transfers, external transfers, openings, and adjustments are omitted from both totals. Account balances are read from account caches maintained with the underlying transaction; these totals are not summed across currencies because currencies are currently uniform.
