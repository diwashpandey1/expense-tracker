import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseReady } from '../lib/firebase'
import { createAccount, deleteAccount as removeAccount, ensureProfile, loginAccount, logoutAccount, readProfile, sendPasswordReset, signInWithGoogle as googleAccount, updateProfile as saveProfile } from '../services/authService'
import { completeOnboarding as completeFinancialOnboarding } from '../services/onboardingService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!firebaseReady || !auth) {
      return undefined
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        setProfileLoading(false)
        return
      }
      setProfile(null)
      setProfileLoading(true)
      try {
        const loaded = await readProfile(nextUser.uid)
        if (loaded && auth.currentUser?.uid === nextUser.uid) setProfile(loaded)
      } finally {
        if (auth.currentUser?.uid === nextUser.uid) {
          setProfileLoading(false)
          setLoading(false)
        }
      }
    })
  }, [])

  const register = useCallback(async (details) => {
    const createdUser = await createAccount(details)
    const loaded = await readProfile(createdUser.uid)
    setUser(createdUser)
    setProfile(loaded)
    return createdUser
  }, [])

  const login = useCallback(async (email, password) => {
    const signedInUser = await loginAccount(email, password)
    setUser(signedInUser)
    setProfile(await readProfile(signedInUser.uid))
    return signedInUser
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const signedInUser = await googleAccount()
    setUser(signedInUser)
    setProfile(await readProfile(signedInUser.uid))
    return signedInUser
  }, [])

  const finishProfileSetup = useCallback(async (currencyCode) => {
    if (!user) throw new Error('Sign in before setting up your profile.')
    const loaded = await ensureProfile(user, currencyCode)
    setProfile(loaded)
    return loaded
  }, [user])

  const finishOnboarding = useCallback(async (answers) => {
    if (!user) throw new Error('Sign in before completing setup.')
    await completeFinancialOnboarding(user.uid, answers, { displayName: answers.profile?.displayName })
    const loaded = await readProfile(user.uid)
    setProfile(loaded)
    return loaded
  }, [user])

  const logout = useCallback(async () => {
    await logoutAccount()
    setProfile(null)
  }, [])

  const resetPassword = useCallback((email) => sendPasswordReset(email), [])
  const updateAccountProfile = useCallback(async (changes) => {
    const loaded = await saveProfile(user, changes)
    setProfile(loaded)
    return loaded
  }, [user])
  const deleteAccount = useCallback((password) => removeAccount(user, password), [user])
  const value = useMemo(() => ({ user, profile, loading, profileLoading, register, login, signInWithGoogle, logout, resetPassword, finishProfileSetup, finishOnboarding, updateAccountProfile, deleteAccount }), [user, profile, loading, profileLoading, register, login, signInWithGoogle, logout, resetPassword, finishProfileSetup, finishOnboarding, updateAccountProfile, deleteAccount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
