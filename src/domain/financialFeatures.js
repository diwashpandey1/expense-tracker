import { currentMonth, localDateString, monthRange } from '../lib/dates'

export function amountForCategory(transaction, categoryId) {
  if (transaction.kind !== 'expense') return 0n
  if (!categoryId) return BigInt(transaction.amountMinor || '0')
  const split = transaction.categorySplits?.find((line) => line.categoryId === categoryId)
  if (split) return BigInt(split.amountMinor)
  return transaction.categoryId === categoryId ? BigInt(transaction.amountMinor || '0') : 0n
}

export function calculateSpendingInsights(transactions, now = new Date()) {
  const month = currentMonth(now)
  const [yearNumber, monthNumber] = month.split('-').map(Number)
  const previousDate = new Date(yearNumber, monthNumber - 2, 1)
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`
  const currentRange = monthRange(month)
  const previousRange = monthRange(previousMonth)
  const expenseTotal = (from, to) => transactions.reduce((sum, transaction) => transaction.kind === 'expense' && transaction.occurredOn >= from && transaction.occurredOn <= to ? sum + BigInt(transaction.amountMinor || '0') : sum, 0n)
  const currentSpend = expenseTotal(currentRange.from, localDateString(now))
  const previousComparableDate = new Date(previousDate.getFullYear(), previousDate.getMonth(), Math.min(now.getDate(), new Date(previousDate.getFullYear(), previousDate.getMonth() + 1, 0).getDate()))
  const previousSpend = expenseTotal(previousRange.from, localDateString(previousComparableDate))
  const categoryTotals = new Map()
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || transaction.occurredOn < currentRange.from || transaction.occurredOn > localDateString(now)) continue
    const lines = transaction.categorySplits?.length ? transaction.categorySplits : [{ categoryId: transaction.categoryId || 'other', categoryName: transaction.categoryName || 'Other', amountMinor: transaction.amountMinor }]
    for (const line of lines) {
      const key = line.categoryId || line.categoryName || 'other'
      const current = categoryTotals.get(key) || { id: key, name: line.categoryName || 'Other', amount: 0n }
      current.amount += BigInt(line.amountMinor || '0')
      categoryTotals.set(key, current)
    }
  }
  const topCategories = [...categoryTotals.values()].sort((a, b) => a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0).slice(0, 3)
  const change = previousSpend > 0n ? Number((currentSpend - previousSpend) * 100n / previousSpend) : null
  return { month, currentSpend, previousSpend, changePercent: change, topCategories }
}

function shiftCalendarDate(value, frequency, intervalDays = 1) {
  const date = new Date(`${value}T00:00:00Z`)
  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + 1)
  else if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7)
  else if (frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1)
  else if (frequency === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + 1)
  else date.setUTCDate(date.getUTCDate() + Math.max(1, Number(intervalDays) || 1))
  return date.toISOString().slice(0, 10)
}

export function forecastRecurringCashFlow(accounts, schedules, { from, days = 30 } = {}) {
  const start = from || new Date().toISOString().slice(0, 10)
  const endDate = new Date(`${start}T00:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + days)
  const to = endDate.toISOString().slice(0, 10)
  const events = []
  for (const schedule of schedules) {
    if (schedule.status !== 'active' || !schedule.nextDueOn || schedule.nextDueOn > to || (schedule.endOn && schedule.endOn < start)) continue
    let dueOn = schedule.nextDueOn
    while (dueOn <= to && (!schedule.endOn || dueOn <= schedule.endOn)) {
      if (dueOn >= start) events.push({ dueOn, kind: schedule.kind, name: schedule.name, amountMinor: BigInt(schedule.amountMinor), accountId: schedule.accountId })
      const next = shiftCalendarDate(dueOn, schedule.frequency, schedule.intervalDays)
      if (next <= dueOn) break
      dueOn = next
    }
  }
  events.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  let balance = accounts.reduce((sum, account) => sum + BigInt(account.balanceMinor || 0), 0n)
  const openingBalance = balance
  let scheduledIncome = 0n
  let scheduledExpenses = 0n
  for (const event of events) {
    if (event.kind === 'income') { scheduledIncome += event.amountMinor; balance += event.amountMinor }
    else { scheduledExpenses += event.amountMinor; balance -= event.amountMinor }
    event.projectedBalanceMinor = balance
  }
  return { from: start, to, openingBalance, projectedBalance: balance, scheduledIncome, scheduledExpenses, events }
}
