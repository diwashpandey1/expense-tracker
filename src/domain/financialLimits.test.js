import { describe, expect, it } from 'vitest'
import {
  assertMonthlyOutflowsWithinIncome,
  assertTransactionWithinMonthlyIncome,
  availableMonthlyIncomeMinor,
} from './financialLimits'

const month = '2026-11'
const transactions = [
  { id: 'pay', kind: 'income', amountMinor: '100000', occurredOn: '2026-11-01' },
  { id: 'rent', kind: 'expense', amountMinor: '40000', occurredOn: '2026-11-02' },
  { id: 'save', kind: 'savings_contribution', amountMinor: '10000', occurredOn: '2026-11-03' },
  { id: 'withdraw', kind: 'savings_withdrawal', amountMinor: '5000', occurredOn: '2026-11-04' },
]

describe('monthly income boundaries', () => {
  it('limits expenses and savings contributions to remaining monthly income', () => {
    expect(availableMonthlyIncomeMinor(transactions, month)).toBe(55000n)
    expect(() => assertTransactionWithinMonthlyIncome(transactions, {
      kind: 'expense', amountMinor: '55001', occurredOn: '2026-11-10',
    }, null, 'USD')).toThrow(/remaining/i)
    expect(() => assertTransactionWithinMonthlyIncome(transactions, {
      kind: 'savings_contribution', amountMinor: '55001', occurredOn: '2026-11-10',
    }, null, 'USD')).toThrow(/remaining/i)
    expect(() => assertTransactionWithinMonthlyIncome(transactions, {
      kind: 'expense', amountMinor: '55000', occurredOn: '2026-11-10',
    }, null, 'USD')).not.toThrow()
  })

  it('excludes the edited transaction when calculating available income', () => {
    expect(availableMonthlyIncomeMinor(transactions, month, 'rent')).toBe(95000n)
  })

  it('blocks income edits or deletion that would leave existing monthly outflows over income', () => {
    const projected = transactions.filter((row) => row.id !== 'pay')
    expect(() => assertMonthlyOutflowsWithinIncome(projected, month, 'USD')).toThrow(/expenses and savings.*above recorded income/i)
    expect(() => assertMonthlyOutflowsWithinIncome(transactions, month, 'USD')).not.toThrow()
  })

  it('keeps budgets separate from transaction income and outflow calculations', () => {
    const budget = { month, categoryId: null, amountMinor: '250000' }
    expect(BigInt(budget.amountMinor)).toBeGreaterThan(availableMonthlyIncomeMinor(transactions, month))
    expect(() => assertMonthlyOutflowsWithinIncome(transactions, month, 'USD')).not.toThrow()
  })
})
