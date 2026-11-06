# Expense Tracker 2.0 — Feature Roadmap

## Milestone 0 — Setup and safety

- Use only the newly initialized Firebase project and its fresh local config.
- Confirm Spark plan and email/password Auth.
- Keep Storage and old project references out of code.
- Add Firestore rules/indexes and emulator config.

## Milestone 1 — App foundation

- Convert the Vite starter to a clean JavaScript/JSX feature structure.
- Configure Tailwind, shared tokens, routes, and responsive shell.
- Add Firebase Auth and Firestore initialization from environment variables.
- Add local emulator scripts and safe environment handling.

## Milestone 2 — Authentication and profile

- Registration, login, logout, password reset, persistence.
- Protected routes and profile bootstrap keyed by Firebase UID.
- Initials/generic avatar only.

## Milestone 3 — Transactions and categories

- User-scoped transaction CRUD, exact minor-unit amounts, date validation.
- Default/custom categories, edit, archive.
- Search, filters, date range, stable sort, paging.
- Firestore security rules and cross-user tests.

## Milestone 4 — Dashboard, budgets, and savings

- Monthly dashboard summaries and recent activity.
- Overall/category budgets and progress.
- Goals with linked contributions and withdrawals.
- Recompute all values from source records and test create/edit/delete effects.

## Milestone 5 — Analytics and polish

- Monthly comparisons, category breakdown, spending trend.
- Loading/error/empty states, accessibility, mobile layout, useful feedback.
- Emulator rules suite and workflow tests.

## Milestone 6 — Hosting and release

- Build and deploy static SPA to the initialized Firebase Hosting site.
- Verify fresh project binding and Spark plan; do not upgrade to Blaze.
- Recheck quotas and release settings.
- Document setup, rules, indexes, deployment, and known quota/large-account limits.

No custom backend, SQL database, Cloud Functions, Firebase Storage, FCM, or paid service is part of this roadmap.
