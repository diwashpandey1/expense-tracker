# Expense Tracker 2.0 — Project Overview

## Product

A focused personal finance app for manual income/expense tracking, monthly budgets, categories, analytics, and savings goals. Prioritize quick entry, understandable numbers, privacy, and responsive usability.

## v1 requirements

- Firebase email/password registration, login, logout, persistence, and password reset.
- Google sign-in via Firebase Authentication.
- Public Home at `/`, About, Contact, reading list, and standalone calculators; authenticated users are redirected to `/app` from public/auth routes, and tracker pages are under `/app/*`.
- Protected React routes; Firebase Auth UID scopes each user's Firestore documents.
- Dashboard with monthly income, expenses, available balance, recent records, category spending, and budget progress.
- Income/expense records with category, calendar date, minor-unit amount, and optional note; edit/delete/search/filter/sort/date-range history.
- Custom income/expense categories. Used categories are archived rather than physically removed, preserving history.
- Monthly overall and category budgets.
- Expenses and savings contributions are limited by remaining income for their calendar month. An expense/contribution cannot exceed income left after expenses, contributions, and withdrawals.
- An overall monthly budget cannot exceed recorded income. Category budgets combined must fit within the overall budget, or income if there is no overall budget. Record income before setting a budget.
- Savings goals with linked contribution/withdrawal transaction kinds.
- Monthly comparisons and category/trend charts.
- Clear loading, empty, error, and success states.

## Financial definitions

Income increases tracked balance; expense decreases it. Savings contributions allocate available funds to a goal without counting as expenses; withdrawals return allocated funds. Available to spend = income − expenses − contributions + withdrawals. Savings allocated = contributions − withdrawals. Tracked balance = available to spend + savings allocated = income − expenses. All metrics derive from transaction records.

Amounts use integer minor units stored as decimal strings and aggregated with BigInt. A per-user ISO currency is selected at onboarding and may later be changed as a display preference; no conversion is applied to existing amounts. Transaction dates are calendar dates, not UTC timestamps.

## Non-goals

No profile/avatar images, file uploads, Firebase Storage, custom API server, PostgreSQL, bank import, recurring transactions, shared accounts, multi-currency transaction accounting, AI/chat, or push notifications. A standalone currency converter uses a public no-key rate API. No paid Firebase plan or Blaze-only service.

## Quality requirements

Firebase Security Rules enforce ownership and allowed fields. The UI's route guards are not the security boundary. Use emulator tests for rules and business logic. Avoid duplicate writes and show actionable failures. Spark limits and query costs are treated as product constraints.
