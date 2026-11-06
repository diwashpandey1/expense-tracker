# Expense Tracker 2.0 — Technology Stack

## Selected

- React, JavaScript, JSX, and Vite. TypeScript is not used.
- Tailwind CSS 4 via Vite plugin.
- React Router for navigation.
- Lucide React icons; Framer Motion only for purposeful transitions.
- Recharts for analytics.
- Firebase JavaScript SDK: Authentication and Cloud Firestore.
- Firebase Hosting for the static single-page application.
- Frankfurter public API for no-key daily reference exchange rates in the standalone converter only; no user data is sent.
- Firestore Security Rules and Emulator Suite for authorization/testing.
- Vitest, Testing Library, and rules-unit-testing.
- No custom server/API, SQL database, Cloud Functions, or Storage.

## Firebase service choices

**Authentication — used.** Firebase manages email/password, Google sign-in, and reset flow. Firebase lists social sign-in methods as no-cost on Spark; phone Auth is excluded. The Google provider must be enabled in Firebase Console and deployed domains authorized. Current Firebase docs note 1,000 verification emails/day and 150 password-reset emails/day. The 3,000 DAU limit cited for most providers is for Authentication with Identity Platform; this app will not upgrade. Check live quotas before release.

**Cloud Firestore — used.** It is the only app database, so there is no duplicated persistence layer. Current Spark Standard quotas: 1 GiB stored, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month network egress. Quota exhaustion can disable the affected service until its reset cycle. Queries are user-scoped, period-limited, and paginated where practical; summaries are computed from source transaction documents. At higher scale, reduce query volume or obtain explicit approval for another architecture, never silently upgrade to Blaze.

**Firebase Hosting — used for frontend only.** Current Spark allowance is up to 10 GB Hosting storage and 10 GB/month transfer. Reaching Spark limits can prevent deployments or disable the site until limits reset. API calls go directly to Auth/Firestore; no Hosting rewrite to Cloud Functions is needed.

**Excluded:** Firebase Storage (prohibited; no image/file features), Cloud Functions (not Spark deployable), FCM (no v1 push need), Realtime Database, Analytics, App Check, Firestore extensions, paid Google Cloud services, and Identity Platform upgrade.

**Financial redesign status:** The approved stack remains Firebase Auth + Firestore + Hosting on Spark. No service is being added to solve the ledger design. Client-only recurring processing, if implemented, cannot run while all browsers are closed; due items must be handled idempotently when a user returns. Firestore Rules do not aggregate an arbitrary ledger, so atomic account operations must validate paired postings and disclose any residual limitation. See `IMPLEMENTATION_REPORT.md` for the work currently implemented; accounts, transfers, recurring records, and account-backed goals are not yet live in the app.

**Currency conversion — public data API, not Firebase.** The original app called a keyed exchange-rate provider from browser code. The new calculator uses Frankfurter's public v2 rate endpoint, which currently requires no key and publishes no daily/monthly quota. It serves indicative rates from central-bank and other official sources. The service can still rate-limit abusive traffic or be unavailable; show failure states and use another no-key data source or a manual rate if needed. Rates are not trading quotes. See https://frankfurter.dev/.

Plan and quotas checked 2026-11-06. Firebase may change limits; recheck official docs before release:
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/limits
- https://firebase.google.com/docs/hosting/usage-quotas-pricing
- https://firebase.google.com/pricing

## Configuration

Fresh Firebase client values come from Vite environment variables. Browser Firebase config is public client configuration, not an Admin secret. Actual .env is local and Git-ignored; .env.example contains placeholders only. No old project IDs or credentials are referenced. Never configure a Storage bucket in app code.
