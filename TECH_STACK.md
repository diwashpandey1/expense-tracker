# Expense Tracker 2.0 — Technology Stack

## Selected

- React, JavaScript, JSX, and Vite. TypeScript is not used.
- Tailwind CSS 4 via Vite plugin.
- React Router for navigation.
- Lucide React icons; Framer Motion only for purposeful transitions.
- Recharts for analytics.
- Firebase JavaScript SDK: Authentication and Cloud Firestore.
- Firebase Hosting for the static single-page application.
- CurrencyAPI for signed-in app display conversions; Frankfurter remains the no-key source for the standalone calculator. Only currency codes are sent to either provider.
- Firestore Security Rules and Emulator Suite for authorization/testing.
- Vitest, Testing Library, and rules-unit-testing.
- No custom server/API, SQL database, Cloud Functions, or Storage.

## Firebase service choices

**Authentication — used.** Firebase manages email/password, Google sign-in, and reset flow. Firebase lists social sign-in methods as no-cost on Spark; phone Auth is excluded. The Google provider must be enabled in Firebase Console and deployed domains authorized. Current Firebase docs note 1,000 verification emails/day and 150 password-reset emails/day. The 3,000 DAU limit cited for most providers is for Authentication with Identity Platform; this app will not upgrade. Check live quotas before release.

**Cloud Firestore — used.** It is the only app database, so there is no duplicated persistence layer. Current Spark Standard quotas: 1 GiB stored, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month network egress. Quota exhaustion can disable the affected service until its reset cycle. Queries are user-scoped, period-limited, and paginated where practical; summaries are computed from source transaction documents. At higher scale, reduce query volume or obtain explicit approval for another architecture, never silently upgrade to Blaze.

**Firebase Hosting — used for frontend only.** Current Spark allowance is up to 10 GB Hosting storage and 10 GB/month transfer. Reaching Spark limits can prevent deployments or disable the site until limits reset. API calls go directly to Auth/Firestore; no Hosting rewrite to Cloud Functions is needed.

**Excluded:** Firebase Storage (prohibited; no image/file features), Cloud Functions (not Spark deployable), FCM (no v1 push need), Realtime Database, Analytics, App Check, Firestore extensions, paid Google Cloud services, and Identity Platform upgrade.

**Financial redesign status:** The approved stack remains Firebase Auth + Firestore + Hosting on Spark. No service is being added to solve the ledger design. Client-only recurring processing, if implemented, cannot run while all browsers are closed; due items must be handled idempotently when a user returns. Firestore Rules do not aggregate an arbitrary ledger, so atomic account operations must validate paired postings and disclose any residual limitation. See `IMPLEMENTATION_REPORT.md` for the work currently implemented; accounts, transfers, recurring records, and account-backed goals are not yet live in the app.

**Currency conversion — CurrencyAPI + Firestore cache.** The app reads `VITE_CURRENCY_API_KEY` from the user's fresh local Vite environment and calls CurrencyAPI `/v3/latest` directly with the key in the `apikey` request header. The current 12 supported app currencies are requested in one call per base currency; a full base-to-target rate table is cached under the user's `currencyRates/{baseCurrency}` document. The app syncs at most once per seven days for each base currency, with Firestore Rules enforcing the same wait between updates. The provider's dataset varies by plan and may be unavailable or missing a supported pair; in that case the previous cached rates remain in use, or the UI keeps showing original account currency if no cache exists. Rates are indicative, not trading quotes. The API key is a browser-side Vite value and is not a server secret. See https://currencyapi.com/docs/latest/.

Plan and quotas checked 2026-11-06. Firebase may change limits; recheck official docs before release:
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/limits
- https://firebase.google.com/docs/hosting/usage-quotas-pricing
- https://firebase.google.com/pricing

## Configuration

Fresh Firebase client values come from Vite environment variables. Browser Firebase config is public client configuration, not an Admin secret. Actual .env is local and Git-ignored; .env.example contains placeholders only. No old project IDs or credentials are referenced. Never configure a Storage bucket in app code.

The currency key uses the existing `VITE_CURRENCY_API_KEY` environment entry. It is sent only to CurrencyAPI and must not be copied into source files or Firestore records.
