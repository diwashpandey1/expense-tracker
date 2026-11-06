import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CircleDollarSign, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Field, InlineError } from '../components/ui'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch {
      setError('We could not send a reset email. Check the address and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] p-5">
    <section className="w-full max-w-md rounded-3xl border border-[#e7ebe4] bg-white p-7 shadow-xl sm:p-9">
      <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#55715d]"><ArrowLeft size={16} />Back to sign in</Link>
      <span className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-[#edf4e7] text-[#47704c]"><CircleDollarSign /></span>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#75877b]">Account recovery</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-[#1d3327]">Reset your password</h1>
      {sent ? <div className="mt-6 rounded-2xl bg-[#f1f7ed] p-5"><CheckCircle2 className="text-[#4b7c4d]" /><p className="mt-3 text-sm font-semibold text-[#344e38]">Check your inbox</p><p className="mt-1 text-sm leading-6 text-[#738176]">If an account uses {email}, Firebase sent a password reset link.</p></div> : <form onSubmit={submit} className="mt-6 space-y-5"><Field label="Email address" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><InlineError>{error}</InlineError><Button className="w-full" type="submit" disabled={busy}>{busy ? 'Sending…' : <><Mail size={16} />Send reset link</>}</Button></form>}
    </section>
  </main>
}
