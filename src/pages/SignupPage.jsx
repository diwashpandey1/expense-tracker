import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleDollarSign } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Field, InlineError, SelectField } from '../components/ui'
import GoogleSignInButton from '../components/GoogleSignInButton'

const currencies = [['USD','US Dollar'],['NPR','Nepalese Rupee'],['INR','Indian Rupee'],['EUR','Euro'],['GBP','British Pound'],['AUD','Australian Dollar'],['CAD','Canadian Dollar'],['JPY','Japanese Yen']]

export default function SignupPage() {
  const { user, register, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/app" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setBusy(true)
    try {
      await register({ displayName, email, password, currencyCode })
      navigate('/app')
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'An account already exists for this email.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Choose a stronger password.',
      }
      setError(messages[err?.code] || err.message || 'We could not create your account. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function googleSignup() {
    setError('')
    setBusy(true)
    try { await signInWithGoogle(); navigate('/app') }
    catch (err) {
      if (err?.code?.includes('operation-not-allowed')) setError('Google sign-in is not enabled in your Firebase Authentication settings yet.')
      else if (err?.code?.includes('popup-closed-by-user')) setError('Google sign-in was closed before it finished.')
      else if (err?.code?.includes('popup-blocked')) setError('Your browser blocked the Google sign-in window. Allow popups and try again.')
      else setError(err.message || 'We could not sign you in with Google. Try again.')
    } finally { setBusy(false) }
  }

  return <div className="grid min-h-screen bg-[#f5f6f2] lg:grid-cols-[.95fr_1.05fr]">
    <aside className="hidden bg-[#173f31] p-12 text-white lg:flex lg:flex-col lg:justify-between"><Link to="/login" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c5e96c] text-[#173f31]"><CircleDollarSign /></span><span className="font-serif text-xl font-semibold">Pennywise</span></Link><div className="max-w-lg pb-12"><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#b5d78a]">A fresh start</p><h1 className="font-serif text-5xl font-semibold leading-tight">Know where you are. Choose where you’re going.</h1><p className="mt-5 max-w-md text-base leading-7 text-[#c1d2c7]">Keep income, spending, and plans in one calm, private place.</p></div><p className="text-xs text-[#8fa898]">Personal finance, made clearer.</p></aside>
    <main className="flex items-center justify-center px-5 py-10 sm:px-10"><section className="w-full max-w-[440px]">
      <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173f31] text-[#c5e96c]"><CircleDollarSign size={22} /></span><span className="font-serif text-xl font-semibold">Pennywise</span></div>
      <p className="text-xs font-bold uppercase tracking-[.17em] text-[#75877b]">Get started</p><h2 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-[#1d3327]">Create your account</h2><p className="mt-3 text-sm text-[#7d8981]">Choose the currency you use for your finances.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Your name" autoComplete="name" required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Name" />
        <Field label="Email address" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <Field label="Password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
        <SelectField label="Account currency" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}>{currencies.map(([code,name]) => <option key={code} value={code}>{name} ({code})</option>)}</SelectField>
      <p className="-mt-1 text-xs leading-5 text-[#849087]">You can change the display currency later in Settings. Existing amounts are not converted.</p>
        <InlineError>{error}</InlineError>
        <Button type="submit" className="w-full py-3" disabled={busy}>{busy ? 'Creating account…' : <>Create account <ArrowRight size={16} /></>}</Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-[#9aa39d]"><span className="h-px flex-1 bg-[#e4e9e2]"/>or sign up with<span className="h-px flex-1 bg-[#e4e9e2]"/></div>
      <GoogleSignInButton onClick={googleSignup} disabled={busy} label="Sign up with Google" />
      <p className="mt-6 text-center text-sm text-[#7b8880]">Already have an account? <Link to="/login" className="font-semibold text-[#47704c] hover:underline">Sign in</Link></p>
      <p className="mt-8 text-center text-xs leading-5 text-[#9aa39d]">By creating an account, your finance data is stored in your new Firebase project and visible only to your account.</p>
    </section></main>
  </div>
}
