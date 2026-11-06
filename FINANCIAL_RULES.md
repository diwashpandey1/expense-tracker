# Pennywise financial rules

## Canonical measures

- Lifetime income is the sum of posted income events. Opening balances, transfers, savings allocations, and withdrawals are excluded.
- Lifetime expenses are the sum of posted expense events only. Savings movements, transfers, budgets, and goal allocations are excluded.
- For each account, closing balance is opening balance plus signed posted ledger movements and approved balance adjustments.
- Total current balance is the sum of non-archived and archived account balances. Available balance is the sum of spending-classified account balances. Savings balance is the sum of savings-classified account balances.
- Total current balance must equal available balance plus savings balance.
- A transfer posts equal and opposite movements to two accounts; it has zero effect on combined balance, income, and expenses.
- A savings goal allocation reserves part of existing savings. It does not create money or change an account balance. Sum of active allocations may not exceed eligible savings balances.
- Period opening balance is the balance immediately before the inclusive period start. Closing balance is opening balance plus in-period postings. A selected month never resets prior balances.
- Budget utilization is actual expense amount divided by its limit. 80% is a warning, 100% is an exceeded-limit warning, and overspending remains recordable when account funds are available.

## Posting constraints

- Store money as positive decimal integer minor units; represent direction in posting type/sign, not floating point.
- Every posted event has an account and stable operation ID. Repeated submission of the same ID must be idempotent.
- An expense may post only if its spending account can fund it, or after the user confirms an atomic transfer from a selected savings account for the shortfall. If the combined eligible balance is insufficient, reject it.
- Recurring expenses that cannot be funded stay pending and do not post. Recurring income remains pending until the user confirms receipt.
- Opening-balance changes are dated adjustment events with before/after values, reason, actor, and timestamp; never silently replace history.
- Historical correction/deletion must preserve an audit snapshot and apply the corresponding balance changes atomically. A transfer must be corrected as one linked operation.

## Implementation boundary

New account-backed events follow these rules through `ledgerEntries`, account balances, and per-user finance state. Legacy accountless transactions are preserved and included in income/expense flow summaries, but are not included in actual account balances until an owner-reviewed migration assigns accounts and reconciles opening amounts. Legacy entry validation remains for those old records; budgets are independent planning limits and no longer have an income cap.

Recurring schedules are processed by the signed-in client when the app opens. The deterministic occurrence and posting IDs prevent duplicate posts during retries, but there is no server scheduler while the project remains browser-only and Spark-only. A schedule is only checked when the user opens the app.
