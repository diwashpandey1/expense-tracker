import { useEffect, useState } from 'react'
import { Calculator, RotateCcw } from 'lucide-react'
import { Button, Card, Field, InlineError, SelectField } from '../../components/ui'
import { SUPPORTED_CURRENCIES } from '../../constants/currencies'
import { useAuth } from '../../context/AuthContext'
import { calculateFinanceTool } from '../../lib/financeToolCalculators'
import { ToolResult, ToolShell } from '../ToolsPage'

const definitions = {
  'compound-interest': {
    title: 'Compound interest calculator',
    description: 'Estimate how a one-time starting amount could grow when returns compound over time.',
    note: 'Assumes a steady rate and regular compounding. Actual investment returns can vary and may be negative.',
    fields: [
      { key: 'principal', label: 'Starting amount', initial: '10000', money: true },
      { key: 'rate', label: 'Annual return (%)', initial: '8', min: '0' },
      { key: 'years', label: 'Time period (years)', initial: '10', min: '0.01' },
      { key: 'frequency', label: 'Compounds per year', initial: '12', min: '1', step: '1' },
    ],
  },
  'loan-emi': {
    title: 'Loan payment calculator',
    description: 'Estimate a fixed-rate loan payment, total interest, and total amount repaid.',
    note: 'An estimate only. Lender fees, taxes, insurance, changing rates, and payment timing are not included.',
    fields: [
      { key: 'principal', label: 'Loan amount', initial: '1000000', money: true },
      { key: 'rate', label: 'Annual interest rate (%)', initial: '8', min: '0' },
      { key: 'years', label: 'Loan term (years)', initial: '10', min: '0.01' },
    ],
  },
  'savings-goal': {
    title: 'Savings goal planner',
    description: 'Work out a steady monthly contribution to reach a savings goal by a target date.',
    note: 'Assumes no interest or investment growth. Add a buffer if your contributions or timeline may vary.',
    fields: [
      { key: 'target', label: 'Savings target', initial: '100000', money: true },
      { key: 'current', label: 'Already saved', initial: '25000', money: true, min: '0' },
      { key: 'months', label: 'Months to reach the goal', initial: '12', min: '1' },
    ],
  },
  'emergency-fund': {
    title: 'Emergency fund planner',
    description: 'Set a reserve target using your essential monthly costs and preferred coverage period.',
    note: 'Choose a coverage period that fits your household and income stability. This is a planning guideline, not a rule.',
    fields: [
      { key: 'expenses', label: 'Essential monthly expenses', initial: '50000', money: true },
      { key: 'months', label: 'Months of coverage', initial: '6', min: '1', step: '1' },
    ],
  },
  'budget-split': {
    title: '50/30/20 budget planner',
    description: 'Create a simple starting plan for needs, wants, and savings or debt payments.',
    note: 'The 50/30/20 split is a flexible rule of thumb. Adjust it to fit your actual costs and priorities.',
    fields: [
      { key: 'income', label: 'Monthly take-home income', initial: '100000', money: true },
    ],
  },
  'debt-payoff': {
    title: 'Debt payoff planner',
    description: 'Estimate how long it may take to clear a balance with a fixed monthly payment.',
    note: 'Assumes the rate and payment stay constant and no new charges or fees are added.',
    fields: [
      { key: 'balance', label: 'Current debt balance', initial: '50000', money: true },
      { key: 'payment', label: 'Monthly payment', initial: '5000', money: true },
      { key: 'rate', label: 'Annual interest rate (%)', initial: '18', min: '0' },
    ],
  },
  'net-worth': {
    title: 'Net worth calculator',
    description: 'Get a simple snapshot by subtracting liabilities from assets.',
    note: 'Include assets and debts consistently, and use current estimates. This tool does not value or verify them.',
    fields: [
      { key: 'assets', label: 'Total assets', initial: '500000', money: true, min: '0' },
      { key: 'debts', label: 'Total liabilities and debts', initial: '200000', money: true, min: '0' },
    ],
  },
  inflation: {
    title: 'Inflation impact calculator',
    description: 'Estimate the future amount needed to match the buying power of money you have today.',
    note: 'Uses a constant inflation assumption. Actual inflation varies by place, category, and time.',
    fields: [
      { key: 'amount', label: 'Amount in today’s money', initial: '100000', money: true },
      { key: 'rate', label: 'Annual inflation assumption (%)', initial: '5', min: '0' },
      { key: 'years', label: 'Time period (years)', initial: '10', min: '0.01' },
    ],
  },
  'take-home': {
    title: 'Take-home pay estimator',
    description: 'Estimate the amount left after an assumed total deduction percentage.',
    note: 'This is not a tax calculator. Actual deductions depend on your location, benefits, and employment terms.',
    fields: [
      { key: 'income', label: 'Gross monthly income', initial: '100000', money: true },
      { key: 'deductions', label: 'Estimated deductions (%)', initial: '15', min: '0' },
    ],
  },
  'loan-affordability': {
    title: 'Loan affordability estimator',
    description: 'Estimate a payment limit and a possible fixed-rate loan amount from income and existing debt payments.',
    note: 'Lenders use their own affordability checks, rates, fees, and rules. This estimate is not an approval or offer.',
    fields: [
      { key: 'income', label: 'Monthly take-home income', initial: '100000', money: true },
      { key: 'debts', label: 'Current monthly debt payments', initial: '10000', money: true, min: '0' },
      { key: 'ratio', label: 'Payment limit as income (%)', initial: '30', min: '0.01' },
      { key: 'rate', label: 'Annual interest rate (%)', initial: '8', min: '0' },
      { key: 'years', label: 'Loan term (years)', initial: '20', min: '0.01' },
    ],
  },
}

export default function AdditionalCalculatorPage({ toolId, basePath, embedded }) {
  const definition = definitions[toolId]
  const { profile } = useAuth()
  const [currency, setCurrency] = useState(profile?.currencyCode || 'USD')
  const [values, setValues] = useState(() => Object.fromEntries((definition?.fields || []).map((field) => [field.key, field.initial])))
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const nextDefinition = definitions[toolId]
    setValues(Object.fromEntries((nextDefinition?.fields || []).map((field) => [field.key, field.initial])))
    setResults(null)
    setError('')
  }, [toolId])

  useEffect(() => {
    if (profile?.currencyCode && SUPPORTED_CURRENCIES.includes(profile.currencyCode)) setCurrency(profile.currencyCode)
  }, [profile?.currencyCode])

  function updateField(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
    setResults(null)
    setError('')
  }

  function calculate(event) {
    event.preventDefault()
    try {
      const calculated = calculateFinanceTool(toolId, values)
      if (calculated.some((result) => typeof result.value === 'number' && !Number.isFinite(result.value))) {
        throw new Error('These assumptions are too large to calculate. Try a smaller amount, rate, or time period.')
      }
      setResults(calculated)
      setError('')
    } catch (caught) {
      setResults(null)
      setError(caught.message || 'Check the values and try again.')
    }
  }

  function reset() {
    setValues(Object.fromEntries(definition.fields.map((field) => [field.key, field.initial])))
    setResults(null)
    setError('')
  }

  if (!definition) return null
  const money = (amount) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)

  return <ToolShell eyebrow="Plan with an estimate" title={definition.title} description={definition.description} basePath={basePath} embedded={embedded}>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card>
        <form onSubmit={calculate} className="space-y-4">
          <SelectField label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            {definition.fields.map((field) => <Field key={field.key} label={field.label} type="number" min={field.min ?? '0.01'} step={field.step || 'any'} value={values[field.key]} onChange={(event) => updateField(field.key, event.target.value)} required />)}
          </div>
          {error && <InlineError>{error}</InlineError>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit"><Calculator size={16} /> Calculate</Button>
            <Button type="button" variant="secondary" onClick={reset}><RotateCcw size={15} /> Reset</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="font-serif text-xl font-semibold text-[#23372b]">Your estimate</h2>
        {results ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {results.map((result) => <ToolResult key={result.label} label={result.label} value={typeof result.value === 'number' ? money(result.value) : result.value} />)}
        </div> : <div className="mt-4 rounded-xl bg-[#f6f8f4] p-4 text-sm leading-6 text-[#78857c]">Enter your assumptions, then calculate to see a planning estimate.</div>}
        <p className="mt-4 text-xs leading-5 text-[#89958c]">{definition.note}</p>
      </Card>
    </div>
  </ToolShell>
}
