import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, Field, SelectField } from '../../components/ui'
import { ToolResult, ToolShell } from '../ToolsPage'
import { calculateSimpleInterest } from '../../lib/calculators'

const currencies = ['USD','NPR','INR','EUR','GBP','AUD','CAD','JPY']
const colors = ['#82a96a', '#d2a44e']

export default function SimpleInterestPage() {
  const [principal, setPrincipal] = useState('1000')
  const [rate, setRate] = useState('5')
  const [years, setYears] = useState('3')
  const [currency, setCurrency] = useState('USD')
  const [result, setResult] = useState(null)
  const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  const chart = useMemo(() => result ? [{ name: 'Principal', value: result.principal }, { name: 'Interest', value: result.interest }] : [], [result])
  function calculate(event) { event.preventDefault(); try { setResult(calculateSimpleInterest(principal, rate, years)) } catch { setResult(null) } }
  return <ToolShell title="Simple interest calculator" description="Estimate interest calculated only on the original principal. Enter the amount, annual rate, and time period."><div className="grid gap-5 lg:grid-cols-2"><Card><form onSubmit={calculate} className="space-y-4"><SelectField label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((code) => <option key={code}>{code}</option>)}</SelectField><Field label="Principal" type="number" min="0.01" step="any" value={principal} onChange={(event) => setPrincipal(event.target.value)} required/><Field label="Annual interest rate (%)" type="number" min="0" step="any" value={rate} onChange={(event) => setRate(event.target.value)} required/><Field label="Time (years)" type="number" min="0.01" step="any" value={years} onChange={(event) => setYears(event.target.value)} required/><button className="w-full rounded-xl bg-[#2b5941] px-4 py-3 text-sm font-semibold text-white hover:bg-[#214731]">Calculate</button></form></Card><Card><h2 className="font-serif text-xl font-semibold">Your estimate</h2>{result ? <><div className="mt-4 grid gap-3 sm:grid-cols-3"><ToolResult label="Principal" value={money(result.principal)}/><ToolResult label="Interest" value={money(result.interest)}/><ToolResult label="Total" value={money(result.total)}/></div><p className="mt-3 text-xs text-[#849087]">Formula: principal × annual rate × years ÷ 100.</p><div className="mt-2 h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>{chart.map((item,index)=><Cell key={item.name} fill={colors[index]}/>)}</Pie><Tooltip formatter={(value) => money(Number(value))}/></PieChart></ResponsiveContainer></div></> : <p className="mt-4 text-sm text-[#849087]">Enter your assumptions to see a simple interest estimate.</p>}<p className="mt-3 text-xs leading-5 text-[#89958c]">This calculator is for planning and learning; actual loan or deposit terms may include compounding, fees, taxes, or different day-count conventions.</p></Card></div></ToolShell>
}
