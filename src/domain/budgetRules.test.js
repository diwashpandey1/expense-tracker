import { describe, expect, it } from 'vitest'
import { budgetUtilization } from './budgetRules'

describe('budget warning thresholds', () => {
  it('warns at 80%, marks 100%, and continues measuring overspending', () => {
    expect(budgetUtilization('8000', '10000')).toMatchObject({ percent: 80, status: 'warning', remainingMinor: 2000n })
    expect(budgetUtilization('10000', '10000')).toMatchObject({ percent: 100, status: 'exceeded', overMinor: 0n })
    expect(budgetUtilization('12500', '10000')).toMatchObject({ percent: 125, status: 'exceeded', overMinor: 2500n })
  })

  it('uses a configurable warning threshold without changing the exceeded boundary', () => {
    expect(budgetUtilization('7000', '10000', 70).status).toBe('warning')
    expect(budgetUtilization('9900', '10000', 70).status).toBe('warning')
    expect(budgetUtilization('10000', '10000', 70).status).toBe('exceeded')
  })
})
