import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, Field, SelectField } from '../../components/ui'
import { ToolResult, ToolShell } from '../ToolsPage'
import { calculateSipProjection } from '../../lib/calculators'

const currencies = ['USD','NPR','INR','EUR','GBP','AUD','CAD','JPY']
const colors = ['#82a96a', '#d2a44e']
export default function SipCalculatorPage() {
  const [monthly, setMonthly] = useState('100')
  const [rate, setRate] = useState('8')
  const [years, setYears] = useState('10')
  const [currency, setCurrency] = useState('USD')
  const [result, setResult] = useState(null)
  const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  const chart = useMemo(() => result ? [{ name: 'Invested', value: result.invested }, { name: 'Projected growth', value: Math.max(result.total - result.invested, 0) }] : [], [result])
  function calculate(event) { event.preventDefault(); try { setResult(calculateSipProjection(monthly, rate, years)) } catch { setResult(null) } }
  return <ToolShell title="SIP calculator" description="Estimate the future value of regular monthly investing with monthly compounding. Results are projections, not guarantees."><div className="grid gap-5 lg:grid-cols-2"><Card><form onSubmit={calculate} className="space-y-4"><SelectField label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((code) => <option key={code}>{code}</option>)}</SelectField><Field label="Monthly investment" type="number" min="0.01" step="any" value={monthly} onChange={(event) => setMonthly(event.target.value)} required/><Field label="Expected annual return (%)" type="number" min="0" step="any" value={rate} onChange={(event) => setRate(event.target.value)} required/><Field label="Time period (whole years)" type="number" min="1" max="100" step="1" value={years} onChange={(event) => setYears(event.target.value)} required/><button className="w-full rounded-xl bg-[#173f31] px-4 py-3 text-sm font-semibold text-white hover:bg-[#102f25]">Calculate projection</button></form></Card><Card><h2 className="font-serif text-xl font-semibold">Projected outcome</h2>{result ? <><div className="mt-4 grid gap-3"><ToolResult label="Total invested" value={money(result.invested)}/><ToolResult label="Estimated value" value={money(result.total)} hint={`Projected growth: ${money(result.growth)}`}/></div><div className="mt-2 h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>{chart.map((item,index)=><Cell key={item.name} fill={colors[index]}/>)}</Pie><Tooltip formatter={(value) => money(Number(value))}/></PieChart></ResponsiveContainer></div></> : <p className="mt-4 text-sm text-[#849087]">Enter your assumptions to view a projection.</p>}<p className="mt-3 text-xs leading-5 text-[#89958c]">Actual returns vary and may be negative. The estimate assumes contributions at the beginning of each month and a steady return rate.</p></Card></div></ToolShell>
}
