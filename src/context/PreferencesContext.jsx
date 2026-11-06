import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { DEFAULT_PREFERENCES, normalizePreferences, readPreferences, savePreferences } from '../services/preferencesService'

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(0)
  const [systemDark, setSystemDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  const userId = user?.uid

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    let active = true
    if (!userId) {
      setPreferences(normalizePreferences())
      setLoading(false)
      setError('')
      return undefined
    }
    setLoading(true)
    readPreferences(userId).then((loaded) => { if (active) { setPreferences(loaded); setError('') } })
      .catch((caught) => { if (active) { setPreferences(normalizePreferences()); setError(caught.message || 'Could not load preferences.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId])

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
  }, [preferences, systemDark])

  const updatePreferences = useCallback(async (section, patch) => {
    if (!userId) throw new Error('Sign in to save preferences.')
    setError('')
    try {
      const updated = await savePreferences(userId, section, patch)
      setPreferences(updated)
      setSavedAt(Date.now())
      return updated
    } catch (caught) {
      setError(caught.message || 'Could not save preferences.')
      throw caught
    }
  }, [userId])

  const resetPreferences = useCallback(() => {
    setPreferences(normalizePreferences())
    setError('')
    setSavedAt(Date.now())
  }, [])

  const value = useMemo(() => ({ preferences, loading, error, savedAt, updatePreferences, resetPreferences }), [preferences, loading, error, savedAt, updatePreferences, resetPreferences])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider.')
  return context
}
