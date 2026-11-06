import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CirclePlus, PiggyBank, Wallet, TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney } from '../lib/money'
import { explainFirebaseError } from '../lib/firebaseErrors'
import { currentMonth, formatDateForDisplay, localDateString, monthLabel, monthRange, weekRange } from '../lib/dates'
import { listAllTransactions } from '../services/transactionService'
import { listBudgets } from '../services/budgetService'
import { listCategories } from '../services/categoryService'
import { listGoals } from '../services/goalService'
import { listAccounts, listLedgerEntries } from '../services/ledgerService'
import { listRecurringSchedules } from '../services/recurringService'
import { calculateSummary, summarizeByCategory, summarizeMonths } from '../services/summaryService'
import { amountForCategory, calculateSpendingInsights, forecastRecurringCashFlow } from '../domain/financialFeatures'
import { Card, EmptyState, LoadingState, PageHeading } from '../components/ui'

const COLORS = ['#2c7652', '#8bad5a', '#d4a64a', '#5387a1', '#a86d65', '#7868a1']

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { preferences } = usePreferences()
  const dashboardPrefs = preferences.dashboard
  const budgetPeriod = preferences.budget.defaultPeriod
  const [periodMode, setPeriodMode] = useState('monthly')
  const [periodModeTouched, setPeriodModeTouched] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [goals, setGoals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [ledger, setLedger] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const budgetPeriodValue = budgetPeriod === 'yearly' ? (periodMode === 'yearly' ? year : String(new Date().getFullYear())) : month

  useEffect(() => { if (!periodModeTouched) setPeriodMode(dashboardPrefs.defaultPeriod) }, [dashboardPrefs.defaultPeriod, periodModeTouched])

  useEffect(() => {
    let active = true
    Promise.all([listAllTransactions(user.uid), listBudgets(user.uid, budgetPeriodValue, budgetPeriod), listCategories(user.uid), listGoals(user.uid), listAccounts(user.uid), listLedgerEntries(user.uid), listRecurringSchedules(user.uid)])
      .then(([tx, budgetRows, categoryRows, goalRows, accountRows, ledgerRows, recurringRows]) => {
        if (!active) return
        setTransactions(tx)
        setBudgets(budgetRows)
        setCategories(categoryRows)
        setGoals(goalRows.filter((goal) => goal.status === 'active'))
        setAccounts(accountRows)
        setLedger(ledgerRows)
        setSchedules(recurringRows)
      })
      .catch((caught) => { if (active) setError(explainFirebaseError(caught, 'the dashboard')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.uid, budgetPeriodValue, budgetPeriod, reload])

  const range = periodMode === 'weekly' ? weekRange(localDateString(), preferences.transactions.weekStartsOn) : periodMode === 'yearly' ? { from: `${year}-01-01`, to: `${year}-12-31` } : periodMode === 'lifetime' ? { from: '0001-01-01', to: localDateString() } : monthRange(month)
  const periodTransactions = useMemo(() => transactions.filter((item) => item.occurredOn >= range.from && item.occurredOn <= range.to), [transactions, range.from, range.to])
  const budgetRange = budgetPeriod === 'yearly' ? { from: `${budgetPeriodValue}-01-01`, to: `${budgetPeriodValue}-12-31` } : monthRange(month)
  const budgetTransactions = useMemo(() => transactions.filter((item) => item.occurredOn >= budgetRange.from && item.occurredOn <= budgetRange.to), [transactions, budgetRange.from, budgetRange.to])
  const period = useMemo(() => calculateSummary(periodTransactions), [periodTransactions])
  const lifetime = useMemo(() => calculateSummary(transactions), [transactions])
  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories])
  const categoryTotals = useMemo(() => summarizeByCategory(periodTransactions).slice(0, 6), [periodTransactions])
  const monthKeys = useMemo(() => lastMonths(month, 6), [month])
  const trend = useMemo(() => summarizeMonths(transactions, monthKeys).map((row) => ({ month: row.month.slice(5), income: Number(row.income), expenses: Number(row.expenses) })), [transactions, monthKeys])
  const currency = profile.currencyCode
  const displayMoney = (value) => dashboardPrefs.hideAmounts ? '••••' : formatMoney(value, currency)
  const availableBalance = accounts.filter((account) => account.classification === 'spending').reduce((sum, account) => sum + BigInt(account.balanceMinor || 0), 0n)
  const savingsBalance = accounts.filter((account) => account.classification === 'savings').reduce((sum, account) => sum + BigInt(account.balanceMinor || 0), 0n)
  const totalBalance = availableBalance + savingsBalance
  const cashForecast = useMemo(() => forecastRecurringCashFlow(accounts, schedules, { from: localDateString(), days: 30 }), [accounts, schedules])
  const spendingInsights = useMemo(() => calculateSpendingInsights(transactions), [transactions])
  const savingsFlow = ledger.filter((event) => !event.voided && event.occurredOn >= range.from && event.occurredOn <= range.to && (event.kind === 'transfer' || event.operationKind === 'expense_with_savings_transfer')).reduce((result, event) => {
    for (const posting of event.postings || []) {
      const account = accounts.find((item) => item.id === posting.accountId)
      if (account?.classification !== 'savings') continue
      const delta = BigInt(posting.deltaMinor)
      if (delta > 0n) result.in += delta
      if (delta < 0n) result.out += -delta
    }
    return result
  }, { in: 0n, out: 0n })

  const budgetRows = budgets.map((budget) => {
    const spent = budgetTransactions.reduce((sum, item) => sum + amountForCategory(item, budget.categoryId), 0n)
    const target = BigInt(budget.amountMinor)
    const percent = target ? Number((spent * 100n) / target) : 0
    const warning = percent >= preferences.budget.warningThreshold
    const exceeded = percent >= 100
    const alertEnabled = exceeded ? preferences.notifications.overspending : preferences.notifications.budgetThreshold
    return { ...budget, spent, target, percent, warning: warning && alertEnabled, title: budget.categoryId ? budget.categoryName || categoryNames.get(budget.categoryId) || 'Category budget' : 'Overall budget' }
  })

  const selectedPeriodLabel = periodMode === 'weekly' ? `${formatDateForDisplay(range.from)} – ${formatDateForDisplay(range.to)}` : periodMode === 'yearly' ? year : periodMode === 'lifetime' ? 'Lifetime' : monthLabel(month)
  const widget = (key) => dashboardPrefs.widgets[key] !== false
  const summaryCards = {
    balance: <><Stat title="Total current balance" value={displayMoney(totalBalance, currency)} icon={Wallet} tone="green" detail="Across all tracked accounts" /><Stat title="Available balance" value={displayMoney(availableBalance, currency)} icon={Wallet} tone="green" detail="Spending-classified accounts" /><Stat title="Savings balance" value={displayMoney(savingsBalance, currency)} icon={PiggyBank} tone="gold" detail="Savings-classified accounts" /></>,
    income: <><Stat title="Lifetime income" value={displayMoney(lifetime.income, currency)} icon={ArrowDownLeft} tone="blue" detail="Posted income records" /><Stat title={`Income · ${selectedPeriodLabel}`} value={displayMoney(period.income, currency)} icon={ArrowDownLeft} tone="blue" detail={selectedPeriodLabel} /></>,
    expenses: <><Stat title="Lifetime expenses" value={displayMoney(lifetime.expenses, currency)} icon={ArrowUpRight} tone="rose" detail="Actual expense records" /><Stat title={`Expenses · ${selectedPeriodLabel}`} value={displayMoney(period.expenses, currency)} icon={ArrowUpRight} tone="rose" detail={selectedPeriodLabel} /></>,
    savings: <><Stat title="Moved into savings" value={displayMoney(savingsFlow.in, currency)} icon={PiggyBank} tone="gold" detail={`Transfers · ${selectedPeriodLabel}`} /><Stat title="Moved out of savings" value={displayMoney(savingsFlow.out, currency)} icon={PiggyBank} tone="gold" detail={`Transfers · ${selectedPeriodLabel}`} /></>,
  }
  const summaryLabels = { balance: 'Account balances', income: 'Income summaries', expenses: 'Expense summaries', savings: 'Savings summaries' }

  return <>
    <PageHeading eyebrow="Your overview" title={'Good to see you, ' + (profile.displayName.split(' ')[0] || 'there')} description={`Here’s how your money is moving ${periodMode === 'lifetime' ? 'over time' : `this ${periodMode === 'monthly' ? 'month' : periodMode === 'weekly' ? 'week' : 'year'}`}.`} action={<div className="flex flex-wrap items-center gap-2"><select aria-label="Dashboard period" value={periodMode} onChange={(event) => { setPeriodModeTouched(true); setPeriodMode(event.target.value) }} className="rounded-xl border border-[#e0e6de] bg-white px-3 py-2 text-sm"><option value="weekly">This week</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="lifetime">Lifetime</option></select>{periodMode === 'monthly' && <label className="flex items-center gap-2 rounded-xl border border-[#e0e6de] bg-white px-3 py-2 text-sm text-[#405246]"><CalendarDays size={16} className="text-[#71877a]"/><span className="sr-only">Choose month</span><input aria-label="Choose month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="bg-transparent outline-none" /></label>}{periodMode === 'yearly' && <input aria-label="Dashboard year" type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(event.target.value)} className="w-28 rounded-xl border border-[#e0e6de] bg-white px-3 py-2 text-sm"/>}</div>} />
    {!loading && !error && preferences.notifications.monthlySummary && periodMode === 'monthly' && <Card className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-[#849087]">Monthly financial summary · {monthLabel(month)}</p><div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm"><span>Income <strong className="ml-1">{displayMoney(period.income, currency)}</strong></span><span>Expenses <strong className="ml-1">{displayMoney(period.expenses, currency)}</strong></span></div></Card>}
    {!loading && !error && <div className="mb-5 grid gap-4 xl:grid-cols-2">
      {widget('forecast') && <Card><div className="flex items-center gap-2"><CalendarDays size={17} className="text-[#628d51]"/><h2 className="font-serif text-lg font-semibold text-[#23372b]">Next 30 days</h2></div><p className="mt-1 text-xs text-[#849087]">Estimate from active recurring schedules and current account balances.</p><div className="mt-4 grid grid-cols-3 gap-2"><ForecastMetric label="Starting" value={displayMoney(cashForecast.openingBalance)}/><ForecastMetric label="Scheduled in" value={displayMoney(cashForecast.scheduledIncome)}/><ForecastMetric label="Scheduled out" value={displayMoney(cashForecast.scheduledExpenses)}/></div><div className="mt-3 rounded-xl bg-[#f0f5eb] px-4 py-3"><p className="text-xs text-[#6d7e70]">Estimated balance by {formatDateForDisplay(cashForecast.to)}</p><p className="mt-1 text-xl font-semibold text-[#2b5941]">{displayMoney(cashForecast.projectedBalance)}</p></div>{cashForecast.events.length > 0 && <p className="mt-2 text-xs text-[#849087]">Based on {cashForecast.events.length} scheduled item{cashForecast.events.length === 1 ? '' : 's'}. Actual dates and spending may differ.</p>}</Card>}
      {widget('insights') && <Card><div className="flex items-center gap-2"><TrendingUp size={17} className="text-[#628d51]"/><h2 className="font-serif text-lg font-semibold text-[#23372b]">Spending insights</h2></div><p className="mt-1 text-xs text-[#849087]">Month to date compared with the same days last month.</p><div className="mt-4 flex items-center gap-3"><span className="rounded-xl bg-[#f0f5eb] p-2.5 text-[#628d51]">{spendingInsights.changePercent === null || spendingInsights.changePercent <= 0 ? <TrendingDown size={19}/> : <TrendingUp size={19}/>}</span><p className="text-sm text-[#526257]">{spendingInsights.changePercent === null ? 'No previous-month spending to compare yet.' : `${Math.abs(spendingInsights.changePercent)}% ${spendingInsights.changePercent > 0 ? 'more' : spendingInsights.changePercent < 0 ? 'less' : 'same'} spending than the same point last month.`}</p></div><div className="mt-4 space-y-2">{spendingInsights.topCategories.length ? spendingInsights.topCategories.map((category) => <div key={category.id} className="flex justify-between gap-3 rounded-lg bg-[#f7f9f5] px-3 py-2 text-sm"><span className="truncate text-[#65756a]">{category.name}</span><strong className="shrink-0 text-[#34483b]">{displayMoney(category.amount)}</strong></div>) : <p className="text-sm text-[#849087]">Add an expense to see your category insights.</p>}</div></Card>}
    </div>}
    {loading ? <LoadingState label="Gathering your monthly picture" /> : error ? <Card><EmptyState title="Dashboard unavailable" description={error} action={<button onClick={() => { setLoading(true); setReload((value) => value + 1) }} className="text-sm font-semibold text-[#3c6e4c]">Try again</button>} /></Card> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{dashboardPrefs.widgetOrder.map((key, index) => widget(key) && <section key={key} aria-label={summaryLabels[key]} style={{ order: index }} className={dashboardPrefs.widgetSizes[key] === 'wide' ? 'grid gap-3 sm:col-span-2 xl:col-span-4 sm:grid-cols-2 xl:grid-cols-4' : 'grid gap-3 sm:col-span-2 xl:col-span-2 sm:grid-cols-2'}>{summaryCards[key]}</section>)}</div>
      {widget('balance') && accounts.length > 0 && <Card className="mt-5"><div className="flex items-center justify-between"><div><h2 className="font-serif text-xl font-semibold text-[#23372b]">Your accounts</h2><p className="mt-1 text-xs text-[#849087]">Balances reconcile to the total above</p></div><Link to="/app/accounts" className="text-sm font-semibold text-[#4c7652]">Manage</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{accounts.map((account) => <div key={account.id} className="flex items-center justify-between rounded-xl bg-[#f6f8f4] px-4 py-3"><span><span className="block text-sm font-semibold text-[#405247]">{account.name}</span><span className="mt-0.5 block text-xs capitalize text-[#849087]">{account.classification} · {account.accountType}</span></span><span className="text-sm font-bold tabular-nums text-[#304337]">{displayMoney(BigInt(account.balanceMinor || 0), currency)}</span></div>)}</div></Card>}
      {transactions.length === 0 ? <Card className="mt-5"><EmptyState icon={CirclePlus} title="Start with your first transaction" description="Add an income or expense and your monthly picture will begin to take shape." action={<Link to="/app/transactions" className="inline-flex rounded-xl bg-[#2b5941] px-4 py-2.5 text-sm font-semibold text-white">Add a transaction</Link>} /></Card> : <>
        {widget('spendingBreakdown') && <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <div className="mb-4 flex items-start justify-between"><div><h2 className="font-serif text-xl font-semibold text-[#23372b]">Cash flow</h2><p className="mt-1 text-xs text-[#849087]">Income and expenses · last six months</p></div><span className="rounded-lg bg-[#f2f5ef] px-2.5 py-1.5 text-xs font-semibold text-[#65796c]">{monthLabel(month)}</span></div>
            <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7cac68" stopOpacity={.23}/><stop offset="95%" stopColor="#7cac68" stopOpacity={0}/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d58a79" stopOpacity={.15}/><stop offset="95%" stopColor="#d58a79" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0eb" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#929d95', fontSize: 11 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#929d95', fontSize: 10 }} tickFormatter={(value) => compact(value, currency)}/><Tooltip formatter={(value, name) => [displayMoney(BigInt(Math.max(0, Math.round(Number(value)))), currency), name === 'income' ? 'Income' : 'Expenses']}/><Area type="monotone" dataKey="income" stroke="#4f875e" strokeWidth={2.5} fill="url(#incomeFill)"/><Area type="monotone" dataKey="expenses" stroke="#cb806e" strokeWidth={2.5} fill="url(#expenseFill)"/></AreaChart></ResponsiveContainer></div>
            <div className="mt-2 flex gap-5 text-xs text-[#78857c]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#4f875e]"/>Income</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#cb806e]"/>Expenses</span></div>
          </Card>
          <Card>
            <div className="mb-4"><h2 className="font-serif text-xl font-semibold text-[#23372b]">Spending by category</h2><p className="mt-1 text-xs text-[#849087]">Where this month’s expenses went</p></div>
            {categoryTotals.length ? <><div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryTotals.map((item) => ({ ...item, value: Number(item.amount) }))} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none">{categoryTotals.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => displayMoney(BigInt(Math.round(Number(value))), currency)}/></PieChart></ResponsiveContainer></div><div className="space-y-2.5">{categoryTotals.slice(0, 4).map((item, index) => <div key={item.name} className="flex items-center gap-2.5 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }}/><span className="flex-1 truncate text-[#6e7c72]">{item.name}</span><span className="font-semibold text-[#304337]">{displayMoney(item.amount, currency)}</span></div>)}</div></> : <EmptyState title="No spending yet" description="Expenses will appear here once you add them." />}
          </Card>
        </div>}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          {widget('recentTransactions') && <Card className="!p-0"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><div><h2 className="font-serif text-xl font-semibold text-[#23372b]">Recent activity</h2><p className="mt-1 text-xs text-[#849087]">Your latest entries</p></div><Link to="/app/transactions" className="text-sm font-semibold text-[#4c7652] hover:underline">See all</Link></div>
            <div className="divide-y divide-[#f0f2ee]">{transactions.slice(0, dashboardPrefs.recentTransactionCount).map((item) => <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6"><span className={'grid h-10 w-10 place-items-center rounded-xl ' + (item.kind === 'income' ? 'bg-[#edf5e8] text-[#50804f]' : 'bg-[#f9eeeb] text-[#b87465]')}>{item.kind === 'income' ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#304337]">{item.categoryName || item.goalName || 'Transaction'}</span><span className="mt-0.5 block text-xs text-[#8a958d]">{formatDateForDisplay(item.occurredOn)}</span></span><span className={'text-sm font-bold tabular-nums ' + (item.kind === 'income' ? 'text-[#4b8052]' : 'text-[#34483a]')}>{item.kind === 'income' ? '+' : '−'}{displayMoney(item.amountMinor, currency)}</span></div>)}</div>
          </Card>
          }
          <div className="space-y-5">
            {widget('budgets') && <Card><div className="mb-4 flex items-center justify-between"><div><h2 className="font-serif text-xl font-semibold text-[#23372b]">Budget check-in</h2><p className="mt-1 text-xs text-[#849087]">{budgetPeriod === 'yearly' ? `Year ${budgetPeriodValue}` : monthLabel(month)}</p></div><Link to="/app/budgets" className="text-xs font-semibold text-[#4c7652]">Manage</Link></div>
              {budgetRows.length ? <div className="space-y-4">{budgetRows.slice(0,3).map((budget) => <div key={budget.id}><div className="mb-1.5 flex justify-between gap-2 text-xs"><span className="truncate font-medium text-[#536359]">{budget.title}</span><span className="shrink-0 text-[#849087]">{displayMoney(budget.spent, currency)} / {displayMoney(budget.target, currency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eff2ed]"><div className={'h-full rounded-full ' + (budget.percent >= 100 ? 'bg-[#d67968]' : budget.warning ? 'bg-[#d4aa5a]' : 'bg-[#81a967]')} style={{ width: Math.min(budget.percent, 100) + '%' }}/>{budget.warning && <p className="mt-1 text-[11px] text-amber-700">{budget.percent >= 100 ? 'Budget exceeded' : 'Budget warning'}</p>}</div></div>)}</div> : <p className="rounded-xl bg-[#f6f8f4] p-4 text-sm leading-6 text-[#7a877e]">Set a monthly budget to give your spending a helpful boundary. <Link to="/app/budgets" className="font-semibold text-[#4d7652]">Create one</Link></p>}
            </Card>}
            {widget('goals') && <Card><div className="mb-3 flex items-center gap-2"><PiggyBank size={18} className="text-[#6d8d55]"/><h2 className="font-serif text-lg font-semibold text-[#23372b]">Savings goals</h2></div>{goals.length ? <div className="space-y-2">{goals.slice(0,2).map((goal) => <div key={goal.id} className="flex items-center justify-between rounded-xl bg-[#f6f8f3] px-3.5 py-3"><span className="truncate text-sm font-medium text-[#526257]">{goal.name}</span><span className="ml-3 shrink-0 text-xs font-semibold text-[#64805a]">{displayMoney(goal.targetMinor, currency)} target</span></div>)}</div> : <p className="text-sm leading-6 text-[#7a877e]">Make a plan for something you’re looking forward to. <Link to="/app/goals" className="font-semibold text-[#4d7652]">Add a goal</Link></p>}</Card>}
          </div>
        </div>
      </>}
    </>}
  </>
}

function Stat({ title, value, icon: Icon, tone, detail }) {
  const colors = { green: 'bg-[#edf5e8] text-[#52804e]', blue: 'bg-[#edf3f5] text-[#527d8d]', rose: 'bg-[#f9efec] text-[#b97768]', gold: 'bg-[#f8f2e6] text-[#aa8241]' }
  return <Card className="!p-4 sm:!p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-[#7b887f]">{title}</p><p className="mt-3 text-[1.38rem] font-bold tracking-tight text-[#1e3428] tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[#98a198]">{detail}</p></div><span className={'rounded-xl p-2.5 ' + colors[tone]}><Icon size={18}/></span></div></Card>
}

function ForecastMetric({ label, value }) {
  return <div className="min-w-0 rounded-xl bg-[#f7f9f5] px-3 py-2"><p className="text-[11px] text-[#849087]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#34483b]">{value}</p></div>
}

function compact(minorValue, currency) {
  if (typeof document !== 'undefined' && (document.documentElement.dataset.hideBalances === 'true' || document.documentElement.dataset.hideDashboardAmounts === 'true')) return '••••'
  const exponent = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
  const amount = Number(minorValue) / Math.pow(10, exponent)
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount)
}

function lastMonths(anchor, count) {
  const [year, month] = anchor.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - count + index, 1)
    return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0')
  })
}
