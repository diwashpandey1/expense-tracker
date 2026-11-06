import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney } from '../lib/money'
import { explainFirebaseError } from '../lib/firebaseErrors'
import { listAllTransactions } from '../services/transactionService'
import { calculateSummary, summarizeByKind, summarizeMonths } from '../services/summaryService'
import { listAccounts, listLedgerEntries } from '../services/ledgerService'
import { currentMonth, localDateString, monthRange } from '../lib/dates'
import { summarizeLedgerPeriod } from '../domain/financialLedger'
import { Card, EmptyState, LoadingState, PageHeading } from '../components/ui'

const colors = ['#54845c','#9bb86b','#d4a64a','#5c8ba0','#bd7d6c','#8274a5','#68a49a']

export default function AnalyticsPage() {
  const { user, profile } = useAuth()
  const { preferences } = usePreferences()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryKind, setCategoryKind] = useState('expense')
  const [chartType, setChartType] = useState(preferences.dashboard.analyticsChartType)
  const [chartTypeTouched, setChartTypeTouched] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [ledger, setLedger] = useState([])
  const [mode, setMode] = useState('monthly')
  const [month, setMonth] = useState(currentMonth())
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [customFrom, setCustomFrom] = useState(`${currentMonth()}-01`)
  const [customTo, setCustomTo] = useState(localDateString())
  useEffect(() => { if (!chartTypeTouched) setChartType(preferences.dashboard.analyticsChartType) }, [preferences.dashboard.analyticsChartType, chartTypeTouched])
  useEffect(() => { let active = true; Promise.all([listAllTransactions(user.uid), listAccounts(user.uid, { includeArchived: true }), listLedgerEntries(user.uid)]).then(([tx, accountRows, ledgerRows]) => { if (active) { setRows(tx); setAccounts(accountRows); setLedger(ledgerRows) } }).catch((caught) => { if (active) setError(explainFirebaseError(caught, 'analytics')) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [user.uid])
  const range = useMemo(() => {
      if (mode === 'monthly') return monthRange(month)
    if (mode === 'yearly') return { from: `${year}-01-01`, to: `${year}-12-31` }
    if (mode === 'custom') return { from: customFrom, to: customTo }
    return { from: '0001-01-01', to: localDateString() }
  }, [mode, month, year, customFrom, customTo])
  const periodRows = useMemo(() => rows.filter((row) => !row.voided && row.occurredOn >= range.from && row.occurredOn <= range.to), [rows, range])
  const months = useMemo(() => monthKeysInRange(range.from, range.to), [range])
  const trend = useMemo(() => summarizeMonths(periodRows, months).map((item) => ({ month: item.month.slice(2), income: Number(item.income), expenses: Number(item.expenses) })), [periodRows, months])
  const groups = useMemo(() => summarizeByKind(periodRows, categoryKind), [periodRows, categoryKind])
  const summary = useMemo(() => calculateSummary(periodRows), [periodRows])
  const position = useMemo(() => summarizeLedgerPeriod(accounts, ledger, rows, range.from, range.to), [accounts, ledger, rows, range])
  const money = (value) => formatMoney(value, profile.currencyCode)
  return <><PageHeading eyebrow="Patterns over time" title="Analytics" description="Compare activity and carried-forward account balances across periods."/>{<div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#e4eadf] bg-white p-3"><select aria-label="Analytics date range" value={mode} onChange={(event) => setMode(event.target.value)} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-sm"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="lifetime">Lifetime</option><option value="custom">Custom range</option></select>{mode === 'monthly' && <input aria-label="Analytics month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-sm"/>}{mode === 'yearly' && <input aria-label="Analytics year" type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(event.target.value)} className="w-28 rounded-lg border border-[#dfe5dd] px-3 py-2 text-sm"/>}{mode === 'custom' && <><input aria-label="Custom start date" type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-sm"/><input aria-label="Custom end date" type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-sm"/></>}</div>}{loading ? <LoadingState/> : error ? <Card><p className="text-sm text-rose-700">{error}</p></Card> : rows.length || accounts.length ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Opening total balance" value={money(position.openingBalance)}/><Metric label="Opening available" value={money(position.openingAvailable)}/><Metric label="Opening savings" value={money(position.openingSavings)}/><Metric label="Period income" value={money(summary.income)}/><Metric label="Period expenses" value={money(summary.expenses)}/><Metric label="Transfers into savings" value={money(position.transfersIntoSavings)}/><Metric label="Transfers out of savings" value={money(position.transfersOutOfSavings)}/><Metric label="Closing available balance" value={money(position.closingAvailable)}/><Metric label="Closing savings balance" value={money(position.closingSavings)}/><Metric label="Closing total balance" value={money(position.closingBalance)}/></div><p className="-mt-2 text-xs text-[#849087]">Income and expenses include preserved legacy transactions; account balances include opening balances and account-ledger entries only.</p><Card><h2 className="font-serif text-xl font-semibold text-[#23372b]">Cash flow by month</h2><p className="mt-1 text-xs text-[#849087]">{range.from} through {range.to}</p><div className="mt-5 h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}><CartesianGrid stroke="#edf0eb" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#929d95', fontSize: 10 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#929d95', fontSize: 10 }}/><Tooltip formatter={(value) => money(BigInt(Math.round(Number(value))))}/><Bar dataKey="income" name="Income" fill="#76a365" radius={[5,5,0,0]}/><Bar dataKey="expenses" name="Expenses" fill="#cf8978" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Card><Card><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-xl font-semibold text-[#23372b]">Category breakdown</h2><p className="mt-1 text-xs text-[#849087]">Filtered to the selected date range.</p></div><div className="flex gap-2"><select aria-label="Analytics category kind" value={categoryKind} onChange={(event) => setCategoryKind(event.target.value)} className="rounded-xl border border-[#dfe5dd] bg-white px-3 py-2 text-sm"><option value="expense">Expenses</option><option value="income">Income</option><option value="savings">Savings activity</option></select><select aria-label="Analytics chart type" value={chartType} onChange={(event) => { setChartTypeTouched(true); setChartType(event.target.value) }} className="rounded-xl border border-[#dfe5dd] bg-white px-3 py-2 text-sm"><option value="pie">Pie chart</option><option value="bar">Bar chart</option><option value="line">Line chart</option></select></div></div>{groups.length ? <><div className="mt-4 h-[280px]"><ResponsiveContainer width="100%" height="100%">{chartType === 'pie' ? <PieChart><Pie data={groups.slice(0,8).map((item) => ({ ...item, value: Number(item.amount) }))} dataKey="value" nameKey="name" innerRadius={58} outerRadius={100} paddingAngle={3}>{groups.slice(0,8).map((item,index)=><Cell key={item.name} fill={colors[index % colors.length]}/>)}</Pie><Tooltip formatter={(value) => money(BigInt(Math.round(Number(value))))}/></PieChart> : chartType === 'line' ? <LineChart data={groups.slice(0,10).map((item) => ({ name: item.name, amount: Number(item.amount) }))}><CartesianGrid stroke="#edf0eb" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }}/><Tooltip formatter={(value) => money(BigInt(Math.round(Number(value))))}/><Line dataKey="amount" name="Amount" stroke="#54845c" strokeWidth={2.5} activeDot={{ r: 5 }}/></LineChart> : <BarChart data={groups.slice(0,10).map((item) => ({ name: item.name, amount: Number(item.amount) }))}><CartesianGrid stroke="#edf0eb" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }}/><Tooltip formatter={(value) => money(BigInt(Math.round(Number(value))))}/><Bar dataKey="amount" name="Amount" fill="#82a96a" radius={[5,5,0,0]}/></BarChart>}</ResponsiveContainer></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{groups.slice(0,6).map((item,index)=><div key={item.name} className="flex items-center gap-2 rounded-xl bg-[#f6f8f4] px-3 py-2.5 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:colors[index % colors.length]}}/><span className="min-w-0 flex-1 truncate text-[#617066]">{item.name}</span><span className="shrink-0 font-semibold text-[#304337]">{money(item.amount)}</span></div>)}</div></> : <EmptyState title={`No ${categoryKind === 'savings' ? 'savings activity' : categoryKind} yet`} description="These categories will appear once you record matching transactions."/>}</Card></div> : <Card><EmptyState title="Analytics grow with your data" description="Add accounts or transactions to see period and balance reports."/></Card>}</>
}

function Metric({ label, value }) { return <Card><p className="text-xs font-bold uppercase tracking-wider text-[#849087]">{label}</p><p className="mt-2 text-xl font-semibold text-[#24392d]">{value}</p></Card> }

function monthKeysInRange(from, to) {
  if (!from || !to || from > to) return []
  const [startYear, startMonth] = from.slice(0, 7).split('-').map(Number)
  const [endYear, endMonth] = to.slice(0, 7).split('-').map(Number)
  const totalCount = (endYear - startYear) * 12 + endMonth - startMonth + 1
  const count = Math.min(totalCount, 120)
  const firstAbsoluteMonth = totalCount > 120 ? endYear * 12 + endMonth - 120 : startYear * 12 + startMonth - 1
  const firstYear = Math.floor(firstAbsoluteMonth / 12)
  const firstMonth = firstAbsoluteMonth % 12
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const date = new Date(Date.UTC(firstYear, firstMonth + index, 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  })
}
