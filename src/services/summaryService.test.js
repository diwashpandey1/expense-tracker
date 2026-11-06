import { describe, expect, it } from 'vitest'
import { calculateSummary, getGoalProgress, summarizeByCategory, summarizeByKind } from './summaryService'

describe('finance summaries', () => {
  const rows = [
    { kind: 'income', amountMinor: '10000' },
    { kind: 'expense', amountMinor: '2500', categoryId: 'food', categoryName: 'Food' },
    { kind: 'savings_contribution', amountMinor: '3000', goalId: 'trip' },
    { kind: 'savings_withdrawal', amountMinor: '500', goalId: 'trip' },
  ]

  it('separates cash income, expenses, and held savings', () => {
    expect(calculateSummary(rows)).toMatchObject({ income: 10000n, expenses: 2500n, savings: 2500n, available: 5000n, balance: 7500n })
  })

  it('aggregates expense categories and savings goal progress', () => {
    expect(summarizeByCategory(rows)).toEqual([{ name: 'Food', amount: 2500n }])
    expect(summarizeByKind(rows, 'income')).toEqual([{ name: 'Other', amount: 10000n }])
    expect(summarizeByKind(rows, 'savings')).toEqual([{ name: 'Savings', amount: 2500n }])
    expect(getGoalProgress({ id: 'trip', targetMinor: '10000' }, rows)).toMatchObject({ allocated: 2500n, remaining: 7500n, percent: 25 })
  })
})
