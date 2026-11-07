# AVORA Financial Account System

## Account types and identity

An account describes where tracked money is held. It is separate from a savings goal, income source, or budget. The current storage types are `cash`, `bank`, `ewallet`, and `other`; `classification` is `spending` or `savings`. A savings account is represented by a bank-type account with savings classification. Multiple accounts of the same type are supported.

Every account is stored below its owner at `users/{uid}/accounts/{accountId}` and has a source `currencyCode`. The current application requires every account to use the user's primary/source currency. This avoids summing incompatible raw currency balances. Different-currency accounts and FX transfers are intentionally not implemented; a future implementation needs explicit source amount, exchange-rate snapshot, destination amount, rounding policy, and reports by currency.

## Creation and opening balances

Account setup fields are name, type, classification, currency, and opening balance. Provider, subtype, purpose, and description are optional. AVORA does not connect to banks and never asks for account numbers, cards, PINs, or passwords. A zero-balance account is valid.

The starting balance is existing money on a tracking-start date, not new income. The account stores `openingBalanceMinor` and its cached `balanceMinor`; the ledger stores one `opening_balance` history event and a `financialOperations` idempotency/delta record, including for zero. Opening events are not written into the income/expense transaction mirror. Ledger calculations start from the account's opening balance and skip the informational opening event so it is counted once.

Onboarding creates all selected accounts and their opening records in one Firestore transaction. Later account creation follows the same account + finance-state + opening-event transaction. Opening funds in savings-classified accounts are included once in `financeState/summary.savingsBalanceMinor`.

## Balances and lifecycle

Balances are cached integer minor units on account documents for efficient UI reads. The app's ledger operations apply signed postings atomically to the accounts and `financeState/summary`. Conceptually, a balance is:

```text
opening balance
+ posted income
+ incoming internal/external transfers
- posted expenses
- outgoing internal/external transfers
+ explicit balance adjustments
```

Account details can be edited without changing a balance. Balance corrections must use the explicit adjustment action, which records a reason, before/after values, a ledger entry, an operation, and an audit event. Accounts with nonzero balance cannot be archived. Archiving preserves the document and history, prevents new postings, and hides the account from active selectors; a zero-balance archived account can be reactivated. Accounts are not physically deleted through normal account management.

Each account has an account-history view that shows opening balance, financial activity, and adjustments with the signed account delta. The account list shows current balance, opening amount, start date, and optional descriptive metadata.

## Ownership and access

The account path and Firebase UID must match the authenticated identity. Rules validate account type, classification, currency, nonnegative balance, allowed fields, and linked operation deltas on balance changes. The React UI does not grant authorization. Financial operations require an active account and the matching source currency. Users should reconcile legacy accountless records themselves; the app does not attach historical entries or infer a starting amount automatically.
