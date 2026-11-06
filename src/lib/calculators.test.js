import { describe, expect, it } from 'vitest'
import { calculateSimpleInterest, calculateSipProjection } from './calculators'

describe('financial calculator formulas', () => {
  it('calculates simple interest', () => {
    expect(calculateSimpleInterest(1000, 5, 3)).toEqual({ principal: 1000, interest: 150, total: 1150 })
  })
  it('projects monthly contributions with zero and positive returns', () => {
    expect(calculateSipProjection(100, 0, 1)).toMatchObject({ invested: 1200, total: 1200, growth: 0, months: 12 })
    expect(calculateSipProjection(100, 12, 1).total).toBeGreaterThan(1200)
  })
  it('rejects invalid assumptions', () => {
    expect(() => calculateSimpleInterest(0, 5, 1)).toThrow()
    expect(() => calculateSipProjection(100, -1, 10)).toThrow()
    expect(() => calculateSipProjection(100, 5, 1.5)).toThrow()
  })
})
