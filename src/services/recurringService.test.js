import { describe, expect, it } from 'vitest'
import { nextScheduledDate, recurringOccurrenceId } from './recurringService'

describe('recurring schedule calendar arithmetic', () => {
  it('clamps month-end dates instead of skipping February', () => {
    expect(nextScheduledDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextScheduledDate('2024-01-31', 'monthly')).toBe('2024-02-29')
  })

  it('handles yearly leap days and custom intervals', () => {
    expect(nextScheduledDate('2024-02-29', 'yearly')).toBe('2025-02-28')
    expect(nextScheduledDate('2026-11-06', 'custom', 10)).toBe('2026-11-16')
  })

  it('uses a stable occurrence key for idempotent due processing', () => {
    expect(recurringOccurrenceId('rent-42', '2026-11-06')).toBe(recurringOccurrenceId('rent-42', '2026-11-06'))
  })
})
