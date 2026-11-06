# Expense Tracker 2.0 — Feature Parity Report

**Comparison:** original sibling `Expense-Tracker` source vs this `expense-tracker-new` implementation. Original project was inspected read-only. This report distinguishes source findings from new-project implementation; passing unit/rules tests do not prove live Firebase or browser behavior.

| Area | Original project | Expense Tracker 2.0 | Result |
|---|---|---|---|
| Public site | Landing at `/`, blog list, and tools | Public Home at `/`, About, Contact, Blog, Tools | Expanded; contact opens an email draft and requires `VITE_CONTACT_EMAIL` |
| App routing | Authenticated finance routes under `/app/*`; some legacy navigation targets were broken | All finance workspace routes under `/app/*`; public/auth routes redirect signed-in users to `/app` | Improved |
| Email/password and reset | Present in source | Firebase Auth email/password and password reset | Parity; live auth not exercised |
| Google sign-in | Present in source | Firebase Google popup sign-in | Parity; fresh project provider/domain setup required |
| Facebook sign-in | Placeholder only | Not included | No functional parity needed |
| Transactions | Create, edit, delete; kind filter | CRUD, text search, kind/category/date filters, sort, paging, exact minor-unit calculations | Improved |
| Categories | 18 expense, 8 income, and 9 saving categories; no management screen | Same 35 default labels, custom categories, archive used categories; savings entries keep category and linked goal | Improved |
| Budgets | No active budget UI | Monthly overall and category budgets with progress | Added |
| Savings goals | CRUD with separately typed saved amount | Goals derive saved amount from linked contributions/withdrawals | Improved data consistency |
| Dashboard/analytics | Summary and limited category charts; no period selector | Period summaries, monthly trends, category breakdowns and chart choices | Improved |
| Currency preference | Browser-local preference shared across accounts | Per-user Firestore display preference; changing it does not convert stored amounts | Improved |
| Simple interest/SIP | Present in source | Standalone calculators with validated formulas | Parity; unit tests added |
| Currency exchange | Browser request used a keyed provider | Frankfurter no-key daily reference rates; explicit indicative-rate labeling | Replaced; network behavior not browser-verified |
| Account reset/deletion | Cleanup could suppress errors before Auth deletion | Reauthentication, sequential Firestore batches, Auth deletion only after cleanup | Safer; client cleanup may be interrupted and is not atomic |
| Profile images | Firebase Storage upload and profile-photo handling | Deliberately excluded; initials avatar only | Excluded per user requirement |
| AI/chat | Static/mock UI, no actual AI service | Not included | Deliberately excluded |
| Firebase services | Auth, Firestore, Storage; unused legacy Realtime Database code | Firebase Auth, Firestore, Hosting only | Storage and Realtime Database excluded; no paid backend |
| Legacy data | Existing data in the old Firebase project | No old credentials, project, or records reused/imported | Fresh project/data boundary |

## Monthly income boundaries

Expenses and savings contributions are capped at the remaining monthly income after existing expenses, contributions, and withdrawals. Overall budgets cannot exceed monthly income. Combined category budgets cannot exceed the overall budget, or income when no overall budget exists. Income changes are rejected if they would leave expenses, savings, or budgets above income. These aggregate checks are done in the Firebase client; Firestore Rules enforce ownership and document validation but cannot aggregate transaction collections independently.

## Preserved original categories

All original default category labels are present unchanged: 18 expense categories, 8 income categories, and 9 saving categories. Saving movements still link to a savings goal, and now also carry one of the original saving categories. Existing accounts are seeded with missing default category documents when categories are first read; existing documents and category IDs are retained.

## Verification status and limitations

- The Firebase Emulator Suite rules tests are the authorization check; route guards are only user experience. Emulator results are reported in `IMPLEMENTATION_REPORT.md`.
- No production Firebase account, live Auth provider, or live user data was used for this comparison.
- A browser walkthrough could not be completed because the available desktop browser automation timed out. Responsive appearance and live exchange API behavior remain unverified.
- Transaction history is fetched from Firestore in bounded query batches, then filtered/sorted/paged in the browser; large histories consume reads and client memory.
- The public contact form composes a `mailto:` draft. It does not deliver or retain messages through a backend.
- Full feature inventory and source caveats for the original are in the sibling `Expense-Tracker/AUDIT_REPORT.md`.
