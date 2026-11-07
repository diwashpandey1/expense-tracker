import { SUPPORTED_CURRENCIES } from '../constants/currencies'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_KEY = 'avora.currency-rates.usd.v1'
const RATE_ENDPOINT = import.meta.env.VITE_CURRENCY_RATES_URL || '/api/currency-rates'

function validRateSnapshot(record) {
  if (record?.baseCurrency !== 'USD' || !record.rates || typeof record.rates !== 'object') return false
  return SUPPORTED_CURRENCIES.every((code) => Number.isFinite(Number(record.rates[code])) && Number(record.rates[code]) > 0)
}

function normalizeRateInfo(record, stale = false) {
  const syncedAt = Number(record.syncedAt) || 0
  const expiresAt = Number(record.expiresAt) || syncedAt + WEEK_MS
  return {
    baseCurrency: 'USD',
    rates: record.rates,
    rateDate: record.rateDate || '',
    syncedAt,
    expiresAt,
    nextSyncAt: expiresAt,
    stale: stale || Date.now() >= expiresAt,
  }
}

function readLocalSnapshot() {
  try {
    const record = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return validRateSnapshot(record) ? normalizeRateInfo(record) : null
  } catch {
    return null
  }
}

export async function readCurrencyRates() {
  const previous = readLocalSnapshot()
  try {
    const response = await fetch(RATE_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result?.error || `Shared exchange rates are unavailable (${response.status}).`)
    if (!validRateSnapshot(result)) throw new Error('The shared exchange-rate snapshot is incomplete or invalid.')
    const info = normalizeRateInfo(result)
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(info)) } catch { /* The live snapshot still works without browser storage. */ }
    return info
  } catch (error) {
    if (previous) return { ...previous, stale: Date.now() >= previous.expiresAt, refreshError: error.message || 'The shared rate service is unavailable.' }
    throw error
  }
}
