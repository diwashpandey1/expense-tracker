# AVORA Financial Onboarding Implementation Report

## Delivered

- New-user onboarding with seven responsive steps: profile, occupation/income, historical habits, optional household details, financial objectives, account setup, and review.
- Firestore draft persistence and resume behavior; explicit completion confirmation.
- New users are routed into onboarding before `/app`; legacy profiles with no onboarding status continue normally.
- One-to-ten accounts with provider, subtype, purpose, description, tracking date, and a zero or positive opening balance in the chosen primary currency.
- Atomic account/opening-event setup, with opening events kept out of income/expense transaction reporting.
- Account metadata edit, zero-balance archive, reactivation, account history, and explicit audited balance correction.
- External incoming/outgoing transfers, confirmation prompts for all transfers, atomic balances, sufficient-balance checks, and exclusion from income/expense summaries.
- Owner-scoped rules for onboarding and private financial profile documents; cleanup of added user subcollections in account deletion.
- Companion architecture, schema, onboarding, account, money-flow, integrity, and implementation documentation.

## Schema and compatibility changes

Added root profile onboarding/personal fields, `users/{uid}/onboarding/state`, and `users/{uid}/financialProfile/general`. Account docs may now include provider, description, purpose, subtype, and opening date. `ledgerEntries` supports `opening_balance`, `external_transfer_in`, and `external_transfer_out`. Financial-operation and posting patterns remain under the user's existing Firestore tree.

No existing user's transactions, balances, budgets, goals, or categories are rewritten. Missing onboarding status is treated as legacy-complete. No production migration, database reset, Firebase project change, Firebase Hosting change, or deployment was performed.

## Verification

The implementation was checked with:

- `npm run lint` — passed.
- `npm run build` — passed; Vite reported the large JavaScript bundle warning.
- `npm test` — passed (31 tests across 10 files).
- `npm run test:ledger` — passed (2 tests), including atomic onboarding/opening balance and external transfer scenarios.
- `npm run test:rules` — passed (9 tests), including private onboarding/financial-profile ownership.
- Browser walkthrough with a real Firebase project — not performed.

The emulator tests use demo projects and do not read or modify production data. `git diff --check` was also run; only platform line-ending notices were reported.

## Known limitations and next work

- Accounts in the current UI must share the user's primary currency. Mixed-currency account balances/transfers need an explicit FX transaction model and are intentionally rejected.
- The wizard does not infer bank ownership, account balances, or transaction history. Users must create the account(s) they want to track and confirm the starting amounts.
- Historical habit figures are stored as optional user-entered profile estimates; they do not power ledger reporting or recommendations yet.
- Household information and income estimates are private profile fields but do not yet have dedicated Settings edit controls.
- Firebase SDK and direct client writes cannot provide server-enforced tamper-proof bookkeeping against the authenticated owner. Firestore Rules enforce identity scope and important structural/invariant checks.
- No production Firebase Rules deployment or Cloudflare/Firebase site deployment was performed.
