import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button, InlineError, SelectField } from '../components/ui'

const currencies = ['USD','NPR','INR','EUR','GBP','AUD','CAD','JPY']

export default function ProfileSetupPage() {
  const { finishProfileSetup, profileLoading } = useAuth()
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await finishProfileSetup(currencyCode)
    } catch (err) {
      setError(err.message || 'Profile setup failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (profileLoading) return <main className="grid min-h-screen place-items-center text-sm text-[#76847a]">Loading your profile…</main>
  return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] p-5"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#e7ebe4] bg-white p-7 shadow-xl sm:p-9">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#75877b]">One last step</p><h1 className="mt-2 font-serif text-3xl font-semibold text-[#1d3327]">Set your account currency</h1><p className="mt-3 text-sm leading-6 text-[#7d8981]">Choose the currency for all your finance records. It cannot be changed later in v1.</p>
    <div className="mt-6"><SelectField label="Account currency" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}>{currencies.map((code) => <option key={code} value={code}>{code}</option>)}</SelectField></div>
    <InlineError>{error}</InlineError><Button disabled={busy} className="mt-5 w-full" type="submit">{busy ? 'Saving…' : 'Continue to my dashboard'}</Button>
  </form></main>
}
