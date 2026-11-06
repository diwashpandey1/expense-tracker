import { describe, expect, it } from 'vitest'
import { calculateFinancialPosition, requireNonnegativeBalance, summarizeLedgerPeriod, validateGoalAllocations } from './financialLedger'

describe('financial ledger invariants', () => {
  const accounts = [
    { id: 'wallet', classification: 'spending', openingBalanceMinor: '10000', status: 'active' },
    { id: 'bank', classification: 'savings', openingBalanceMinor: '20000', status: 'active' },
  ]

  it('keeps opening balances out of lifetime income and reconciles account classes', () => {
    const position = calculateFinancialPosition(accounts, [])
    expect(position.income).toBe(0n)
    expect(position.available).toBe(10000n)
    expect(position.savings).toBe(20000n)
    expect(position.total).toBe(position.available + position.savings)
  })

  it('counts transfers as neither income nor expense and preserves combined balance', () => {
    const event = { kind: 'transfer', amountMinor: '3000', postings: [{ accountId: 'wallet', deltaMinor: '3000' }, { accountId: 'bank', deltaMinor: '-3000' }] }
    const before = calculateFinancialPosition(accounts, [])
    const after = calculateFinancialPosition(accounts, [event])
    expect(after.total).toBe(before.total)
    expect(after.income).toBe(0n)
    expect(after.expenses).toBe(0n)
  })

  it('counts income and an expense exactly once', () => {
    const events = [
      { kind: 'income', amountMinor: '5000', postings: [{ accountId: 'wallet', deltaMinor: '5000' }] },
      { kind: 'expense', amountMinor: '2000', postings: [{ accountId: 'wallet', deltaMinor: '-2000' }] },
    ]
    const position = calculateFinancialPosition(accounts, events)
    expect(position.income).toBe(5000n)
    expect(position.expenses).toBe(2000n)
    expect(position.total).toBe(33000n)
  })

  it('recalculates balances from changed and voided historical ledger rows', () => {
    const original = { kind: 'expense', amountMinor: '2000', postings: [{ accountId: 'wallet', deltaMinor: '-2000' }] }
    const edited = { kind: 'expense', amountMinor: '3000', postings: [{ accountId: 'wallet', deltaMinor: '-3000' }] }
    expect(calculateFinancialPosition(accounts, [original]).total).toBe(28000n)
    expect(calculateFinancialPosition(accounts, [edited]).total).toBe(27000n)
    expect(calculateFinancialPosition(accounts, [{ ...edited, voided: true }]).total).toBe(30000n)
  })

  it('rejects negative balances and goal allocations above savings', () => {
    expect(() => requireNonnegativeBalance(-1n)).toThrow(/negative/i)
    expect(() => validateGoalAllocations([{ allocatedMinor: '21000' }], 20000n)).toThrow(/exceed/i)
    expect(validateGoalAllocations([{ allocatedMinor: '15000' }], 20000n).unallocated).toBe(5000n)
  })

  it('carries prior balances into the selected period closing balance', () => {
    const entries = [
      { kind: 'income', amountMinor: '5000', occurredOn: '2026-10-20', postings: [{ accountId: 'wallet', deltaMinor: '5000' }] },
      { kind: 'expense', amountMinor: '1000', occurredOn: '2026-11-04', postings: [{ accountId: 'wallet', deltaMinor: '-1000' }] },
    ]
    const txRows = entries.map((entry) => ({ ...entry }))
    const period = summarizeLedgerPeriod(accounts, entries, txRows, '2026-11-01', '2026-11-30')
    expect(period.openingBalance).toBe(35000n)
    expect(period.income).toBe(0n)
    expect(period.expenses).toBe(1000n)
    expect(period.closingBalance).toBe(34000n)
  })
})
