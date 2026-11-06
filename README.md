# AVORA — Your money. Your direction.

React + Firebase personal finance tracker. Firebase Authentication handles identity, Cloud Firestore stores user-scoped records, and Firebase Hosting serves the frontend. No custom API server, SQL database, Cloud Functions, Firebase Storage, or profile images are used.

## Requirements

- Node.js 22+ and npm.
- A new Firebase project kept on the Spark plan.
- Firebase Authentication email/password and Google providers enabled.
- Cloud Firestore created in production mode; deploy firestore.rules and firestore.indexes.json.
- Firebase CLI for local emulators and Hosting deployment.

Do not reuse any values from the original project. Copy .env.example to .env and enter the fresh Firebase web configuration from the new project. The app needs API key, auth domain, project ID, and app ID. No Admin/service-account key is needed.
Set `VITE_CONTACT_EMAIL` to the support email address if you want the public contact form to open a ready-to-send email draft.

## Routes and product areas

- `/` is the public Home page. `/about`, `/contact`, `/blog`, and `/tools/*` are public pages.
- `/login`, `/signup`, and `/reset-password` (including legacy auth aliases) are public authentication pages.
- After sign-in, visits to public/auth pages redirect to `/app`. The tracker lives under `/app/*` (overview, transactions, accounts, recurring, categories, budgets, goals, analytics, and settings). Unauthenticated visits to `/app/*` go to login.
- Signed-in users are redirected from `/`, `/about`, `/contact`, `/blog`, `/tools/*`, and all sign-in/reset pages to `/app`.
- Original defaults are seeded per account: 18 expense, 8 income, and 9 saving categories. Savings movements record both a savings category and a linked goal.
- `/tools` includes simple-interest and SIP calculators plus currency conversion. Conversion uses the public Frankfurter reference-rate API without an API key; rates are indicative and usually update daily.
- The Contact page opens a pre-addressed email draft; it does not send or store messages. Set `VITE_CONTACT_EMAIL` to enable it.

## Local development

1. npm install
2. Copy .env.example to .env and configure the new Firebase project.
3. npm run dev
4. npm run lint
5. npm test

For safe rules testing, use the Firebase Emulator Suite: npm run test:rules. Emulator tests use a demo project and do not touch production data.

## Firebase setup and deployment

1. Confirm the selected Firebase project is the new project and remains on Spark. `firebase init hosting` configures static hosting only; it does not create Firestore or publish Firestore rules.
2. In Authentication → Sign-in method, enable Email/Password and Google, choose a support email, and authorize `localhost` plus the deployed Hosting domain.
3. Create Firestore and deploy rules/indexes: npx firebase-tools deploy --only firestore:rules,firestore:indexes.
4. Set fresh Vite configuration in .env for local use; configure the same VITE_FIREBASE_* variables as repository build variables for CI.
5. Build: npm run build.
6. Deploy static Hosting: npx firebase-tools deploy --only hosting.

Firebase Hosting Spark currently has finite storage/transfer quotas; Firestore has daily read/write/delete and storage quotas. If quotas are reached, the service may stop until reset. Do not upgrade to Blaze without explicit approval. Check TECH_STACK.md for official links and current figures.

## Data and privacy

Every user record is stored beneath users/{uid}; Firestore Rules validate the signed-in UID and document shape. User data is never protected solely by React route guards. Ledger amounts use minor-unit decimal strings and calculations use BigInt; account materialized balances are safe integer minor units. There is no image upload or file storage.

Account-backed income, expenses, transfers, and savings funding use atomic Firestore transactions. Legacy accountless transaction records are preserved and shown in cash-flow reports, while account balances include only opening balances and new ledger activity. The app does not infer historical account assignments. Budgets are planning limits, are not capped by income, and do not reserve cash. Recurring items are processed when the signed-in user opens the app; there is no server scheduler.

Personalization is stored at `users/{uid}/settings/preferences`, scoped by Firestore Rules, and applied through a shared React provider. Settings cover appearance, dashboard widgets and periods, transaction entry defaults, date/list display, monthly or yearly budget periods and warning/progress display, privacy masking, and in-app reminders. See `SYSTEM_ARCHITECTURE.md` and `DATABASE_SCHEMA.md` for defaults and behavior. Notifications are evaluated while the app is open; Firebase Cloud Messaging and scheduled delivery are not used.

## Financial redesign status

The account ledger, account-backed goals, recurring schedules, overspending confirmation, and date-range balances are implemented. Budgets may exceed income and spending can exceed a budget with warnings at 80% and 100%, subject to available account funds. Legacy data reconciliation and live Firebase verification remain. See `IMPLEMENTATION_REPORT.md` for exact validation results and remaining limitations.
