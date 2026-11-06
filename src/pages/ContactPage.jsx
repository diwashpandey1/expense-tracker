import { useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { Button, Field, InlineError, PageHeading } from '../components/ui'

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || ''

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    if (!contactEmail) { setError('The support email is not configured yet. Add VITE_CONTACT_EMAIL to the project environment to enable contact messages.'); return }
    const subject = encodeURIComponent(`AVORA message from ${name.trim()}`)
    const body = encodeURIComponent(`From: ${name.trim()} <${email.trim()}>\n\n${message.trim()}`)
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`
  }
  return <PublicLayout><main><section className="bg-[#2b5941] px-5 py-14 text-white sm:px-8 sm:py-16"><div className="mx-auto max-w-7xl"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#c5e96c]"><MessageCircle size={15}/> Contact</p><h1 className="mt-4 font-serif text-4xl font-semibold sm:text-5xl">We’d like to hear from you.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#c1d2c7]">Questions, feedback, or a problem with your account? Send a note and we’ll help you find the right next step.</p></div></section><section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[.8fr_1.2fr]"><div><PageHeading eyebrow="Get in touch" title="Send a message" description="Your email app will open with a draft addressed to AVORA support."/><div className="rounded-2xl border border-[#e7ebe4] bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef4e8] text-[#60804d]"><Mail size={18}/></span><h2 className="mt-4 font-semibold">Account and product support</h2><p className="mt-2 text-sm leading-6 text-[#78857c]">For privacy, never include your password or full payment details in a message.</p></div></div><form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#e7ebe4] bg-white p-5 sm:p-7"><Field label="Your name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required/><Field label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required/><label className="block"><span className="mb-1.5 block text-sm font-medium text-[#34463b]">Message</span><textarea className="min-h-36 w-full rounded-xl border border-[#dfe5dd] bg-white px-3.5 py-2.5 text-sm text-[#24352b] outline-none focus:border-[#648d57] focus:ring-4 focus:ring-[#668d571a]" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={3000} required/></label>{error && <InlineError>{error}</InlineError>}{!contactEmail && <p className="text-xs leading-5 text-[#8b7951]">Contact delivery needs a support email configured through `VITE_CONTACT_EMAIL`.</p>}<Button type="submit"><Mail size={16}/>Open email draft</Button></form></section></main></PublicLayout>
}
