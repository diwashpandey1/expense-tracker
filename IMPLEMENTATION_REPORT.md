# Financial system implementation report

Date: 2026-11-06

## Implemented

- Multiple spending and savings accounts, opening balances, edits, archive rules, auditable balance adjustments, and per-account history.
- Atomic account-backed income, expense, and internal transfer posting with idempotency keys, nonnegative balances, matching currency validation, and Firestore Rules checks.
- Expense shortfall workflow that requires a selected savings account and confirmation; the transfer and expense post atomically.
- Savings goal allocations as reservations of existing savings. Allocation is limited to available savings; withdrawals release allocations as needed and voiding restores them.
- Transaction editing and voiding with atomic balance recalculation and audit snapshots. Legacy accountless transactions remain editable/deletable through the existing path.
- Budget amounts independent of income, with 80% warning and 100% exceeded status; overspending can be recorded when funds are available.
- Recurring daily, weekly, monthly, yearly, and custom-interval schedules. Expected income requires confirmation; expenses post if funded or remain pending for review. Deterministic occurrence IDs prevent repeat postings.
- Dashboard account totals, period cash flow, budget and goal context; analytics support monthly, yearly, lifetime, and custom ranges with carried-forward opening/closing balances and savings transfer movements.
- Firestore Rules and indexes for account ledger, finance state, operation deltas, audit records, goal allocations, and recurring workflows.
- Finance reset/account deletion now includes all newly introduced collections, including the finance summary document.

## Main files added or changed

- Added `src/domain/financialLedger.js`, `src/domain/budgetRules.js`, `src/services/ledgerService.js`, `src/services/goalAllocationService.js`, and `src/services/recurringService.js`.
- Added `src/pages/AccountsPage.jsx` and `src/pages/RecurringPage.jsx`; wired routes and recurring processing into `src/App.jsx` and `src/components/AppLayout.jsx`.
- Updated `src/pages/TransactionsPage.jsx`, `GoalsPage.jsx`, `BudgetsPage.jsx`, `DashboardPage.jsx`, `AnalyticsPage.jsx` and related services for account-backed financial behavior.
- Updated `firestore.rules`, `firestore.indexes.json`, data lifecycle, package scripts, and `vite.config.js` test exclusions.
- Updated `DATABASE_SCHEMA.md`, `SYSTEM_ARCHITECTURE.md`, `FINANCIAL_RULES.md`, and `DATA_MIGRATION_REPORT.md`.

## Firestore changes and migration result

New user-scoped collections/documents: `accounts`, `financeState/summary`, `ledgerEntries`, `financialOperations`, `goalAllocations`, `auditEvents`, `recurringSchedules`, and `recurringOccurrences`. Account-backed transactions are also mirrored in `transactions` for existing UI/reporting paths. See `DATABASE_SCHEMA.md` for fields and relationships.

No production data migration was run. Existing records were not rewritten, deleted, or reset. Automatic account assignment is unsafe because old transactions do not identify their source accounts or opening balances. Legacy cash-flow totals therefore remain separate from tracked account balances until an owner-reviewed reconciliation is performed. No old sibling project or Firebase configuration was accessed or changed.

## Verification

- `npm run lint` — passed.
- `npm test` — passed, 9 files and 26 tests.
- `npm run test:rules` — passed, 6 Firestore Emulator Rules tests.
- `npm run test:ledger` — passed, including idempotent income, savings-funded expense, allocation release/restore, historical edit/void, and transfer balance preservation.
- `npm run build` — passed. Vite still reports a large main JavaScript chunk (about 865 kB before gzip).
- No live Firebase workflow, browser walkthrough, deployment, or production migration was performed.

## Known limitations / remaining work

- Recurring processing runs in the browser when a signed-in user opens the app; there is no server scheduler, so due items are noticed on the next visit. This avoids paid compute and Cloud Functions.
- Legacy accountless transactions are preserved but not included in account balances. A preview/confirmation/reconciliation flow is still needed before historical account assignment.
- Firestore Rules validate account delta pairing and nonnegative account balances, but Firestore Rules cannot independently recompute user-wide aggregate totals. `financeState/summary` is app-maintained transactional state, not tamper-proof against direct owner writes.
- Full visual QA against a live user account and production Rules/index deployment remain unverified. The owner’s Firebase project credentials/configuration remain untouched.
- Main bundle size should be reduced with additional code splitting in a separate performance pass.

## Platform constraints

The implementation remains React, Vite, JavaScript/JSX, Firebase Authentication, Cloud Firestore, Tailwind CSS, Lucide React, and Framer Motion. No TypeScript, Express/API server, PostgreSQL, Firebase Storage, profile image upload, Cloud Functions, or deployment was added.
