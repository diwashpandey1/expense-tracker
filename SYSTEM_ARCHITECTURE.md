# AVORA System Architecture

## Runtime architecture

AVORA remains a browser application built with JavaScript, React, Vite, and the Firebase JavaScript SDK. Firebase Authentication is the one identity system. Firestore is the application database and authorization boundary. Cloudflare Workers serves the deployed static site and the existing public exchange-rate endpoint; it is not an application API for user finance data. The app has no Express server, PostgreSQL, Firebase Storage, Firebase Functions, or Firebase Admin credential.

```text
React + JavaScript + Vite
  ├── Firebase Authentication: email/password and Google → Auth UID
  ├── Cloud Firestore SDK → users/{uid}/... → Firestore Rules validate owner and writes
  └── Cloudflare Worker → static assets + public currency-rate snapshot only
```

## Identity and onboarding

After sign-up, new profile docs have `onboardingStatus: not_started`. The protected `/app` route checks the loaded Firebase profile; `not_started` and `in_progress` users see the compulsory onboarding wizard. Existing profiles without a status are treated as legacy-complete. Successful completion updates the root profile and creates accounts in one Firestore transaction. Auth UID is consistent through Auth, React context, document paths, and Rules. Frontend guards do not replace Rules.

Onboarding drafts are in `users/{uid}/onboarding/state`. Final personal/professional information is stored in `users/{uid}` plus the private `users/{uid}/financialProfile/general` subdocument. Financial estimates are descriptive profile information and are never used as posted income.

## Financial writes

Page components call JavaScript service modules. Account-backed financial posting uses Firestore `runTransaction` to write the ledger event, history/report mirror (except opening events), account balance cache(s), operation ID/deltas, finance-state summary, and linked goal allocation changes together. Internal transfer has one event with two postings; external transfers have one posting. Stable IDs make retry of an operation idempotent. Account source currencies are required to equal the profile currency today.

Firestore Rules check owner scope, document fields, account/category relationships, valid amounts and dates, and account deltas paired with a financial operation. Firestore Rules cannot dynamically aggregate arbitrary history. A client-first architecture therefore cannot claim tamper-proof data against its authenticated owner.

## Public currency rates

Currency display conversion remains separate from finance posting. The Cloudflare Worker provides the shared USD-base reference rates. The client does not send personal records to that Worker. Currency display conversion does not alter stored ledger amounts. See README and the currency sections for setup and quota limitations.

## Source boundaries

- `src/pages`: React/JSX views and route-level UI.
- `src/context`: Firebase auth and preferences state.
- `src/services`: Auth, Firestore, onboarding, financial ledger, preferences, reports, and lifecycle functions.
- `src/domain`: financial invariants and calculations.
- `firestore.rules`: owner and write checks.
- `worker`: independent static asset and shared rate endpoint logic.

For the full database contract, read `DATABASE_SCHEMA.md` and `FIRESTORE_SCHEMA.md`. For financial semantics, read `MONEY_FLOW_AND_TRANSFER_LOGIC.md` and `FINANCIAL_DATA_INTEGRITY.md`.
