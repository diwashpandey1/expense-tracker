import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'

describe('legacy default categories', () => {
  it('retains all original names grouped by expense, income, and saving', () => {
    const byKind = Object.groupBy(DEFAULT_CATEGORIES, (item) => item.kind)
    expect(byKind.expense.map((item) => item.name)).toEqual([
      'Housing', 'Childcare', 'Transportation', 'Utilities', 'Food/Supplies', 'Pets',
      'Entertainment', 'Healthcare', 'Insurance', 'Personal Care', 'Debt', 'Gifts',
      'Donations', 'Clothing', 'Education', 'Subscriptions', 'Miscellaneous', 'Taxes',
    ])
    expect(byKind.income.map((item) => item.name)).toEqual([
      'Salary', 'House Property', 'Profits and Gains', 'Capital Gain', 'Gifts',
      'Investments', 'Side Hustles', 'Government Benefits',
    ])
    expect(byKind.saving.map((item) => item.name)).toEqual([
      'Retirement Funds', 'Emergency Funds', 'College Funds', 'Travel Funds',
      'Sinking Funds', 'Common Savings', 'Medical Funds', 'Child Savings', 'Large Purchases',
    ])
  })
})
