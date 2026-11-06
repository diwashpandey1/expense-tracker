import { formatMoney } from '../lib/money'

const monthOf = (date) => String(date || '').slice(0, 7)

export function monthlyIncomeMinor(transactions, month) {
  return transactions.reduce((total, row) => row.kind === 'income' && monthOf(row.occurredOn) === month
    ? total + BigInt(row.amountMinor || '0') : total, 0n)
}

export function availableMonthlyIncomeMinor(transactions, month, excludeId) {
  const remaining = transactions.reduce((total, row) => {
    if (row.id === excludeId || monthOf(row.occurredOn) !== month) return total
    const amount = BigInt(row.amountMinor || '0')
    if (row.kind === 'income') return total + amount
    if (row.kind === 'expense' || row.kind === 'savings_contribution') return total - amount
    if (row.kind === 'savings_withdrawal') return total + amount
    return total
  }, 0n)
  return remaining > 0n ? remaining : 0n
}

export function assertTransactionWithinMonthlyIncome(transactions, candidate, excludeId, currencyCode) {
  if (candidate.kind !== 'expense' && candidate.kind !== 'savings_contribution') return
  const month = monthOf(candidate.occurredOn)
  const available = availableMonthlyIncomeMinor(transactions, month, excludeId)
  const amount = BigInt(candidate.amountMinor)
  if (amount > available) {
    const action = candidate.kind === 'expense' ? 'spend' : 'save'
    throw new Error(`You can’t ${action} more than this month’s available income. Remaining: ${formatMoney(available, currencyCode)}.`)
  }
}

export function transactionsAfterChange(transactions, month, candidate, excludeId) {
  const retained = transactions.filter((row) => row.id !== excludeId && monthOf(row.occurredOn) === month)
  if (candidate && monthOf(candidate.occurredOn) === month) retained.push({ ...candidate, id: excludeId || '__new_transaction__' })
  return retained
}

export function assertMonthlyOutflowsWithinIncome(transactions, month, currencyCode) {
  const income = monthlyIncomeMinor(transactions, month)
  const outflows = transactions.reduce((total, row) => {
    if (monthOf(row.occurredOn) !== month) return total
    const amount = BigInt(row.amountMinor || '0')
    if (row.kind === 'expense' || row.kind === 'savings_contribution') return total + amount
    if (row.kind === 'savings_withdrawal') return total - amount
    return total
  }, 0n)
  if (outflows > income) {
    throw new Error(`This change would leave ${month} expenses and savings (${formatMoney(outflows, currencyCode)}) above recorded income (${formatMoney(income, currencyCode)}). Reduce or move transactions before lowering or removing income.`)
  }
  return { income, outflows, available: income - outflows }
}

