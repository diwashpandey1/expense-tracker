import { useEffect, useState } from 'react'
import { ArrowDownUp, RefreshCw } from 'lucide-react'
import { Card, Field, InlineError, LoadingState, SelectField } from '../../components/ui'
import { ToolResult, ToolShell } from '../ToolsPage'

const fallbackCurrencies = ['AUD','CAD','CHF','CNY','EUR','GBP','INR','JPY','NPR','NZD','SGD','USD']
const rateCache = new Map()

export default function CurrencyConverterPage({ basePath = '/tools', embedded = false }) {
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('EUR')
  const [currencies, setCurrencies] = useState(fallbackCurrencies.map((code) => ({ code, name: code })))
  const [rate, setRate] = useState(null)
  const [rateDate, setRateDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('https://api.frankfurter.dev/v2/currencies', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Currency list unavailable.'); return response.json() })
      .then((items) => { const list = items.map((item) => ({ code: item.iso_code || item.code, name: item.name || item.iso_code || item.code })).filter((item) => item.code); if (list.length) setCurrencies(list) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const cacheKey = `${from}:${to}`
    if (from === to) { setRate(1); setRateDate(''); setLoading(false); setError(''); return () => controller.abort() }
    if (rateCache.has(cacheKey)) { const cached=rateCache.get(cacheKey); setRate(cached.rate); setRateDate(cached.date); setLoading(false) }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('A rate for this currency pair is not available right now.')
        const result = await response.json()
        if (!Number.isFinite(result.rate)) throw new Error('The exchange-rate response was invalid.')
        rateCache.set(cacheKey, result)
        setRate(result.rate); setRateDate(result.date || '')
      } catch (caught) { if (caught.name !== 'AbortError') { setError(caught.message || 'Could not load an exchange rate.'); setRate(null) } }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [from, to, refresh])

  const numericAmount = Number(amount)
  const converted = rate != null && Number.isFinite(numericAmount) ? numericAmount * rate : null
  const format = (value, code) => new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 4 }).format(value)
  function swap() { setFrom(to); setTo(from) }

  return <ToolShell title="Currency exchange" description="Convert an amount using daily indicative reference rates. Rates update when providers publish and are not live trading quotes." basePath={basePath} embedded={embedded}><div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><Card><div className="space-y-4"><Field label="Amount" type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)}/><SelectField label="From currency" value={from} onChange={(event) => setFrom(event.target.value)}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</SelectField><div className="flex justify-center"><button type="button" onClick={swap} className="grid h-10 w-10 place-items-center rounded-full bg-[#eef4e8] text-[#55764c] hover:bg-[#e2ecd8]" aria-label="Swap currencies"><ArrowDownUp size={17}/></button></div><SelectField label="To currency" value={to} onChange={(event) => setTo(event.target.value)}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</SelectField></div></Card><Card><div className="flex items-start justify-between"><div><h2 className="font-serif text-xl font-semibold">Converted amount</h2><p className="mt-1 text-xs text-[#849087]">Reference rate · Frankfurter</p></div><button type="button" aria-label="Refresh exchange rate" className="rounded-lg p-2 text-[#708176] hover:bg-[#eef2ec]" onClick={() => setRefresh((value) => value+1)}><RefreshCw size={16}/></button></div>{loading && rate == null ? <LoadingState label="Checking the latest available rate"/> : error ? <div className="mt-4"><InlineError>{error}</InlineError><p className="mt-2 text-xs text-[#849087]">You can try again or select another pair.</p></div> : converted != null ? <div className="mt-5 space-y-3"><ToolResult label="Result" value={format(converted, to)}/><ToolResult label="Exchange rate" value={`1 ${from} = ${rate.toLocaleString(undefined,{maximumFractionDigits:8})} ${to}`} hint={rateDate ? `Rate date: ${rateDate}` : 'Same-currency conversion'}/><div className="h-3 overflow-hidden rounded-full bg-[#eff2ed]"><div className="h-full w-2/3 rounded-full bg-[#82a96a]"/></div><p className="text-xs leading-5 text-[#89958c]">This calculator is for reference only. Banks and transfer providers may apply different rates, spreads, or fees.</p></div> : <p className="mt-4 text-sm text-[#849087]">Enter an amount and choose currencies.</p>}</Card></div><p className="mt-5 text-xs text-[#89958c]">Exchange-rate data provided by <a href="https://frankfurter.dev" target="_blank" rel="noreferrer" className="font-semibold underline">Frankfurter</a>. No API key is used.</p></ToolShell>
}
