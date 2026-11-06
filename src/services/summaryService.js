import { listAllTransactions } from './transactionService'

export function calculateSummary(transactions) {
  let income = 0n
  let expenses = 0n
  let contributions = 0n
  let withdrawals = 0n
  for (const item of transactions) {
    const amount = BigInt(item.amountMinor || '0')
    if (item.kind === 'income') income += amount
    else if (item.kind === 'expense') expenses += amount
    else if (item.kind === 'savings_contribution') contributions += amount
    else if (item.kind === 'savings_withdrawal') withdrawals += amount
  }
  const savings = contributions - withdrawals
  return {
    income,
    expenses,
    contributions,
    withdrawals,
    savings,
    available: income - expenses - contributions + withdrawals,
    balance: income - expenses,
  }
}

export function summarizeByCategory(transactions) {
  const totals = new Map()
  for (const item of transactions) {
    if (item.kind !== 'expense') continue
    const key = item.categoryId || item.categoryName || 'other'
    const current = totals.get(key) ?? { name: item.categoryName || 'Other', amount: 0n }
    current.amount += BigInt(item.amountMinor)
    totals.set(key, current)
  }
  return [...totals.values()].sort((a, b) => a.amount > b.amount ? -1 : 1)
}

export function summarizeByKind(transactions, kind) {
  const totals = new Map()
  for (const item of transactions) {
    const matches = kind === 'savings' ? item.kind.startsWith('savings_') : item.kind === kind
    if (!matches) continue
    const key = item.categoryId || item.categoryName || (kind === 'savings' ? item.goalId || 'savings' : 'other')
    const current = totals.get(key) ?? { name: item.categoryName || (kind === 'savings' ? 'Savings' : 'Other'), amount: 0n }
    const amount = BigInt(item.amountMinor)
    current.amount += kind === 'savings' && item.kind === 'savings_withdrawal' ? -amount : amount
    totals.set(key, current)
  }
  return [...totals.values()].filter((item) => item.amount > 0n).sort((a, b) => a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0)
}

export function summarizeMonths(transactions, months) {
  const byMonth = new Map(months.map((month) => [month, { month, income: 0n, expenses: 0n }]))
  for (const item of transactions) {
    const month = item.occurredOn.slice(0, 7)
    const aggregate = byMonth.get(month)
    if (!aggregate) continue
    if (item.kind === 'income') aggregate.income += BigInt(item.amountMinor)
    if (item.kind === 'expense') aggregate.expenses += BigInt(item.amountMinor)
  }
  return [...byMonth.values()]
}

export function getGoalProgress(goal, transactions) {
  const allocated = transactions.reduce((total, item) => {
    if (item.goalId !== goal.id) return total
    const amount = BigInt(item.amountMinor)
    return total + (item.kind === 'savings_contribution' ? amount : item.kind === 'savings_withdrawal' ? -amount : 0n)
  }, 0n)
  const target = BigInt(goal.targetMinor)
  const safeAllocated = allocated > 0n ? allocated : 0n
  const percent = target > 0n ? Number((safeAllocated * 10000n) / target) / 100 : 0
  return { allocated: safeAllocated, remaining: target > safeAllocated ? target - safeAllocated : 0n, percent: Math.min(percent, 100) }
}

export async function loadAllTransactions(uid) {
  return listAllTransactions(uid)
}
