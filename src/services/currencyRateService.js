import { collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { SUPPORTED_CURRENCIES } from '../constants/currencies'
import { requireDb } from '../lib/firebase'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const rateDocument = (uid, baseCurrency) => doc(collection(requireDb(), 'users', uid, 'currencyRates'), baseCurrency)

function savedAtMillis(timestamp) {
  return timestamp?.toMillis?.() || 0
}

function cacheIsFresh(record) {
  return savedAtMillis(record?.syncedAt) > 0 && Date.now() - savedAtMillis(record.syncedAt) < WEEK_MS
}

function usableRates(record, baseCurrency) {
  if (record?.baseCurrency !== baseCurrency || !record.rates || typeof record.rates !== 'object') return false
  return SUPPORTED_CURRENCIES.every((code) => Number.isFinite(Number(record.rates[code])) && Number(record.rates[code]) > 0)
}

function toRateInfo(record, refreshed = false) {
  const syncedAt = savedAtMillis(record.syncedAt)
  return {
    baseCurrency: record.baseCurrency,
    rates: record.rates,
    rateDate: record.rateDate || '',
    syncedAt,
    nextSyncAt: syncedAt + WEEK_MS,
    refreshed,
  }
}

async function requestRates(baseCurrency) {
  const apiKey = import.meta.env.VITE_CURRENCY_API_KEY
  if (!apiKey) throw new Error('Currency API is not configured. Add VITE_CURRENCY_API_KEY to your local environment.')
  const targets = SUPPORTED_CURRENCIES.filter((code) => code !== baseCurrency)
  const url = new URL('https://api.currencyapi.com/v3/latest')
  url.searchParams.set('base_currency', baseCurrency)
  url.searchParams.set('currencies', targets.join(','))
  const response = await fetch(url, { headers: { apikey: apiKey } })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.message || result?.error?.message || `Currency API request failed (${response.status}).`)
  const rates = { [baseCurrency]: 1 }
  for (const code of targets) {
    const value = Number(result.data?.[code]?.value ?? result.data?.[code])
    if (!Number.isFinite(value) || value <= 0) throw new Error(`The currency API did not return a valid ${baseCurrency} to ${code} rate.`)
    rates[code] = value
  }
  return { rates, rateDate: result.meta?.last_updated_at || new Date().toISOString() }
}

export async function readCurrencyRates(uid, baseCurrency) {
  const snapshot = await getDoc(rateDocument(uid, baseCurrency))
  return snapshot.exists() ? snapshot.data() : null
}

export async function syncCurrencyRates(uid, baseCurrency) {
  if (!SUPPORTED_CURRENCIES.includes(baseCurrency)) throw new Error('Choose a supported base currency.')
  const ref = rateDocument(uid, baseCurrency)
  const cached = await getDoc(ref)
  const existing = cached.exists() ? cached.data() : null
  if (usableRates(existing, baseCurrency) && cacheIsFresh(existing)) return toRateInfo(existing)

  const { rates, rateDate } = await requestRates(baseCurrency)
  const didSync = await runTransaction(requireDb(), async (transaction) => {
    const latest = await transaction.get(ref)
    const latestRecord = latest.exists() ? latest.data() : null
    if (usableRates(latestRecord, baseCurrency) && cacheIsFresh(latestRecord)) return false
    transaction.set(ref, {
      baseCurrency,
      rates,
      rateDate,
      syncedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return true
  })
  const finalSnapshot = await getDoc(ref)
  if (!finalSnapshot.exists()) throw new Error('The exchange-rate cache could not be saved.')
  return toRateInfo(finalSnapshot.data(), didSync)
}

export function currencyRateIsDue(info) {
  return !info?.nextSyncAt || Date.now() >= info.nextSyncAt
}
