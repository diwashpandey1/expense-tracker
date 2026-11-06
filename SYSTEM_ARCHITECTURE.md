# Expense Tracker 2.0 — System Architecture

## Overview

React/JavaScript/Vite browser app → Firebase Authentication for identity → Cloud Firestore for per-user data. Firebase Hosting serves the static SPA. There is no Express API server, PostgreSQL, or other backend service; Node is used only by Vite and Firebase tooling.

## Frontend layers

- Public pages: Home, About, Contact, external financial reading list, and financial tools. Signed-in users are redirected from every public/auth route to `/app`.
- Finance pages under `/app/*`: dashboard, transactions, accounts, recurring schedules, categories, budgets, analytics, settings, savings goals.
- Components/layouts: shared navigation, forms, cards, tables, dialogs, chart wrappers, loading/empty/error views.
- Hooks/providers: AuthProvider and data hooks.
- Firebase client: initialize only Auth and Firestore from fresh Vite environment config.
- Service modules: auth, user profile, transactions, categories, budgets, goals, analytics, and user-data lifecycle.
- Utilities: exact money, calendar dates, query filters, validation, constants.

Components call service functions rather than embedding Firestore paths and mutation logic.

## Authentication and ownership flow

1. Firebase Auth SDK registers with email/password, signs in with email/password, or opens Google OAuth via Firebase's `GoogleAuthProvider` popup. Google social sign-in is a no-cost Spark Authentication method. Enable the provider in Firebase Console and authorize local/Hosting domains.
2. The authenticated Firebase UID identifies the owner of documents under users/{uid}.
3. Client calls Firestore using the signed-in Firebase SDK instance.
4. Firestore Security Rules validate request.auth.uid == path UID and validate allowed fields/relationships for every read/write.
5. React route guards improve UX only. Firestore Rules are the actual authorization boundary.
6. For first-time Google sign-in, the app bootstraps the user's Firestore profile and default categories using the authenticated client. Existing accounts are seeded with any missing defaults when categories are first read, preserving stable IDs and already-created records. If older Firestore rules reject the new savings category kind, expense/income defaults still load and the UI explains that the latest rules need deploying. Either enabled provider produces a Firebase Auth identity; provider linking is not implemented, so an existing same-email/different-provider account must use its original provider. On logout, Auth state clears and user-scoped state is reset.

No second credential store or backend identity is added. No Google access token is persisted or used for Google APIs. Firebase Auth's current-user state is the source of identity; Firestore SDK requests carry Firebase credentials and Firestore Rules enforce ownership. No tokens are sent to a custom API because no API exists. If an email already belongs to another provider, Firebase may report `account-exists-with-different-credential`; the user must first sign in with that existing method (account linking is not implemented).

## Firestore data flow and financial calculations

All records live in a user subcollection. Account-backed financial writes run in Firestore transactions: the operation ID is the ledger/transaction document ID, account balances and per-user finance state are updated with the postings, and a financial operation records signed account deltas for Rules validation. Repeated submissions with the same ID are idempotent. Transaction edits and voids apply account deltas atomically and append audit snapshots. Minor-unit calculations use BigInt; ledger amounts are decimal strings, while materialized account balances use safe integer minor units for Rules comparisons. Each new ledger event records its original account currency; changing display currency never rewrites the stored amount, account balance, or limits.

The account-backed transaction form records income, expenses, and internal transfers. Expenses that exceed the selected spending account require explicit savings funding; balances cannot go negative. Budgets are planning limits, independent of income, and can exceed income. The UI warns at 80% and 100% utilization; budgets never affect account balances. Legacy transaction forms retain their historical monthly-income validation to avoid changing the behavior of old accountless records.

Firestore Rules pair account balance changes with financial operation deltas and enforce owner paths, amount formats, event relationships, and nonnegative balances. Finance state is a client-maintained aggregate updated atomically with account/allocation operations; Rules validate its shape and owner but cannot recompute collection totals. The application treats it as derived state and updates it only through transactions. This app-only design does not claim tamper-proof accounting against a user who directly edits their own Firestore documents.

Legacy and new ledger records are both read for cash-flow reporting. Account balances and period opening/closing values derive from opening balances and ledger postings. Historical legacy transactions are not mapped into new accounts automatically because account ownership cannot be inferred safely.

Firestore has no server-side aggregation in this design. Transaction history is read in pages of 400 documents; the UI filters and paginates those loaded results, with optional date-range narrowing. Dashboard and analytics summaries derive from transaction documents, so large histories consume proportionally more reads. This is appropriate for a personal tracker within Spark quotas; high-volume accounts may need a different, separately approved plan.

## Account data lifecycle

- Reset clears transactions, ledger entries, accounts, recurring data, finance state, budgets, and goals in sequential 400-document batches while preserving the profile and categories.
- Account deletion reauthenticates with the existing password or Google popup, deletes all known user subcollections in batches, deletes the profile document, and then deletes the Firebase Auth identity. Auth deletion does not proceed if Firestore cleanup fails.
- This browser-only Spark design cannot run a server-side durable deletion job. If the browser or network fails mid-cleanup, the account remains active and the user can retry; some records may already have been removed. No legacy project or old schema is touched.
- `currencyRates/{baseCurrency}` caches one rate table per source currency. The browser calls CurrencyAPI with the existing Vite key and requests only the app's supported currency codes. Rates, provider date, and server sync timestamp are saved per user; client logic and Firestore Rules prevent refreshing the same base currency more than once in seven days. A switch among target currencies reuses that base table. New-user defaults use their selected account currency as the display currency. For returning users whose active accounts all share one currency that differs from the old profile setting, the app restores that account currency as the ledger source and keeps the former profile currency as the display default; it does not rewrite monetary records. When API refresh fails, saved rates are used with a stale-rate status; with no cached rates, amounts remain in source currency. CurrencyAPI is a third-party dependency; no transaction records or identity are sent. The public calculator continues to use Frankfurter without an API key.

## User preferences and notifications

- `PreferencesProvider` loads a single `users/{uid}/settings/preferences` document after Firebase Auth resolves. Existing users receive normalized defaults; missing documents are initialized with defaults. Section updates merge with the stored map in a Firestore transaction, and invalid values fall back to supported defaults. The `currency.displayCurrency` setting controls the display formatter; the profile currency and account currency remain the original ledger denomination.
- Firestore Rules allow only the signed-in owner to read, create, update, or delete this document. Rules validate supported options and require selected account/category references to belong to that same user and remain usable. The client also rechecks references when saving and falls back to the first valid choice in the transaction form.
- Settings apply presentation defaults at the app root and through shared formatters. Theme, accent, density, font size, and animation preferences affect the shared app shell; privacy masking is applied by the money formatter, including chart labels/tooltips. These preferences only change display and entry defaults; they do not rewrite financial records or calculations.
- Notifications are in-app summaries evaluated when the user opens the relevant page. Budget alerts use the configured threshold and 100% exceeded state; recurring reminders summarize pending occurrences; savings reminders are evaluated in Goals; monthly summaries appear on the dashboard. No FCM, scheduled backend, Cloud Functions, or paid notification service is used. This means alerts are not delivered while the app is closed. If background delivery becomes necessary, first evaluate a separately approved backend and current Firebase plan eligibility; the free client-only alternative remains in-app reminders.
- Budgets support monthly documents (`month: YYYY-MM`) and yearly documents (`period: yearly`, `year: YYYY`). Older monthly documents remain readable without a `period` field. Weekly and lifetime budgets are not part of the budget schema. Dashboard periods separately support weekly, monthly, yearly, and lifetime views.
- Reset clears preferences with financial records, and the active browser session returns to defaults immediately. Account deletion also removes the settings subcollection as part of user data cleanup.

## Security

- No permissive rules. No owner ID is trusted from document payload; UID comes from authenticated request context.
- Limit document fields/types/lengths and allowed transaction kinds.
- Referenced categories/goals must belong to the same user and be active where needed.
- Profile currency is the source denomination for ledger writes. The separately saved display currency applies cached conversion at render time and does not rewrite stored amounts.
- The UI archives used categories and keeps default categories in normal management flows. Owner deletion is also allowed by Firestore Rules to support complete account cleanup.
- Storage rules are not configured because Storage is excluded.
- Emulator tests cover own-user access, cross-user denial, invalid writes, and immutable fields.
- Never log credentials, tokens, or financial notes.

## Hosting

Firebase Hosting serves Vite's dist output with SPA fallback. The API base URL concept is not needed. Spark Hosting quota is shared at project level; monitor usage and keep bundles/assets small. No Cloud Functions rewrite or paid compute is used.
