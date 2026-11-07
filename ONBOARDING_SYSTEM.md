# AVORA Onboarding System

## Purpose and access

New Firebase Auth identities must complete the financial setup flow before entering the `/app` workspace. `AuthGate` redirects users whose profile has `onboardingStatus: not_started` or `in_progress` to the full-screen wizard. Existing profiles with no onboarding status are treated as legacy users and continue to the app without forced migration. A completed profile is never sent through onboarding again.

Firebase Authentication remains the only identity provider. The Auth UID is used for the React session, root profile, Firestore ownership path, and security-rule checks. The frontend gate is a navigation safeguard; Firestore Rules remain the data access boundary.

## User journey and fields

| Step | Fields | Requirement |
| --- | --- | --- |
| Profile | Full name; display name; date of birth; gender; country; primary currency; time zone | Full name and supported currency required. Other fields optional. Country is manually confirmed. |
| Income | Occupation; custom occupation text; income sources; frequency; exact/range/prefer-not-to-say monthly estimate; income channels | An occupation choice is required. No-income choices are supported. Exact income and channels are optional. |
| Habits | Prior tracking method; estimated past monthly income, expenditure, savings; challenges | Entire phase is optional. Values are profile estimates, never ledger entries. |
| Household | Living situation; marital status; household size; dependents; children/count; household expense role | Entire phase optional. No family member names or identifying details are collected. |
| Goals | Multiple objectives; optional primary objective | Optional preferences only. They do not create `goals` documents or allocate savings. |
| Accounts | One or more bank, physical cash, digital wallet, or savings accounts; name; optional provider, subtype, purpose, description; opening balance; local tracking date | At least one valid account is required. Zero is valid. Banking credentials are never collected. All accounts currently use the primary currency. |
| Review | Profile, occupation, priorities, account names, opening balances, combined opening balance, tracking date, explicit review action | Explicit confirmation required before completion. |

## Validation and financial meaning

- Primary currency must be in `SUPPORTED_CURRENCIES`.
- Occupation must be selected; selecting currently unemployed or another applicable option is valid. Income sources may include “No regular income.”
- Account names are 1–80 characters. One to ten account records can be created at onboarding.
- Opening amounts are nonnegative, use the selected currency's decimal precision, and stay within the supported minor-unit range. Zero is explicitly permitted.
- The selected tracking start date must be a real calendar date (`YYYY-MM-DD`). It is saved as a local calendar date and is not silently changed.
- Opening money is an existing starting position. It is stored on the account and represented by a separate `opening_balance` ledger-history record. It does not create an income or expense transaction and does not enter cash-flow summaries.
- Historical income/spending/saving estimates and income sources live in `financialProfile/general`; no actual ledger operation is created from them.
- Broad financial objectives do not become savings goals automatically.

## Saving and resuming

After each Continue/Back navigation, `saveOnboardingDraft` writes `users/{uid}/onboarding/state` and marks the root profile `in_progress`. The stored current step and answers load when the user returns. The wizard remains accessible only to the authenticated owner through Firestore Rules.

Completion validates required fields and uses a Firestore transaction to create the account documents, zero or positive opening ledger entries, idempotency operation documents, finance summary, private financial profile, and root profile completion status together. The root stores the selected primary account ID; Rules require an active account to exist in the same atomic completion before accepting the first transition to `completed`. Stable account IDs are persisted in the draft. If the transaction fails, no partial accounts or opening entries are committed; the draft remains available for retry. Successful completion deletes the draft and updates in-memory Auth profile state so routing opens `/app`.

## Existing users and migration

Existing users with absent `onboardingStatus` are interpreted as legacy-complete. Existing transactions, accounts, categories, budgets, and goals are not rewritten. Existing users are not assigned an invented opening balance. No batch backfill or destructive migration is performed. A user with a current `not_started`/`in_progress` status must finish the new-user setup, which is intended for accounts created by the current app flow.

## Privacy and future changes

Personal and financial-profile fields are stored in owner-scoped Firestore documents. The optional demographic information is not used for ledger calculations. Removing the account in the app's account-deletion workflow cleans up the new `onboarding` and `financialProfile` subcollections. If the app later adds server-side recommendations, read only the minimum profile fields required and keep estimates separate from actual financial activity.
