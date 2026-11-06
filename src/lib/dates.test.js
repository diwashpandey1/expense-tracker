import { describe, expect, it } from 'vitest'
import { formatDateForDisplay, isCalendarDate, monthRange, weekRange } from './dates'

describe('calendar helpers', () => {
  it('validates actual calendar days', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2025-02-29')).toBe(false)
    expect(isCalendarDate('2025-13-01')).toBe(false)
  })

  it('handles leap-year month boundaries', () => {
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('formats saved calendar dates without rewriting them and honors week start', () => {
    document.documentElement.dataset.dateFormat = 'us'
    expect(formatDateForDisplay('2026-11-06')).toBe('11/06/2026')
    expect(weekRange('2026-11-06', 'sunday')).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    delete document.documentElement.dataset.dateFormat
  })
})
