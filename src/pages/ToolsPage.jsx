import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import {
  ArrowRight, Banknote, Calculator, ChartNoAxesCombined, Coins, CreditCard,
  HandCoins, Landmark, PiggyBank, Percent, ReceiptText, ShieldPlus,
  TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { Card, LoadingState, PageHeading } from '../components/ui'

const SimpleInterestPage = lazy(() => import('./tools/SimpleInterestPage'))
const SipCalculatorPage = lazy(() => import('./tools/SipCalculatorPage'))
const CurrencyConverterPage = lazy(() => import('./tools/CurrencyConverterPage'))
const AdditionalCalculatorPage = lazy(() => import('./tools/AdditionalCalculatorPage'))

const tools = [
  { path: 'interest-calculator', title: 'Simple interest', text: 'Estimate interest earned or paid on a principal over time.', icon: Percent },
  { path: 'sip-calculator', title: 'SIP calculator', text: 'Explore regular monthly investing with an estimated compounding return.', icon: TrendingUp },
  { path: 'currency-exchange', title: 'Currency exchange', text: 'Convert an amount with indicative reference rates.', icon: Coins },
  { path: 'compound-interest', title: 'Compound interest', text: 'See how a starting amount may grow when returns compound over time.', icon: ChartNoAxesCombined },
  { path: 'loan-emi', title: 'Loan payment calculator', text: 'Estimate monthly payments, total interest, and total repayment.', icon: Landmark },
  { path: 'savings-goal', title: 'Savings goal planner', text: 'Find the monthly amount needed to reach a savings target.', icon: PiggyBank },
  { path: 'emergency-fund', title: 'Emergency fund planner', text: 'Set a reserve target based on essential monthly expenses.', icon: ShieldPlus },
  { path: 'budget-split', title: '50/30/20 budget planner', text: 'Split take-home income into needs, wants, and savings or debt.', icon: Wallet },
  { path: 'debt-payoff', title: 'Debt payoff planner', text: 'Estimate payoff time and interest from a fixed monthly payment.', icon: TrendingDown },
  { path: 'net-worth', title: 'Net worth calculator', text: 'Compare assets and liabilities for a simple financial snapshot.', icon: Banknote },
  { path: 'inflation', title: 'Inflation impact calculator', text: 'Estimate how much a future purchase may cost as prices rise.', icon: ReceiptText },
  { path: 'take-home', title: 'Take-home pay estimator', text: 'Estimate monthly and annual take-home pay from an assumed deduction rate.', icon: HandCoins },
  { path: 'loan-affordability', title: 'Loan affordability estimator', text: 'Estimate a payment limit and loan amount from income and debts.', icon: CreditCard },
]

function PageFrame({ embedded, children }) {
  return embedded ? children : <PublicLayout>{children}</PublicLayout>
}

function ToolsIndex({ basePath, embedded }) {
  const Content = embedded ? 'div' : 'main'
  return <PageFrame embedded={embedded}>
    <Content className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <PageHeading eyebrow="Plan with a little more clarity" title="Financial tools" description="Practical calculators for saving, borrowing, budgeting, and everyday money decisions." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map(({ path, title, text, icon: Icon }) => <Link key={path} to={`${basePath}/${path}`} className="group">
          <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef4e8] text-[#60804d]"><Icon size={20} /></span>
            <h2 className="mt-4 font-serif text-lg font-semibold text-[#23372b]">{title}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[#78857c]">{text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#4b7653]">Open tool <ArrowRight size={15} /></span>
          </Card>
        </Link>)}
      </div>
      <p className="mt-7 text-xs leading-5 text-[#89958c]">These tools provide estimates for planning and learning, not financial, tax, lending, or investment advice. Actual rates, fees, taxes, and lender terms can differ.</p>
    </Content>
  </PageFrame>
}

export default function ToolsPage({ basePath = '/tools', embedded = false }) {
  return <Suspense fallback={<LoadingState label="Opening financial tool" />}>
    <Routes>
      <Route index element={<ToolsIndex basePath={basePath} embedded={embedded} />} />
      <Route path="interest-calculator" element={<SimpleInterestPage basePath={basePath} embedded={embedded} />} />
      <Route path="sip-calculator" element={<SipCalculatorPage basePath={basePath} embedded={embedded} />} />
      <Route path="currency-exchange" element={<CurrencyConverterPage basePath={basePath} embedded={embedded} />} />
      {tools.slice(3).map(({ path }) => <Route key={path} path={path} element={<AdditionalCalculatorPage toolId={path} basePath={basePath} embedded={embedded} />} />)}
      <Route path="interestCalculator" element={<Navigate to={`${basePath}/interest-calculator`} replace />} />
      <Route path="SIPCalculator" element={<Navigate to={`${basePath}/sip-calculator`} replace />} />
      <Route path="CurrencyExchange" element={<Navigate to={`${basePath}/currency-exchange`} replace />} />
      <Route path="*" element={<ToolsIndex basePath={basePath} embedded={embedded} />} />
    </Routes>
  </Suspense>
}

export function ToolShell({ eyebrow = 'Financial tool', title, description, children, basePath = '/tools', embedded = false }) {
  const Content = embedded ? 'div' : 'main'
  return <PageFrame embedded={embedded}>
    <Content className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <Link to={basePath} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5c765e] hover:underline"><Calculator size={15} /> All tools</Link>
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      {children}
    </Content>
  </PageFrame>
}

export function ToolResult({ label, value, hint }) {
  return <div className="rounded-xl bg-[#f3f6f0] p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-[#829087]">{label}</p>
    <p className="mt-1 text-xl font-bold tabular-nums text-[#294033]">{value}</p>
    {hint && <p className="mt-1 text-xs text-[#89958c]">{hint}</p>}
  </div>
}
