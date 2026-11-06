import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { ArrowRight, Calculator, Coins, Percent, TrendingUp } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { Card, LoadingState, PageHeading } from '../components/ui'

const SimpleInterestPage = lazy(() => import('./tools/SimpleInterestPage'))
const SipCalculatorPage = lazy(() => import('./tools/SipCalculatorPage'))
const CurrencyConverterPage = lazy(() => import('./tools/CurrencyConverterPage'))

const tools = [
  { path: 'interest-calculator', title: 'Simple interest calculator', text: 'Estimate interest earned or paid on a principal over time.', icon: Percent },
  { path: 'sip-calculator', title: 'SIP calculator', text: 'Explore a monthly investment projection with compounding.', icon: TrendingUp },
  { path: 'currency-exchange', title: 'Currency exchange', text: 'Convert an amount using the latest available daily reference rate.', icon: Coins },
]

function ToolsIndex() {
  return <PublicLayout><main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16"><PageHeading eyebrow="Useful money helpers" title="Financial tools" description="Try simple calculators for interest, investing projections, and exchange rates."/><div className="grid gap-4 md:grid-cols-3">{tools.map(({ path, title, text, icon: Icon }) => <Link key={path} to={`/tools/${path}`} className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef4e8] text-[#60804d]"><Icon size={20}/></span><h2 className="mt-5 font-serif text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#78857c]">{text}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#4b7653]">Open tool <ArrowRight size={15}/></span></Card></Link>)}</div><p className="mt-8 text-xs leading-5 text-[#89958c]">Calculations are educational estimates only. Exchange rates are indicative reference rates, not live trading quotes.</p></main></PublicLayout>
}

export default function ToolsPage() {
  return <Suspense fallback={<LoadingState label="Opening financial tool"/>}><Routes><Route index element={<ToolsIndex/>}/><Route path="interest-calculator" element={<SimpleInterestPage/>}/><Route path="sip-calculator" element={<SipCalculatorPage/>}/><Route path="currency-exchange" element={<CurrencyConverterPage/>}/><Route path="interestCalculator" element={<Navigate to="/tools/interest-calculator" replace/>}/><Route path="SIPCalculator" element={<Navigate to="/tools/sip-calculator" replace/>}/><Route path="CurrencyExchange" element={<Navigate to="/tools/currency-exchange" replace/>}/><Route path="*" element={<ToolsIndex/>}/></Routes></Suspense>
}

export function ToolShell({ eyebrow = 'Financial tool', title, description, children }) {
  return <PublicLayout><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"><Link to="/tools" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5c765e] hover:underline"><Calculator size={15}/> All tools</Link><PageHeading eyebrow={eyebrow} title={title} description={description}/>{children}</main></PublicLayout>
}

export function ToolResult({ label, value, hint }) { return <div className="rounded-xl bg-[#f3f6f0] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#829087]">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-[#294033]">{value}</p>{hint && <p className="mt-1 text-xs text-[#89958c]">{hint}</p>}</div> }
