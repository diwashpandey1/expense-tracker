# AVORA — Personal Finance Tracker

AVORA is a responsive personal finance tracker built with React, JavaScript, Vite, Firebase Authentication, and Cloud Firestore. It supports account-backed income and spending, savings accounts and goals, budgets, recurring entries, reporting, CSV backups, and display-currency conversion.

This repository is the application source and its single maintained project guide. **Project setup, architecture, data model, financial behavior, security, testing, deployment, migration boundaries, and known limitations are documented here.** Source files remain JavaScript (`.js`) or React JSX (`.jsx`); TypeScript is not used.

## Contents

- [What the app does](#what-the-app-does)
- [Routes](#routes)
- [Financial behavior and data integrity](#financial-behavior-and-data-integrity)
- [Currency and conversion](#currency-and-conversion)
- [Settings, privacy, and offline use](#settings-privacy-and-offline-use)
- [Technology and architecture](#technology-and-architecture)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Set up Firebase](#set-up-firebase)
- [Configure the environment](#configure-the-environment)
- [Run locally](#run-locally)
- [Tests and checks](#tests-and-checks)
- [Firestore data model](#firestore-data-model)
- [Security and privacy](#security-and-privacy)
- [Deploy to Firebase Hosting](#deploy-to-firebase-hosting)
- [Data reset, account deletion, and migration](#data-reset-account-deletion-and-migration)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

## What the app does

### Public pages and financial tools

- A public home page, About page, Contact page, and Blog/reading list.
- A simple-interest calculator and a SIP/investment projection calculator.
- A standalone currency exchange calculator using indicative reference rates.
- The Contact page opens a pre-addressed email draft. It does not send or retain messages through a server.

### Sign-in and account

- Firebase email/password sign-up and sign-in.
- Google sign-in through Firebase Authentication.
- Password reset, persistent browser sign-in, profile setup, and sign-out.
- Initials or a generic icon identify the user. Profile images, avatar uploads, image endpoints, and Firebase Storage are intentionally excluded.

### Finance workspace

- Multiple spending and savings accounts, optional opening balances, account history, and auditable balance adjustments.
- Income, expenses, and internal transfers with date, category, optional note, and edit/void history.
- Expense splits across two or three categories. Split amounts must equal the transaction total, and summaries and category budgets use the individual split amounts.
- The original 18 expense, 8 income, and 9 savings category labels, plus custom categories. Used categories are archived so historical entries retain their category context.
- Monthly or yearly budgets, category budgets, progress bars/rings, and threshold/over-limit warnings.
- Savings goals backed by allocations from real savings-account balances.
- Daily, weekly, monthly, yearly, and custom-interval recurring schedules.
- Dashboard periods, charts, recent activity, budgets/goals context, recurring cash-flow forecast, and spending insights.
- Analytics over monthly, yearly, lifetime, or selected date ranges.
- Transaction CSV export and preview-before-import. Import validates dates, account/category names, type, amount, currency, duplicate rows, and split details before posting.

## Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Home | Signed out |
| `/about`, `/contact`, `/blog` | Public information pages | Signed out |
| `/tools` | Financial tools index | Signed out |
| `/tools/interest-calculator` | Simple-interest calculator | Signed out |
| `/tools/sip-calculator` | SIP calculator | Signed out |
| `/tools/currency-exchange` | Standalone currency calculator | Signed out |
| `/login`, `/signup`, `/reset-password` | Authentication | Signed out |
| `/app` | Dashboard overview | Signed in |
| `/app/transactions` | Transaction history and entry | Signed in |
| `/app/accounts` | Spending/savings accounts and history | Signed in |
| `/app/recurring` | Recurring schedules and due items | Signed in |
| `/app/categories` | Category management | Signed in |
| `/app/budgets` | Monthly/yearly budgets | Signed in |
| `/app/goals` | Savings goals and allocations | Signed in |
| `/app/analytics` | Cash-flow reports and charts | Signed in |
| `/app/settings` | Profile, appearance, dashboard, privacy, and app settings | Signed in |

Signed-in users are redirected from public and authentication routes to `/app`. Unsigned users are redirected from `/app/*` to `/login`. These route guards improve navigation; Firestore Security Rules separately enforce data access.

## Financial behavior and data integrity

### Source amounts, account balances, and monthly income

- An account's opening balance represents money that already existed when tracking began. It is not new income.
- New account-backed income increases the selected account. Expenses reduce a spending account. Transfers move money between same-currency accounts and have no effect on combined balance, income, or expenses.
- A person can spend more than the current month's income when they are spending money carried into the month. The controlling boundary for a new account-backed expense is available account balance, not that month's income.
- An expense that exceeds its selected spending account requires the user to choose and confirm a savings account to cover the shortfall. The transfer and expense post together. Account balances cannot go below zero.
- Budgets are planning limits. They may exceed income, do not reserve cash, and do not prevent a funded expense from being recorded. The app warns at the configured threshold (80% by default) and at 100%; the account balance remains the spending constraint.
- Legacy accountless transactions remain intact and continue to appear in cash-flow reporting. They are not silently assigned to accounts or included in account balances.

### Savings goals and recurring entries

- A goal allocation reserves part of an existing savings balance. It does not create money, count as an expense, or change the account balance.
- Withdrawals release allocations when required. Voiding a transaction restores associated allocation changes.
- Recurring income stays pending until the user confirms it was received. A recurring expense that is not funded stays pending for review.
- Recurring work is processed in the browser when a signed-in user opens the app. Deterministic occurrence/operation IDs make retries idempotent; there is no always-running server scheduler.

### Amount precision and categories

- Amounts are entered with the account/source currency's decimal precision and stored as integer minor units (for example, cents or paisa) represented as decimal strings.
- Calculations use JavaScript `BigInt` where precise integer arithmetic is required. Materialized account balances are checked against safe integer limits.
- Calendar dates are stored as `YYYY-MM-DD` strings rather than timestamps that can shift across time zones.
- Category names are stored as snapshots on historical entries. Archiving a used category does not rewrite past transactions.
- A split expense is still one ledger transaction and one total account posting. Its category lines divide the total for budgets, charts, and filters.

## Currency and conversion

The account/source currency and the display currency have different jobs:

1. The source currency is the currency in which the account and its stored amounts are denominated.
2. The display currency controls how the app formats balances, transactions, budgets, goals, summaries, and analytics.
3. Changing display currency never rewrites transaction amounts, account balances, budget limits, goal allocations, or ledger postings.

The app currently offers **USD, EUR, GBP, INR, NPR, AUD, CAD, JPY, CNY, SGD, CHF, and NZD**. One shared rate snapshot uses USD as its base and requests all supported target currencies in one CurrencyAPI call ([latest-rate endpoint](https://currencyapi.com/docs/latest/)). User identity, transaction data, notes, and balances are never sent to CurrencyAPI.

The Cloudflare Worker stores the canonical snapshot at the single KV key `rates:USD:v1`. A scheduled handler checks expiry every 15 minutes and calls CurrencyAPI only if the snapshot is missing or at least seven days old. The browser only reads `/api/currency-rates`; it cannot publish rates or trigger provider refreshes. The response includes the provider date, last sync time, and expiry time. Successful snapshots are at least seven days apart. Failed updates leave the previous snapshot in place and use an exponential retry backoff starting at one hour, up to one day. Rates come from an indicative data set and may be stale briefly while an expired snapshot waits for the next scheduled run.

The rates are units of each currency per 1 USD. To display an amount from currency `S` in currency `T`, the app uses `amount × rates[T] ÷ rates[S]` and rounds at the target currency's minor-unit precision. Changing the display preference never rewrites stored amounts. If the Worker has no snapshot yet, the app displays amounts in the source currency. The public standalone calculator remains a separate no-key Frankfurter reference-rate tool.

**API key handling:** `CURRENCY_API_KEY` is a Cloudflare Worker secret and is never included in the Vite bundle. Do not set it as a `VITE_` variable. If the key was previously used as `VITE_CURRENCY_API_KEY`, remove it from Cloudflare's frontend build variables and rotate it after configuring the Worker secret.

For returning users whose active accounts all use a single currency that differs from the old profile currency setting, the app treats the account's currency as the source and keeps the former profile currency as the initial display choice. This compatibility correction updates the profile currency field; it does not rewrite any financial amount.

## Settings, privacy, and offline use

### Personalization

Settings are saved per user in `users/{uid}/settings/preferences`. Available controls include:

- Light, dark, or system theme; accent color; density; font size; sidebar state; and motion preference.
- Dashboard period, visible widgets, hidden amounts, recent-transaction count, and summary-card order/width.
- Transaction type/account/category defaults, date format, week start, list density, sorting, and optional save confirmation.
- Budget warning threshold, progress display, and default monthly/yearly period.
- In-app budget, overspending, recurring, goal, and monthly-summary reminders.
- Display currency and shared weekly exchange-rate snapshot status.

### Privacy

- Firebase Authentication supplies the signed-in UID. Finance documents live below that user's Firestore path.
- Financial data is not sent to a server. The Cloudflare Worker only serves the static app and public exchange-rate snapshot; it does not receive Firebase tokens or financial records. No Express API, PostgreSQL service, or Firebase Cloud Function is used.
- There are no profile-image uploads, file uploads, Firebase Storage integration, or image URLs in the schema.
- Amount-hiding controls mask formatted amounts in the UI. They do not encrypt or remove stored values.
- Currency conversion sends only currency codes to CurrencyAPI through the Cloudflare Worker. Its API key is a Worker secret.

### Install and offline behavior

The production build includes a web app manifest and a service worker that caches the app shell and same-origin assets. Firestore uses persistent browser caching when available, with a memory-cache fallback. Cached screens/data may be viewable offline, but financial posting and other Firestore transactions need a network connection; the app is not an offline-first ledger and does not promise that account operations will queue safely while disconnected.

## Technology and architecture

### Stack

- React 19, JavaScript, JSX, and Vite.
- Tailwind CSS 4, Lucide React, Framer Motion, and Sonner toast notifications.
- React Router for public and authenticated routing; Recharts for analytics.
- Firebase JavaScript SDK: Authentication and Cloud Firestore.
- Firebase Hosting for the static single-page application and Firestore/Auth hosting options.
- Cloudflare Workers static assets for the deployed site, scheduled rate refresh, and read-only currency endpoint; Workers KV for the shared snapshot.
- CurrencyAPI for the shared weekly display-conversion snapshot; Frankfurter for the public converter.
- Vitest, Testing Library, Firebase Emulator Suite, and rules-unit-testing for checks.

No TypeScript, Express API server, SQL database, Firebase Cloud Functions, Firebase Storage, FCM, or paid Firebase service is required. The Cloudflare Worker is JavaScript and is deployed with Wrangler; Node.js is used for Vite, Wrangler, Firebase tooling, and tests.

### Request and data flow

```text
React/JavaScript browser app
  ├── Firebase Authentication ── user UID
  ├── Cloud Firestore SDK ─────── users/{uid}/... records
  │      └── Firestore Rules enforce owner and write constraints
  ├── Cloudflare Worker ───────── static Vite assets + GET /api/currency-rates
  │      ├── Cron Trigger ─────── checks the shared snapshot expiry every 15 minutes
  │      ├── Workers KV ───────── one USD-based rates snapshot for all users
  │      └── CurrencyAPI ──────── called only when the Worker snapshot expires
  └── Firebase Hosting ───────── optional static Vite build (dist/)
```

Pages call service modules for Firestore operations. Financial writes run in Firestore transactions that update the ledger, account balances, finance summary, and operation record together. Firestore Rules validate ownership, document shape, relationships, and paired postings. React route guards are not treated as an authorization boundary.

Firestore cannot recompute an arbitrary user-wide sum inside Security Rules. The finance summary is therefore app-maintained transactional state, not protection against a signed-in owner deliberately editing their own documents directly. Rules validate posted account deltas and nonnegative balance changes, but this browser-only architecture does not claim tamper-proof bookkeeping against the data owner.

## Project layout

```text
src/
  components/       Shared layouts, navigation, identity, and UI controls
  constants/        Default categories and supported currencies
  context/          Auth and user-preferences providers
  domain/           Financial rules, ledger calculations, insights, and limits
  lib/              Firebase initialization, dates, money, and helpers
  pages/            Public pages and authenticated finance workspace
  services/         Auth, Firestore reads/writes, ledger, CSV, rates, and lifecycle
worker/            Cloudflare Worker routes, scheduled refresh, and static asset fallback
  test/             Emulator rules and ledger integration suites
public/             Favicon, manifest, and service worker
firestore.rules     Firestore ownership and validation rules
firestore.indexes.json
firebase.json       Existing Firebase Hosting, rules, indexes, and emulator config
wrangler.jsonc      Cloudflare Worker assets, KV, and Cron Trigger configuration
.env.example       Environment variable names and placeholders
```

The application source uses `.js` or `.jsx`. Configuration/tooling files may use the formats required by their tools; do not introduce `.ts` or `.tsx` application files or a `tsconfig.json`.

## Requirements

- Node.js 22 or newer and npm.
- A Firebase project with a Firebase web app, Authentication, and Cloud Firestore configured. Firebase Hosting remains available for the optional Firebase deployment.
- A Cloudflare account with the existing Worker connected to this GitHub repository, a Workers KV namespace, and a Worker secret for CurrencyAPI.
- Firebase CLI access to the intended project for emulator/deployment commands.
- A CurrencyAPI key stored as the Cloudflare Worker secret `CURRENCY_API_KEY`.

Firebase Authentication, Firestore, and Hosting are designed for the Firebase Spark/free-plan architecture. Confirm current quotas and provider terms in the Firebase console before release; quota limits can change. This project does not silently require a Blaze upgrade.

## Set up Firebase

Use the Firebase project you created for this application. This repository already contains your Firebase Hosting setup.

1. In Firebase Console, enable **Email/Password** and **Google** under Authentication sign-in providers.
2. Add `localhost` and the deployed Hosting domain to authorized domains for Authentication.
3. Create the Cloud Firestore database in the intended location.
4. Configure your Firebase web app values in `.env` as shown below.
5. Deploy the repository's Firestore Rules and indexes before exercising features whose rules have changed:

   ```sh
   firebase use
   firebase deploy --only firestore:rules,firestore:indexes
   ```

6. Keep the selected Firebase project pointed at your new project. Inspect `firebase use` before any deployment. Do not rerun `firebase init` over this repository or replace `.firebaserc`/`firebase.json` unless you specifically intend to reconfigure Hosting.

Firebase Authentication stores credentials and provider identity. Firestore stores the user profile and finance data. The browser uses the Firebase client SDK; the Cloudflare Worker separately owns the public currency snapshot and does not use Firebase Admin credentials.

## Configure the environment

Copy the example file and edit the local copy:

```powershell
Copy-Item .env.example .env
```

Or on macOS/Linux:

```sh
cp .env.example .env
```

Set these variables in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase web app client config value |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Authentication domain, usually `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Optional Firebase web measurement ID; analytics is not used by this app |
| `VITE_CURRENCY_RATES_URL` | Optional | Currency endpoint URL; defaults to same-origin `/api/currency-rates`. Set to the deployed Worker endpoint when the frontend is hosted elsewhere, such as Firebase Hosting. |
| `VITE_CONTACT_EMAIL` | Optional | Address prefilled by the public Contact page's email draft |
| `VITE_USE_FIREBASE_EMULATORS` | Optional | Set to `true` to point Auth/Firestore SDKs to local emulators |

Configure the provider key separately in Cloudflare. Never put `CURRENCY_API_KEY` in a `VITE_` variable or frontend build setting.

Values with a `VITE_` prefix are public in the browser bundle. Never put a Firebase service-account key, Admin credential, private signing key, or other server secret in `.env` for this SPA. Do not copy old Firebase project values. The `.env` file is local and should remain untracked; `.env.example` contains placeholders only.

After editing environment variables, restart Vite so it reloads them.

## Run locally

```sh
npm install
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`. Open it in a modern browser and sign in with an enabled Firebase provider. The app shows a Firebase setup screen if the required Firebase web values are missing.

For a production-like local preview:

```sh
npm run build
npm run preview
```

The preview serves the static output from `dist/`; it does not deploy anything.

### Firebase emulators

The checked-in `firebase.json` configures Auth on port `9099`, Firestore on `8080`, Hosting on `5000`, and disables the Emulator UI. To use the Auth and Firestore emulator connections from the app, set `VITE_USE_FIREBASE_EMULATORS=true` in a local environment and run the Firebase emulators in another terminal. Do not point emulator tests at production data.

## Tests and checks

The repository has separate commands for ordinary unit tests and emulator-backed suites:

```sh
npm run lint          # ESLint
npm test              # Unit tests (Vitest)
npm run test:rules    # Firestore Rules suite using a demo emulator project
npm run test:ledger   # Account-ledger integration suite using a demo emulator project
npm run build         # Production Vite build
```

`npm test` excludes the two emulator integration files; use the dedicated scripts to run them. The emulator scripts do not need or use production Firestore data. For release work, run the checks, review the selected Firebase project, and perform a browser walkthrough with the intended project before deploying.

## Firestore data model

Every finance path is scoped below `users/{uid}`. The signed-in Firebase Auth UID identifies the owner; the app does not trust a user ID sent from a form.

| Path | Purpose |
| --- | --- |
| `users/{uid}` | Email, display name, source/account currency, timestamps |
| `users/{uid}/settings/preferences` | Appearance, dashboard, entry defaults, reminders, privacy, display currency |
| `users/{uid}/categories/{categoryId}` | Expense, income, and savings categories; archive/default flags |
| `users/{uid}/accounts/{accountId}` | Account type/classification, source currency, opening/current balance, status |
| `users/{uid}/transactions/{transactionId}` | Legacy transaction records and mirrors of account-backed entries for history UI |
| `users/{uid}/ledgerEntries/{operationId}` | Account-backed income, expense, transfer, adjustment, and split details |
| `users/{uid}/financialOperations/{operationId}` | Idempotency and signed account deltas used by rules validation |
| `users/{uid}/financeState/summary` | Serialized savings balance and goal-allocation totals maintained with operations |
| `users/{uid}/goalAllocations/{goalId}` | Savings reserved toward a goal; not a separate balance |
| `users/{uid}/auditEvents/{auditId}` | Account/transaction audit snapshots |
| `users/{uid}/budgets/{budgetId}` | Monthly or yearly overall/category limits |
| `users/{uid}/goals/{goalId}` | Goal target, date, and status |
| `users/{uid}/recurringSchedules/{scheduleId}` | Schedule definition and next due date |
| `users/{uid}/recurringOccurrences/{scheduleId_dueDate}` | Pending/processed occurrence with deterministic identity |

Legacy `users/{uid}/currencyRates/{baseCurrency}` documents are not used by the new flow. Firestore allows their owner to read/delete them, but denies create/update. Account deletion still cleans up those old documents.

Money uses integer minor units as decimal strings in ledger documents. `occurredOn` is a calendar-date string; Firestore timestamps are used for audit and create/update times. New account-backed transactions include their original `currencyCode`; the current display currency is a preference and is not stored as the transaction's denomination.

Composite indexes are defined in `firestore.indexes.json`. Transaction history uses bounded batches (up to 400 records per query batch) and client-side filtering/sorting/pagination; larger histories increase Firestore reads and browser memory use.

## Security and privacy

- Firestore Rules enforce owner-scoped paths and validate fields and important relationships. Firebase Authentication is the only identity system.
- Firebase UID is consistent across Auth, frontend session, Firestore owner path, and rule checks.
- Frontend route guards do not replace Firestore authorization.
- Financial changes use atomic Firestore transactions with stable operation IDs to prevent duplicate application on retry.
- No Google access token is stored for use with another API. No custom backend receives Firebase tokens.
- No uploaded image or file is stored; Firebase Storage is not used or needed.
- User financial data is not sent to CurrencyAPI or the standalone Frankfurter calculator. The Worker request contains only currency codes.
- The Worker API is read-only from browsers. Only the scheduled Worker handler has the CurrencyAPI secret and writes the shared KV snapshot.
- Browser cache and amount masking are convenience features, not encryption. Protect access to the device and Firebase account.

Firestore Rules cannot independently aggregate an arbitrary transaction history. The app pairs account updates with posted operations and maintains the finance summary transactionally. This improves consistency but does not make an account owner's own database writes tamper-proof.

## Deploy to Firebase Hosting

The existing Firebase Hosting configuration serves `dist/` and rewrites SPA routes to `index.html`. For a Firebase-hosted frontend, set `VITE_CURRENCY_RATES_URL` to the Cloudflare Worker endpoint before building. Deploy only after confirming the CLI is targeting your intended Firebase project:

```sh
firebase use
npm run lint
npm test
npm run build
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
```

The last two commands can be run separately so rules/indexes are published before hosting code that uses them. The package also defines:

```sh
npm run deploy
```

That command builds and deploys Hosting, Firestore Rules, and indexes together. Inspect the selected project before invoking it. Do not approve a Firebase billing-plan upgrade for currency rates; the refresh runs on the existing Cloudflare Worker.

## Deploy the Cloudflare Worker

The Worker serves the Vite `dist/` assets, exposes `GET /api/currency-rates`, and refreshes a shared KV snapshot from a Cron Trigger. The existing Cloudflare Git integration should build with `npm ci && npm run build` and deploy with `npx wrangler deploy` (or `npm run deploy:cloudflare`). The Wrangler config must target the **exact existing Worker name** so the deployment updates the right Worker.

One-time Cloudflare setup:

1. Create a KV namespace named `CURRENCY_RATES`:

   ```sh
   npx wrangler kv namespace create CURRENCY_RATES
   ```

2. Copy its namespace ID into `wrangler.jsonc` under the `CURRENCY_RATES` binding. Replace the placeholder Worker `name` with the exact name already deployed in your Cloudflare account.
3. Add the provider key as a Worker secret:

   ```sh
   npx wrangler secret put CURRENCY_API_KEY
   ```

   Paste the key into Wrangler's hidden prompt. Do not commit it or add it to a `VITE_` variable.
4. Set the GitHub-connected Cloudflare build command to `npm ci && npm run build` and deploy command to `npx wrangler deploy`, then deploy the repository.
5. Confirm the endpoint returns a JSON USD snapshot at `/api/currency-rates`. A first snapshot is written on the next 15-minute scheduled run. Successful snapshots are at least seven days apart; failed calls back off from one hour to at most one day between retries.
6. Remove `VITE_CURRENCY_API_KEY` from Cloudflare's frontend build variables. If that key has already shipped in a browser bundle, rotate it in CurrencyAPI after setting the Worker secret.

When developing locally against the deployed Worker, set `VITE_CURRENCY_RATES_URL` in your local `.env` to the Worker endpoint. If you run the Worker locally, use `npm run dev:worker` after creating the KV binding and setting a local `CURRENCY_API_KEY` secret.

The current Cloudflare Workers Free plan documents 100,000 Worker requests/day, and Workers KV documents 100,000 reads/day and 1,000 writes/day. The app uses one KV key and writes only on a weekly refresh, but monitor usage as traffic grows; check the current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [KV pricing/quotas](https://developers.cloudflare.com/kv/platform/pricing/) before relying on those limits.

## Data reset, account deletion, and migration

### Reset finance data

The in-app reset control requires typing `RESET`. It removes account/ledger/transaction, recurring, goal/allocation, budget, audit, finance-state, and settings data in sequential batches, then resets the active preference state. It preserves the profile and categories. Shared exchange rates are stored outside Firestore and are unaffected by a user's finance reset.

### Delete account

Account deletion reauthenticates the user (password or Google popup), removes the user's known Firestore subcollections in bounded batches, removes the profile document, then deletes the Firebase Authentication identity. If Firestore cleanup fails, Auth deletion is not attempted. This is client-driven, not one atomic server job; if the browser/network stops during cleanup, the user may need to retry.

### Existing/legacy financial data

No historical account assignment or opening balance can be inferred safely from accountless transactions. Existing transactions, categories, budgets, and goals are kept in place. Legacy cash-flow totals remain separate from actual account balances until the owner explicitly reconciles history; the app does not invent account assignments or silently rewrite old monetary records.

## Known limitations

- Recurring schedules are processed only when a signed-in user opens the app. No server scheduler runs while browsers are closed.
- Firestore, Cloudflare, and CurrencyAPI can be unavailable or quota-limited. The last saved snapshot is used where possible, with its stale status shown.
- Cloudflare Workers KV is eventually consistent across locations, so a newly published snapshot may take a short time to appear everywhere.
- The scheduled refresh checks expiry every 15 minutes; after expiry, users may see the previous snapshot until the next scheduled run completes.
- Offline shell and Firestore cache support do not make financial postings safe to perform offline.
- Historical accountless data still needs owner-reviewed reconciliation before it can contribute to account balances.
- Firestore usage and browser memory grow with financial history. Query volume is not aggregated server-side.
- The production build may report a large JavaScript bundle due to charting and Firebase dependencies; further code splitting/performance work may be useful.
- No production migration or deployment is performed by local build/test commands.

## Troubleshooting

### The app says Firebase is not configured

Check that `.env` exists, required `VITE_FIREBASE_*` values are set from the intended Firebase web app, and restart `npm run dev`. Do not paste a Firebase Admin/service-account key into the Vite environment.

### Sign-in fails or Google popup is blocked

Confirm Email/Password or Google is enabled in Firebase Authentication, the current hostname is in Authorized domains, and the browser allows the popup. A same-email account created with a different provider must use that existing provider; provider linking is not implemented.

### Firestore returns `permission-denied`

Confirm you are signed in, that the selected Firebase project is correct, and that current `firestore.rules` have been deployed. Review the failing document path and payload shape. Route access alone does not grant database access.

### Display currency stays in the source currency

Check the selected display currency in Settings and open `/api/currency-rates` on the deployed Worker. Verify the `CURRENCY_RATES` KV binding, `CURRENCY_API_KEY` Worker secret, and Cron Trigger in Cloudflare. A new snapshot is generated at the next 15-minute scheduled run. If the provider request fails or no snapshot exists, the app keeps using any locally saved snapshot or falls back to the source currency.

### A category or split is rejected

Confirm the category is active and matches the transaction type. A split requires two or three distinct expense categories, positive line amounts, and a sum exactly equal to the full transaction amount.

### A transaction cannot be posted

Check that the selected account is active, is a spending account for expenses, uses the source currency, and has sufficient funds. To cover a shortfall, choose and confirm a savings account with enough available funds. Transfers require two active accounts in the same currency.

---

**Project name in the interface:** AVORA. **Application language:** JavaScript/JSX only. **Backend model:** Firebase client SDK for identity and finance data; Cloudflare Worker + KV for the shared currency snapshot.
