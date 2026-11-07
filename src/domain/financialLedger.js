const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER)

export function toMinorBigInt(value, label = 'Amount') {
  if (!/^(0|[1-9][0-9]{0,15})$/.test(String(value))) throw new Error(`${label} must be a whole number of minor units.`)
  const amount = BigInt(value)
  if (amount > MAX_MINOR) throw new Error(`${label} is above the supported limit.`)
  return amount
}

export function accountBalanceMinor(account, ledgerEvents) {
  let balance = toMinorBigInt(account.openingBalanceMinor || '0', 'Opening balance')
  for (const event of ledgerEvents) {
    if (event.voided || event.kind === 'opening_balance') continue
    for (const posting of event.postings || []) {
      if (posting.accountId === account.id) balance += BigInt(posting.deltaMinor)
    }
  }
  return balance
}

export function calculateFinancialPosition(accounts, ledgerEvents) {
  const balances = new Map(accounts.map((account) => [account.id, accountBalanceMinor(account, ledgerEvents)]))
  for (const [accountId, balance] of balances) {
    if (balance < 0n) throw new Error(`Account ${accountId} has a negative ledger balance.`)
  }
  let income = 0n
  let expenses = 0n
  let transfers = 0n
  for (const event of ledgerEvents) {
    if (event.voided) continue
    const amount = BigInt(event.amountMinor || '0')
    if (event.kind === 'income') income += amount
    if (event.kind === 'expense') expenses += amount
    if (event.kind === 'transfer') transfers += amount
  }
  let available = 0n
  let savings = 0n
  for (const account of accounts) {
    if (account.status === 'archived') continue
    const balance = balances.get(account.id) || 0n
    if (account.classification === 'savings') savings += balance
    else available += balance
  }
  const total = [...balances.values()].reduce((sum, value) => sum + value, 0n)
  if (total !== available + savings) throw new Error('Account classifications do not reconcile with total balance.')
  return { balances, income, expenses, transfers, available, savings, total }
}

export function summarizeLedgerPeriod(accounts, ledgerEvents, transactions, from, to) {
  const eligible = ledgerEvents.filter((event) => !event.voided)
  const before = eligible.filter((event) => event.occurredOn < from)
  const through = eligible.filter((event) => event.occurredOn <= to)
  const periodEvents = eligible.filter((event) => event.occurredOn >= from && event.occurredOn <= to)
  const periodTransactions = transactions.filter((row) => !row.voided && row.occurredOn >= from && row.occurredOn <= to)
  const opening = calculateFinancialPosition(accounts, before)
  const closing = calculateFinancialPosition(accounts, through)
  let transfersIntoSavings = 0n
  let transfersOutOfSavings = 0n
  for (const event of periodEvents) {
    for (const posting of event.postings || []) {
      const account = accounts.find((item) => item.id === posting.accountId)
      if (account?.classification !== 'savings') continue
      const delta = BigInt(posting.deltaMinor)
      if (delta > 0n) transfersIntoSavings += delta
      if (delta < 0n) transfersOutOfSavings += -delta
    }
  }
  const income = periodTransactions.reduce((sum, row) => row.kind === 'income' ? sum + BigInt(row.amountMinor) : sum, 0n)
  const expenses = periodTransactions.reduce((sum, row) => row.kind === 'expense' ? sum + BigInt(row.amountMinor) : sum, 0n)
  return {
    openingBalance: opening.total,
    openingAvailable: opening.available,
    openingSavings: opening.savings,
    income,
    expenses,
    transfersIntoSavings,
    transfersOutOfSavings,
    closingBalance: closing.total,
    closingAvailable: closing.available,
    closingSavings: closing.savings,
  }
}

export function validateGoalAllocations(goals, savingsBalance) {
  const allocated = goals.reduce((sum, goal) => sum + BigInt(goal.allocatedMinor || '0'), 0n)
  if (allocated > BigInt(savingsBalance)) throw new Error('Goal allocations cannot exceed the available savings balance.')
  return { allocated, unallocated: BigInt(savingsBalance) - allocated }
}

export function requireNonnegativeBalance(balanceMinor, label = 'Account') {
  if (BigInt(balanceMinor) < 0n) throw new Error(`${label} balance cannot be negative.`)
  if (BigInt(balanceMinor) > MAX_MINOR) throw new Error(`${label} balance is above the supported limit.`)
}
