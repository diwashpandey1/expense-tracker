import { BarChart3, HeartHandshake, LockKeyhole, Target } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'

const values = [
  { icon: BarChart3, title: 'Clear over complicated', text: 'Useful summaries, categories, and budgets help you make sense of day-to-day money.' },
  { icon: Target, title: 'Plans that stay connected', text: 'Savings goals reflect contributions and withdrawals recorded in your tracker.' },
  { icon: LockKeyhole, title: 'Private by account', text: 'Sign in with Firebase and keep your finance records scoped to your account.' },
]

export default function AboutPage() {
  return <PublicLayout><main><section className="bg-[#2b5941] px-5 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#c5e96c]"><HeartHandshake size={15}/> About AVORA</p><h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">Money feels easier when the picture is clear.</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-[#c1d2c7] sm:text-base">AVORA is a personal finance tracker built around a simple idea: a little clarity can help you make choices with more confidence.</p></div></section><section className="mx-auto max-w-7xl px-5 py-14 sm:px-8"><div className="grid gap-4 md:grid-cols-3">{values.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-[#e7ebe4] bg-white p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef4e8] text-[#60804d]"><Icon size={20}/></span><h2 className="mt-5 font-serif text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#78857c]">{text}</p></article>)}</div><div className="mt-10 max-w-3xl"><h2 className="font-serif text-2xl font-semibold">Built for steady habits</h2><p className="mt-3 text-sm leading-7 text-[#748078]">Track income and spending manually, set monthly limits, and turn savings plans into goals. AVORA does not connect to banks or move money. Its charts are a view of the records you choose to enter.</p></div></section></main></PublicLayout>
}
