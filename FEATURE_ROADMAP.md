# AVORA Feature Roadmap

## Delivered in this implementation

- [x] Compulsory multi-step financial onboarding for newly created users.
- [x] Progress persistence and resume after page reload/sign-in.
- [x] Existing profile compatibility: missing status is treated as legacy-complete.
- [x] Optional personal and household information; income sources and historic estimates remain outside the ledger.
- [x] At least one account; physical cash option, multiple accounts, zero opening balance, and explicit tracking start date.
- [x] Atomic onboarding completion with account records, opening ledger history, profile, and finance state.
- [x] Account provider/subtype/purpose/description metadata; edit, history, audit adjustment, archive and reactivate.
- [x] Internal transfer confirmation and paired postings in one atomic event.
- [x] External incoming/outgoing transfer event types excluded from income and expense totals.
- [x] Firestore owner rules and emulator coverage for private onboarding/financial profile data.
- [x] JavaScript-only implementation and project documentation.

## Known follow-up items

- [ ] Browser walkthrough using the owner's Firebase project, including actual Google and email sign-in, route gating, and mobile screen sizes.
- [ ] Deploy the updated Firestore Rules to the user's selected Firebase project before releasing this source.
- [ ] Add an account-profile Settings page for editing occupation, historical estimates, household information, and financial objectives.
- [ ] Add a dedicated country selector list and optional country auto-suggestion that always requires confirmation.
- [ ] Add a verified migration/repair tool for legacy accounts whose opening balances predate ledger opening records, without rewriting their history.
- [ ] Design multi-currency account support only with explicit FX source/destination amounts, rate snapshots, rounding, and reporting by currency.
- [ ] Consider stronger server-enforced bookkeeping only if the product later accepts a trusted backend; it is not required by the current Firebase-only client architecture.

## Deliberately excluded

- Firebase Storage and all profile/avatar uploads.
- Duplicate auth systems, Express API, PostgreSQL, Firebase Cloud Functions, and secret-bearing service account credentials.
- Automatic creation of income transactions, savings goals, or opening balances from survey responses.
- Untracked-account credentials or direct bank connection.
- Implicit cross-currency or 1:1 transfers.
