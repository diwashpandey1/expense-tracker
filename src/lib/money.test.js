import { describe, expect, it } from 'vitest'
import { addMinorUnits, formatMoney, parseMoneyToMinor } from './money'

describe('money helpers', () => {
  it('converts decimal user input into exact minor units', () => {
    expect(parseMoneyToMinor('1234.50', 'USD')).toBe('123450')
    expect(parseMoneyToMinor('500', 'JPY')).toBe('500')
  })

  it('rejects malformed, over precise, and zero amounts', () => {
    expect(() => parseMoneyToMinor('0', 'USD')).toThrow()
    expect(() => parseMoneyToMinor('1.001', 'USD')).toThrow()
    expect(() => parseMoneyToMinor('1,000', 'USD')).toThrow()
  })

  it('formats large minor-unit values without floating point rounding', () => {
    expect(formatMoney('9007199254740993', 'USD', 'en-US')).toContain('90,071,992,547,409.93')
  })

  it('masks formatted balances when privacy hiding is enabled', () => {
    document.documentElement.dataset.hideBalances = 'true'
    expect(formatMoney('12345', 'USD')).toBe('••••')
    delete document.documentElement.dataset.hideBalances
  })

  it('adds minor units with BigInt precision', () => {
    expect(addMinorUnits('9007199254740993', '7')).toBe(9007199254741000n)
  })
})
