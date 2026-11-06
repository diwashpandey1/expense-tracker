import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferencesService'

describe('centralized user preferences', () => {
  it('provides defaults for an account without a preferences document', () => {
    const preferences = normalizePreferences()
    expect(preferences.appearance).toMatchObject({ theme: 'system', accent: 'lime', density: 'comfortable', fontSize: 'normal', animations: true })
    expect(preferences.dashboard.recentTransactionCount).toBe(5)
    expect(preferences.transactions).toMatchObject({ defaultType: 'expense', dateFormat: 'iso', sort: 'newest' })
    expect(preferences.budget.warningThreshold).toBe(80)
  })

  it('keeps stored values while replacing invalid or outdated choices with safe defaults', () => {
    const normalized = normalizePreferences({
      appearance: { theme: 'sepia', accent: 'unknown' },
      dashboard: { recentTransactionCount: 500 },
      transactions: { sort: 'random', weekStartsOn: 'saturday' },
      budget: { warningThreshold: 140 },
    })
    expect(normalized.appearance.theme).toBe(DEFAULT_PREFERENCES.appearance.theme)
    expect(normalized.appearance.accent).toBe(DEFAULT_PREFERENCES.appearance.accent)
    expect(normalized.dashboard.recentTransactionCount).toBe(5)
    expect(normalized.transactions.sort).toBe('newest')
    expect(normalized.transactions.weekStartsOn).toBe('monday')
    expect(normalizePreferences({ dashboard: { defaultPeriod: 'weekly' } }).dashboard.defaultPeriod).toBe('weekly')
    expect(normalizePreferences({ budget: { defaultPeriod: 'yearly' } }).budget.defaultPeriod).toBe('yearly')
    expect(normalized.budget.warningThreshold).toBe(99)
    expect(normalized.notifications).toEqual(DEFAULT_PREFERENCES.notifications)
  })
})
