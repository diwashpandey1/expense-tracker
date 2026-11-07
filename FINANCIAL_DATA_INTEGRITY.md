# AVORA Financial Data Integrity

## Monetary values

- Form inputs are validated at the selected currency's decimal exponent.
- Calculated values use JavaScript `BigInt` minor units. Firestore monetary fields in ledger/profile history use decimal integer strings; account cached balances and signed operation deltas are numeric safe integers checked before write.
- Zero is allowed for opening balances and account creation. Posted income, expenses, transfers, and balance adjustments require a nonzero amount/delta.
- Account-backed transactions currently share one primary currency. The app does not add raw balances across different currencies. Display conversion is formatting only and never changes stored amounts.

## Balance invariant and opening positions

The account document stores an opening amount and a current cached balance. The opening ledger event exists to show an auditable start date, but it is skipped by calculations that already seed from `openingBalanceMinor`. Subsequent financial events are signed postings. For each active savings account, the finance summary is updated by the same signed posting; goal allocations reserve part of savings and do not create another balance.

Account updates are checked for nonnegative and safe integer balances. An expense exceeding a spending account requires an atomic savings-to-spending movement or is rejected. Transfers require distinct active accounts and equal currency and require a sufficient source balance. External outflows are also bounded by available account balance.

## Atomicity and duplicate prevention

Financial posting uses a Firestore transaction. An operation ID is shared by the ledger event, transaction mirror, and `financialOperations` record. If that event ID already exists, a retry returns without applying deltas again. Transfer pairs are held in the one event's postings array; no independently editable debit/credit halves exist. Voids reverse all linked postings in one transaction.

Onboarding uses stored draft account IDs and one completion transaction that creates every account, starting ledger event, operation record, finance summary, financial profile, and completed root profile. A failure leaves no partial balance setup. The draft stays until commit succeeds.

## Reporting separation

Income and expenditure summaries count only `income` and `expense`. Opening balances, internal transfers, external transfers, goal allocations, and balance adjustments never enter income or expense totals. Profile estimates and selected goals are not queried as transactions. Legacy accountless records remain separate and are not silently matched to accounts.

## Security limits and operational cautions

Owner-only Firestore Rules check account references and operation deltas for balance changes. Browser code plus Firestore Rules are not a tamper-proof accounting service against the authenticated owner: rules do not independently aggregate all ledger history or prevent an owner from creating allowed records through a modified client. Stronger server-controlled accounting would need a trusted backend, which is deliberately not part of this Firebase + React architecture.

Avoid manual console edits to live account balances, finance-state totals, ledger events, or operation documents. Use the app's adjustment workflow for corrections. Deploy updated Rules before the UI that depends on new documents. Emulator tests cover the rule boundary and atomic posting workflows; production project credentials and deployment are intentionally not touched during local implementation.
