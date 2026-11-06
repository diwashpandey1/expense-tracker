import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleDollarSign, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Field, InlineError } from '../components/ui'
import GoogleSignInButton from '../components/GoogleSignInButton'

export default function LoginPage() {
  const { user, login, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/app" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function googleLogin() {
    setError('')
    setBusy(true)
    try { await signInWithGoogle(); navigate('/app') }
    catch (err) { setError(authMessage(err)) }
    finally { setBusy(false) }
  }

  return <div className="grid min-h-screen bg-[#f5f6f2] lg:grid-cols-[1.02fr_.98fr]">
    <aside className="relative hidden overflow-hidden bg-[#173f31] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full border border-white/10" />
      <div className="absolute -right-8 -top-8 h-[290px] w-[290px] rounded-full border border-white/10" />
      <Link to="/login" className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c5e96c] text-[#173f31]"><CircleDollarSign /></span><span className="font-serif text-xl font-semibold">Pennywise</span></Link>
      <div className="relative max-w-xl pb-10"><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#b5d78a]">Your money, in perspective</p><h1 className="font-serif text-5xl font-semibold leading-[1.1]">Make room for what matters.</h1><p className="mt-5 max-w-md text-base leading-7 text-[#c1d2c7]">A calmer way to follow your spending, plan ahead, and build the habits you want.</p><div className="mt-10 flex items-center gap-3 text-sm text-[#b5c9bc]"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><LockKeyhole size={16} /></span>Private to your account. Clear by design.</div></div>
      <p className="relative text-xs text-[#8fa898]">A little clarity goes a long way.</p>
    </aside>
    <main className="flex items-center justify-center px-5 py-10 sm:px-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173f31] text-[#c5e96c]"><CircleDollarSign size={22} /></span><span className="font-serif text-xl font-semibold">Pennywise</span></div>
        <p className="text-xs font-bold uppercase tracking-[.17em] text-[#75877b]">Welcome back</p><h2 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-[#1d3327]">Sign in to your account</h2><p className="mt-3 text-sm text-[#7d8981]">Pick up where you left off.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Email address" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#34463b]">Password</span><span className="relative block"><input className="w-full rounded-xl border border-[#dfe5dd] bg-white px-3.5 py-2.5 pr-11 text-sm outline-none focus:border-[#648d57] focus:ring-4 focus:ring-[#668d571a]" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-2 grid w-8 place-items-center text-[#839087]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          <div className="flex justify-end"><Link to="/reset-password" className="text-sm font-semibold text-[#4d7553] hover:underline">Forgot password?</Link></div>
          <InlineError>{error}</InlineError>
          <Button className="w-full py-3" type="submit" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-[#9aa39d]"><span className="h-px flex-1 bg-[#e4e9e2]"/>or continue with<span className="h-px flex-1 bg-[#e4e9e2]"/></div>
        <GoogleSignInButton onClick={googleLogin} disabled={busy} />
        <p className="mt-7 text-center text-sm text-[#7b8880]">New to Pennywise? <Link to="/signup" className="font-semibold text-[#47704c] hover:underline">Create an account</Link></p>
        <p className="mt-10 text-center text-xs leading-5 text-[#9aa39d]">Your finance data stays scoped to your Firebase account.</p>
      </section>
    </main>
  </div>
}

function authMessage(error) {
  const code = error?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is incorrect.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again in a little while.'
  if (error?.message?.includes('not configured')) return error.message
  if (code.includes('popup-closed-by-user')) return 'Google sign-in was closed before it finished.'
  if (code.includes('popup-blocked')) return 'Your browser blocked the Google sign-in window. Allow popups and try again.'
  if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled in your Firebase Authentication settings yet.'
  if (code.includes('account-exists-with-different-credential')) return 'This email already uses another sign-in method. Sign in with that method first.'
  return 'We could not sign you in. Check your connection and try again.'
}
