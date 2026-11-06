import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { DEFAULT_PREFERENCES, normalizePreferences, readPreferences, savePreferences } from '../services/preferencesService'
import { currencyRateIsDue, readCurrencyRates, syncCurrencyRates } from '../services/currencyRateService'
import { listAccounts } from '../services/ledgerService'

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const { user, profile, updateAccountProfile } = useAuth()
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(0)
  const [systemDark, setSystemDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  const [currencyRateInfo, setCurrencyRateInfo] = useState(null)
  const [currencyRateLoading, setCurrencyRateLoading] = useState(false)
  const [currencyRateError, setCurrencyRateError] = useState('')
  const [accountCurrency, setAccountCurrency] = useState('')
  const userId = user?.uid
  const profileReady = Boolean(profile)
  const profileName = profile?.displayName || ''
  const profileCurrency = profile?.currencyCode || 'USD'
  const baseCurrency = accountCurrency || profileCurrency

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    let active = true
    if (!userId) {
      setPreferences(normalizePreferences({}, profileCurrency))
      setAccountCurrency('')
      setLoading(false)
      setError('')
      return undefined
    }
    if (!profileReady) { setLoading(true); return undefined }
    setLoading(true)
    listAccounts(userId).then(async (accounts) => {
      const accountCurrencies = [...new Set(accounts.filter((account) => account.status === 'active').map((account) => account.currencyCode).filter(Boolean))]
      const detectedBaseCurrency = accountCurrencies.length === 1 ? accountCurrencies[0] : profileCurrency
      const loaded = await readPreferences(userId, detectedBaseCurrency, profileCurrency)
      if (!active) return
      setAccountCurrency(detectedBaseCurrency === profileCurrency ? '' : detectedBaseCurrency)
      setPreferences(loaded)
      setError('')
      if (detectedBaseCurrency !== profileCurrency) {
        await updateAccountProfile({ displayName: profileName, currencyCode: detectedBaseCurrency })
      }
    })
      .catch((caught) => { if (active) { setPreferences(normalizePreferences({}, profileCurrency)); setError(caught.message || 'Could not load preferences.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, profileCurrency, profileReady, profileName, updateAccountProfile])

  useEffect(() => {
    let active = true
    if (!userId || loading || !profile?.currencyCode) {
      if (!userId) { setCurrencyRateInfo(null); setCurrencyRateError(''); setCurrencyRateLoading(false) }
      return undefined
    }
    setCurrencyRateInfo((current) => current?.baseCurrency === baseCurrency ? current : null)
    setCurrencyRateLoading(true)
    setCurrencyRateError('')
    syncCurrencyRates(userId, baseCurrency)
      .then((info) => { if (active) setCurrencyRateInfo(info) })
      .catch(async (caught) => {
        if (!active) return
        setCurrencyRateError(caught.message || 'Could not update exchange rates.')
        try {
          const cached = await readCurrencyRates(userId, baseCurrency)
          if (active && cached?.rates) {
            const syncedAt = cached.syncedAt?.toMillis?.() || 0
            setCurrencyRateInfo({ baseCurrency, rates: cached.rates, rateDate: cached.rateDate || '', syncedAt, nextSyncAt: syncedAt + 7 * 24 * 60 * 60 * 1000, stale: currencyRateIsDue({ nextSyncAt: syncedAt + 7 * 24 * 60 * 60 * 1000 }) })
          }
        } catch { /* The selected display currency remains saved; source amounts stay available. */ }
      })
      .finally(() => { if (active) setCurrencyRateLoading(false) })
    return () => { active = false }
  }, [userId, baseCurrency, loading, profile?.currencyCode])

  useEffect(() => {
    const root = document.documentElement
    const effectiveTheme = preferences.appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : preferences.appearance.theme
    root.dataset.theme = effectiveTheme
    root.dataset.accent = preferences.appearance.accent
    root.dataset.density = preferences.appearance.density
    root.dataset.fontSize = preferences.appearance.fontSize
    root.dataset.animations = preferences.appearance.animations ? 'on' : 'off'
    root.dataset.hideBalances = preferences.privacy.hideBalances ? 'true' : 'false'
    root.dataset.hideDashboardAmounts = preferences.dashboard.hideAmounts ? 'true' : 'false'
    root.dataset.dateFormat = preferences.transactions.dateFormat
    const requestedCurrency = preferences.currency.displayCurrency || baseCurrency
    const rate = baseCurrency === requestedCurrency ? 1 : currencyRateInfo?.baseCurrency === baseCurrency ? Number(currencyRateInfo?.rates?.[requestedCurrency]) : NaN
    const conversionAvailable = Number.isFinite(rate) && rate > 0
    root.dataset.sourceCurrency = baseCurrency
    root.dataset.displayCurrency = conversionAvailable ? requestedCurrency : baseCurrency
    root.dataset.exchangeRate = conversionAvailable ? String(rate) : '1'
  }, [preferences, systemDark, baseCurrency, currencyRateInfo])

  const updatePreferences = useCallback(async (section, patch) => {
    if (!userId) throw new Error('Sign in to save preferences.')
    setError('')
    try {
      const updated = await savePreferences(userId, section, patch, baseCurrency)
      setPreferences(updated)
      setSavedAt(Date.now())
      return updated
    } catch (caught) {
      setError(caught.message || 'Could not save preferences.')
      throw caught
    }
  }, [userId, baseCurrency])

  const syncRatesNow = useCallback(async () => {
    if (!userId) throw new Error('Sign in to sync exchange rates.')
    setCurrencyRateLoading(true)
    setCurrencyRateError('')
    try {
      const info = await syncCurrencyRates(userId, baseCurrency)
      setCurrencyRateInfo(info)
      return info
    } catch (caught) {
      setCurrencyRateError(caught.message || 'Could not update exchange rates.')
      throw caught
    } finally { setCurrencyRateLoading(false) }
  }, [userId, baseCurrency])

  const resetPreferences = useCallback(() => {
    setPreferences(normalizePreferences({}, baseCurrency))
    setError('')
    setSavedAt(Date.now())
  }, [baseCurrency])

  const value = useMemo(() => ({ preferences, loading, error, savedAt, updatePreferences, resetPreferences, currencyRateInfo, currencyRateLoading, currencyRateError, syncRatesNow, displayCurrency: document.documentElement.dataset.displayCurrency || baseCurrency }), [preferences, loading, error, savedAt, updatePreferences, resetPreferences, currencyRateInfo, currencyRateLoading, currencyRateError, syncRatesNow, baseCurrency])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider.')
  return context
}
