import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Banknote, Check, CircleHelp, CreditCard, Plus, ShieldCheck, Trash2, WalletCards } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { SUPPORTED_CURRENCIES } from '../constants/currencies'
import { Field, InlineError, SelectField } from '../components/ui'
import { localDateString } from '../lib/dates'
import { currencyExponent, parseNonnegativeMoneyToMinor } from '../lib/money'
import { ONBOARDING_STEPS, readOnboardingDraft, saveOnboardingDraft } from '../services/onboardingService'

const occupationOptions = ['Salaried employee', 'Business owner', 'Freelancer', 'Self-employed', 'Student', 'Homemaker', 'Retired', 'Currently unemployed', 'Other']
const incomeOptions = ['Monthly salary', 'Business income/profits', 'Freelancing', 'Investments', 'Rental income', 'Pension', 'Family support', 'Part-time work', 'Commission', 'Other', 'No regular income']
const channelOptions = ['Bank account', 'Physical cash', 'Digital wallet', 'Other']
const challengeOptions = ['Overspending', 'Difficulty saving', 'Not knowing where money goes', 'Managing multiple accounts', 'Managing irregular income', 'Managing debt', 'Planning monthly budgets', 'Tracking household expenses']
const goalOptions = ['Save more money', 'Control unnecessary spending', 'Build an emergency fund', 'Track monthly expenses', 'Save for education', 'Save for travel', 'Save for a vehicle', 'Save for a house', 'Pay off debt', 'Manage household finances', 'Understand spending habits', 'Build better financial discipline']
const countryChoices = [['NP', 'Nepal'], ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['CA', 'Canada'], ['JP', 'Japan'], ['CN', 'China'], ['SG', 'Singapore'], ['CH', 'Switzerland'], ['NZ', 'New Zealand'], ['OTHER', 'Other']]
const countryCurrency = { NP: 'NPR', IN: 'INR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', JP: 'JPY', CN: 'CNY', SG: 'SGD', CH: 'CHF', NZ: 'NZD' }
const accountCards = [
  { accountType: 'bank', classification: 'spending', title: 'Bank account', description: 'Salary, everyday banking, or another bank account', icon: Banknote },
  { accountType: 'cash', classification: 'spending', title: 'Physical cash', description: 'Cash wallet, home cash, or personal cash', icon: WalletCards },
  { accountType: 'ewallet', classification: 'spending', title: 'Digital wallet', description: 'A wallet app such as eSewa or Khalti', icon: CreditCard },
  { accountType: 'bank', classification: 'savings', title: 'Savings account', description: 'Money set aside for savings or emergencies', icon: ShieldCheck },
]

function ToggleCards({ options, value = [], onChange, multiple = true }) {
  const selected = Array.isArray(value) ? value : []
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => {
    const active = selected.includes(option)
    return <button key={option} type="button" aria-pressed={active} onClick={() => {
      const next = multiple ? (active ? selected.filter((item) => item !== option) : [...selected, option]) : [option]
      onChange(next)
    }} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${active ? 'border-[#6b9564] bg-[#edf4e8] text-[#24402f] shadow-sm' : 'border-[#e1e8df] bg-white text-[#526157] hover:border-[#a9bea1]'}`}><span>{option}</span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? 'border-[#56814e] bg-[#56814e] text-white' : 'border-[#cad4c8] text-transparent'}`}><Check size={12}/></span></button>
  })}</div>
}

function CardSelection({ items, selected, onSelect }) {
  return <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => {
    const active = selected === item
    return <button key={item} type="button" aria-pressed={active} onClick={() => onSelect(item)} className={`rounded-xl border p-4 text-left text-sm transition ${active ? 'border-[#6b9564] bg-[#edf4e8] text-[#24402f]' : 'border-[#e1e8df] bg-white text-[#526157] hover:border-[#a9bea1]'}`}>{item}</button>
  })}</div>
}

export default function OnboardingPage() {
  const { user, profile, finishOnboarding } = useAuth()
  const localeRegion = (() => { try { return new Intl.Locale(navigator.language).region || '' } catch { return '' } })()
  const suggestedCountry = countryChoices.some(([code]) => code === localeRegion) ? localeRegion : ''
  const suggestedCurrency = countryCurrency[suggestedCountry] || 'USD'
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(() => ({
    profile: { fullName: user?.displayName || profile?.fullName || profile?.displayName || '', displayName: profile?.displayName || user?.displayName || '', dateOfBirth: '', gender: '', countryCode: suggestedCountry, currencyCode: profile?.onboardingStatus === 'not_started' ? suggestedCurrency : SUPPORTED_CURRENCIES.includes(profile?.currencyCode) ? profile.currencyCode : suggestedCurrency, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
    income: { occupation: '', occupationOther: '', incomeSources: [], incomeFrequency: '', incomeEstimate: { mode: 'prefer_not_to_say', amount: '', range: '' }, incomeChannels: [] },
    habits: { trackingMethod: '', averageIncome: '', averageExpenditure: '', averageSavings: '', challenges: [] },
    household: { livingSituation: '', maritalStatus: '', householdSize: '', dependents: '', children: '', childrenCount: '', householdExpenses: '' },
    goals: { objectives: [], primaryObjective: '' },
    accounts: { items: [], trackingStartDate: localDateString() },
  }))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const currencyCode = answers.profile?.currencyCode || 'NPR'

  useEffect(() => {
    let active = true
    readOnboardingDraft(user.uid).then((draft) => {
      if (!active || !draft?.answers) return
      setAnswers((current) => ({ ...current, ...draft.answers, profile: { ...current.profile, ...draft.answers.profile }, accounts: { ...current.accounts, ...draft.answers.accounts } }))
      setStep(Math.min(Number(draft.currentStep) || 0, ONBOARDING_STEPS.length - 1))
    }).catch((caught) => { if (active) setError(caught.message || 'We could not load your saved setup.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.uid])

  const setSection = (section, patch) => setAnswers((current) => ({ ...current, [section]: { ...current[section], ...patch } }))
  const totalOpening = useMemo(() => answers.accounts.items.reduce((sum, account) => {
    try { return sum + BigInt(parseNonnegativeMoneyToMinor(String(account.openingBalance || '0'), currencyCode)) }
    catch { return sum }
  }, 0n), [answers.accounts.items, currencyCode])
  const formattedTotal = (() => {
    try { return formatRawMoney(totalOpening, currencyCode) } catch { return `${totalOpening} ${currencyCode}` }
  })()

  function addAccount(card) {
    const defaults = { bank: 'Main bank account', cash: 'Cash wallet', ewallet: 'Digital wallet', savings: 'Savings account' }
    const accountType = card.accountType
    setSection('accounts', { items: [...answers.accounts.items, { id: crypto.randomUUID(), name: defaults[card.classification === 'savings' ? 'savings' : accountType], accountType, classification: card.classification, openingBalance: '0', provider: '', description: '', purpose: card.classification === 'savings' ? 'Savings' : '' }] })
  }

  function updateAccount(index, patch) {
    setSection('accounts', { items: answers.accounts.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  }

  async function goTo(next) {
    setError('')
    setBusy(true)
    try {
      await saveOnboardingDraft(user.uid, next, answers)
      setStep(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) { setError(caught.message || 'Your progress could not be saved. Please try again.') }
    finally { setBusy(false) }
  }

  async function finish() {
    setError('')
    if (!confirmed) { setError('Confirm that you reviewed the starting balances and profile details.'); return }
    if (!answers.income.occupation) { setError('Choose an occupation option, including Other if none of these fit.'); setStep(1); return }
    if (!answers.accounts.items.length) { setError('Add at least one account. A zero opening balance is allowed.'); setStep(5); return }
    setBusy(true)
    try {
      await saveOnboardingDraft(user.uid, 6, answers)
      await finishOnboarding(answers)
    } catch (caught) { setError(caught.message || 'We could not complete your setup. Your answers are saved so you can try again.') }
    finally { setBusy(false) }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f5f7f3] text-sm text-[#748278]">Loading your saved setup…</main>
  const section = ONBOARDING_STEPS[step]
  const title = ['Let’s set up your profile', 'How do you earn money?', 'Your money habits so far', 'A little about your household', 'What would you like to work toward?', 'Where do you keep your money?', 'Review your starting point'][step]
  const subtitle = ['These basics personalize your account. Sensitive details are optional.', 'Your answers help us personalize planning; they never create income transactions.', 'These are historical estimates only. They will never appear in your transaction history.', 'Every household question is optional.', 'Choose the priorities that matter to you. These will not create savings goals.', `Add the places where you currently keep money. Accounts use ${currencyCode}; mixed-currency balances and transfers are not enabled yet. Zero balance is okay.`, 'Check your details and starting balances before we create your Avora workspace.'][step]

  return <main className="min-h-screen bg-[#f5f7f3] px-4 py-6 text-[#25382d] sm:px-6 sm:py-10">
    <div className="mx-auto max-w-4xl">
      <header className="mb-7 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#718b76]">AVORA · FIRST-TIME SETUP</p><p className="mt-1 text-xs text-[#859188]">Your answers stay private to your account.</p></div><div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#68776c]">Step {step + 1} of {ONBOARDING_STEPS.length}</div></header>
      <div className="mb-8"><div className="mb-2 flex justify-between gap-2">{ONBOARDING_STEPS.map((item, index) => <div key={item.id} className={`hidden text-xs font-semibold sm:block ${index <= step ? 'text-[#446b49]' : 'text-[#a2aaa3]'}`}>{item.label}</div>)}</div><div className="h-2 overflow-hidden rounded-full bg-[#e5ebe2]"><div className="h-full rounded-full bg-[#80a66c] transition-all duration-300" style={{ width: `${((step + 1) / ONBOARDING_STEPS.length) * 100}%` }}/></div><p className="mt-2 text-xs font-semibold text-[#738176] sm:hidden">{section.label}</p></div>
      <section className="rounded-3xl border border-[#e4e9e1] bg-white p-5 shadow-[0_16px_48px_rgba(31,56,40,.07)] sm:p-9">
        <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -7 }} transition={{ duration: 0.16 }}>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#7d947f]">{section.label}</p><h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#1e3428] sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#78857c]">{subtitle}</p>

          {step === 0 && <div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="Full name" value={answers.profile.fullName} onChange={(event) => setSection('profile', { fullName: event.target.value })} maxLength={100} autoComplete="name" required/><Field label="Display name (optional)" value={answers.profile.displayName} onChange={(event) => setSection('profile', { displayName: event.target.value })} maxLength={100}/><Field label="Date of birth (optional)" type="date" value={answers.profile.dateOfBirth} onChange={(event) => setSection('profile', { dateOfBirth: event.target.value })}/><SelectField label="Gender (optional)" value={answers.profile.gender} onChange={(event) => setSection('profile', { gender: event.target.value })}><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Other</option></SelectField><SelectField label={suggestedCountry ? 'Country (confirm detected suggestion)' : 'Country (choose manually)'} value={answers.profile.countryCode} onChange={(event) => setSection('profile', { countryCode: event.target.value })}><option value="">Choose country</option>{countryChoices.map(([code, name]) => <option key={code} value={code}>{name}{code === suggestedCountry ? ' · detected suggestion' : ''}</option>)}</SelectField><SelectField label="Primary currency" value={currencyCode} onChange={(event) => setSection('profile', { currencyCode: event.target.value })} required>{SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}</SelectField><Field label="Timezone" value={answers.profile.timeZone} onChange={(event) => setSection('profile', { timeZone: event.target.value })} placeholder="Asia/Kathmandu"/></div>}

          {step === 1 && <div className="mt-7 space-y-6"><SelectField label="What best describes your current occupation?" value={answers.income.occupation} onChange={(event) => setSection('income', { occupation: event.target.value })} required><option value="">Choose an option</option>{occupationOptions.map((option) => <option key={option}>{option}</option>)}</SelectField>{answers.income.occupation === 'Other' && <Field label="Occupation (optional description)" value={answers.income.occupationOther} onChange={(event) => setSection('income', { occupationOther: event.target.value })} maxLength={100}/>}<div><p className="mb-2 text-sm font-semibold">Income sources (select any that apply)</p><ToggleCards options={incomeOptions} value={answers.income.incomeSources} onChange={(incomeSources) => setSection('income', { incomeSources })}/></div><SelectField label="How often do you receive income? (optional)" value={answers.income.incomeFrequency} onChange={(event) => setSection('income', { incomeFrequency: event.target.value })}><option value="">Choose frequency</option>{['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Multiple times per month', 'Irregularly', 'Seasonally', 'No regular schedule'].map((option) => <option key={option}>{option}</option>)}</SelectField><div><p className="mb-2 text-sm font-semibold">Approximate monthly income</p><div className="mb-3 grid gap-2 sm:grid-cols-3"><CardSelection items={['Exact estimate', 'Income range', 'Prefer not to say']} selected={answers.income.incomeEstimate.mode === 'exact' ? 'Exact estimate' : answers.income.incomeEstimate.mode === 'range' ? 'Income range' : 'Prefer not to say'} onSelect={(choice) => setSection('income', { incomeEstimate: { ...answers.income.incomeEstimate, mode: choice === 'Exact estimate' ? 'exact' : choice === 'Income range' ? 'range' : 'prefer_not_to_say' } })}/></div>{answers.income.incomeEstimate.mode === 'exact' && <Field label={`Approximate monthly income (${currencyCode})`} type="number" min="0" step="any" value={answers.income.incomeEstimate.amount} onChange={(event) => setSection('income', { incomeEstimate: { ...answers.income.incomeEstimate, amount: event.target.value } })}/ >}{answers.income.incomeEstimate.mode === 'range' && <SelectField label="Choose a monthly range" value={answers.income.incomeEstimate.range} onChange={(event) => setSection('income', { incomeEstimate: { ...answers.income.incomeEstimate, range: event.target.value } })}><option value="">Choose a range</option><option>Under 25,000</option><option>25,000–50,000</option><option>50,001–100,000</option><option>100,001–250,000</option><option>Over 250,000</option></SelectField>}</div><div><p className="mb-2 text-sm font-semibold">Where do you usually receive income?</p><ToggleCards options={channelOptions} value={answers.income.incomeChannels} onChange={(incomeChannels) => setSection('income', { incomeChannels })}/></div></div>}

          {step === 2 && <div className="mt-7 space-y-6"><SelectField label="How did you previously track your finances? (optional)" value={answers.habits.trackingMethod} onChange={(event) => setSection('habits', { trackingMethod: event.target.value })}><option value="">Choose one</option>{['Spreadsheets', 'Another finance application', 'Tracked manually', 'Remembered mentally', 'Did not track', 'Other'].map((option) => <option key={option}>{option}</option>)}</SelectField><div className="grid gap-4 sm:grid-cols-3"><Field label={`Past average monthly income (${currencyCode})`} type="number" min="0" step="any" value={answers.habits.averageIncome} onChange={(event) => setSection('habits', { averageIncome: event.target.value })}/><Field label={`Past average monthly expenditure (${currencyCode})`} type="number" min="0" step="any" value={answers.habits.averageExpenditure} onChange={(event) => setSection('habits', { averageExpenditure: event.target.value })}/><Field label={`Past average monthly savings (${currencyCode})`} type="number" min="0" step="any" value={answers.habits.averageSavings} onChange={(event) => setSection('habits', { averageSavings: event.target.value })}/></div><div className="rounded-xl bg-[#f5f8f2] p-4 text-sm leading-6 text-[#68776d]"><CircleHelp className="mr-2 inline" size={16}/>These figures are just historical estimates. They will not change your account balance, income, or expenses.</div><div><p className="mb-2 text-sm font-semibold">What would you like help with?</p><ToggleCards options={challengeOptions} value={answers.habits.challenges} onChange={(challenges) => setSection('habits', { challenges })}/></div></div>}

          {step === 3 && <div className="mt-7 space-y-5"><SelectField label="Living situation (optional)" value={answers.household.livingSituation} onChange={(event) => setSection('household', { livingSituation: event.target.value })}><option value="">Skip this question</option>{['Living alone', 'Living with family', 'Living with a partner', 'Shared accommodation', 'Other'].map((option) => <option key={option}>{option}</option>)}</SelectField><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Marital status (optional)" value={answers.household.maritalStatus} onChange={(event) => setSection('household', { maritalStatus: event.target.value })}><option value="">Prefer not to say</option><option>Single</option><option>Married</option><option>Other</option></SelectField><Field label="Household size (optional)" type="number" min="1" max="99" value={answers.household.householdSize} onChange={(event) => setSection('household', { householdSize: event.target.value })}/><Field label="Number of dependents (optional)" type="number" min="0" max="99" value={answers.household.dependents} onChange={(event) => setSection('household', { dependents: event.target.value })}/><SelectField label="Children (optional)" value={answers.household.children} onChange={(event) => setSection('household', { children: event.target.value })}><option value="">Prefer not to say</option><option>Yes</option><option>No</option></SelectField>{answers.household.children === 'Yes' && <Field label="Number of children (optional)" type="number" min="0" max="99" value={answers.household.childrenCount} onChange={(event) => setSection('household', { childrenCount: event.target.value })}/>}</div><SelectField label="Do you manage household expenses? (optional)" value={answers.household.householdExpenses} onChange={(event) => setSection('household', { householdExpenses: event.target.value })}><option value="">Skip this question</option><option>Yes, entirely</option><option>Partially</option><option>No</option></SelectField><p className="text-xs text-[#849087]">We do not collect identifying information about family members.</p></div>}

          {step === 4 && <div className="mt-7 space-y-5"><div><p className="mb-2 text-sm font-semibold">Select any goals you want help with</p><ToggleCards options={goalOptions} value={answers.goals.objectives} onChange={(objectives) => setSection('goals', { objectives, primaryObjective: objectives.includes(answers.goals.primaryObjective) ? answers.goals.primaryObjective : '' })}/></div>{answers.goals.objectives.length > 0 && <SelectField label="Your primary objective (optional)" value={answers.goals.primaryObjective} onChange={(event) => setSection('goals', { primaryObjective: event.target.value })}><option value="">Choose later</option>{answers.goals.objectives.map((objective) => <option key={objective}>{objective}</option>)}</SelectField>}<div className="rounded-xl bg-[#f5f8f2] p-4 text-sm leading-6 text-[#68776d]">These preferences personalize your workspace. We will not create savings goals until you set a target and explicitly create one.</div></div>}

          {step === 5 && <div className="mt-7 space-y-5"><div><p className="mb-1 text-sm font-semibold">Where do you currently keep your money?</p><p className="mb-3 text-xs text-[#818d84]">Add every place you want to track. You do not need a bank account.</p><div className="grid gap-2 sm:grid-cols-2">{accountCards.map((card) => <button key={card.title} type="button" onClick={() => addAccount(card)} className="flex min-h-20 items-center gap-3 rounded-xl border border-[#e1e8df] bg-white p-4 text-left transition hover:border-[#90aa87] hover:bg-[#f8faf6]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf4e8] text-[#53794d]"><card.icon size={19}/></span><span><span className="block text-sm font-semibold">{card.title}</span><span className="mt-1 block text-xs leading-5 text-[#87938a]">{card.description}</span></span><Plus className="ml-auto shrink-0 text-[#6b8d62]" size={17}/></button>)}</div></div>{!answers.accounts.items.length && <div className="rounded-xl border border-[#eadfbd] bg-[#fffaf0] p-4 text-sm text-[#756a4e]">No bank account? Start with a Physical Cash wallet. You can add or transfer between accounts any time.</div>}{answers.accounts.items.map((account, index) => <div key={account.id} className="rounded-2xl border border-[#e4e9e1] bg-[#fbfcfa] p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs capitalize text-[#849087]">{account.accountType === 'ewallet' ? 'Digital wallet' : account.accountType === 'cash' ? 'Physical cash' : account.classification === 'savings' ? 'Savings account' : 'Bank account'} · {account.classification}</p></div><button type="button" aria-label="Remove account" onClick={() => setSection('accounts', { items: answers.accounts.items.filter((_, itemIndex) => index !== itemIndex) })} className="rounded-lg p-2 text-[#8a706b] hover:bg-[#f8eeee]"><Trash2 size={16}/></button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Account name" value={account.name} onChange={(event) => updateAccount(index, { name: event.target.value })} maxLength={80} required/><Field label={`How much money do you currently have? (${currencyCode})`} type="number" min="0" step="any" inputMode="decimal" value={account.openingBalance} onChange={(event) => updateAccount(index, { openingBalance: event.target.value })} required/><Field label="Bank or wallet provider (optional)" value={account.provider} onChange={(event) => updateAccount(index, { provider: event.target.value })} maxLength={80}/><SelectField label="Purpose (optional)" value={account.purpose} onChange={(event) => updateAccount(index, { purpose: event.target.value })}><option value="">Choose purpose</option>{['Daily spending', 'Salary account', 'Savings', 'Emergency fund', 'Household expenses', 'Business-related funds', 'Other'].map((purpose) => <option key={purpose}>{purpose}</option>)}</SelectField><Field label="Account description (optional)" value={account.description} onChange={(event) => updateAccount(index, { description: event.target.value })} maxLength={240}/><SelectField label="Account subtype (optional)" value={account.subtype || ''} onChange={(event) => updateAccount(index, { subtype: event.target.value })}><option value="">Not specified</option>{['Savings', 'Current', 'Salary', 'Cash wallet', 'Home cash', 'Personal cash', 'Other'].map((subtype) => <option key={subtype}>{subtype}</option>)}</SelectField></div></div>)}{answers.accounts.items.length > 0 && <div className="grid gap-4 sm:grid-cols-2"><Field label="Tracking start date" type="date" value={answers.accounts.trackingStartDate} onChange={(event) => setSection('accounts', { trackingStartDate: event.target.value })} required/><div className="flex items-end rounded-xl bg-[#eef4e9] px-4 py-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#7a8978]">Combined opening balance</p><p className="mt-1 text-lg font-bold text-[#2b5134]">{formattedTotal}</p></div></div></div>}<div className="rounded-xl bg-[#f5f8f2] p-4 text-sm leading-6 text-[#68776d]">Your opening balance is money already in this account when tracking starts. It is recorded as a starting balance, not new income. We never ask for account numbers, cards, PINs, or passwords.</div></div>}

          {step === 6 && <div className="mt-7 space-y-5"><div className="grid gap-3 sm:grid-cols-2"><ReviewCard label="Full name" value={answers.profile.fullName}/><ReviewCard label="Currency" value={currencyCode}/><ReviewCard label="Country" value={countryChoices.find(([code]) => code === answers.profile.countryCode)?.[1] || 'Not provided'}/><ReviewCard label="Occupation" value={answers.income.occupation || 'Not selected'}/><ReviewCard label="Income sources" value={answers.income.incomeSources.join(', ') || 'Not provided'}/><ReviewCard label="Monthly income estimate" value={answers.income.incomeEstimate.mode === 'exact' ? `${answers.income.incomeEstimate.amount} ${currencyCode}` : answers.income.incomeEstimate.mode === 'range' ? `${answers.income.incomeEstimate.range} ${currencyCode}` : 'Prefer not to say'}/><ReviewCard label="Previous tracking" value={answers.habits.trackingMethod || 'Not provided'}/><ReviewCard label="Primary objective" value={answers.goals.primaryObjective || 'Not selected'}/><ReviewCard label="Other selected objectives" value={answers.goals.objectives.filter((item) => item !== answers.goals.primaryObjective).join(', ') || 'None selected'}/><ReviewCard label="Household size" value={answers.household.householdSize || 'Not provided'}/><ReviewCard label="Past average income" value={answers.habits.averageIncome ? `${answers.habits.averageIncome} ${currencyCode}` : 'Not provided'}/><ReviewCard label="Past average expenditure" value={answers.habits.averageExpenditure ? `${answers.habits.averageExpenditure} ${currencyCode}` : 'Not provided'}/><ReviewCard label="Past average savings" value={answers.habits.averageSavings ? `${answers.habits.averageSavings} ${currencyCode}` : 'Not provided'}/></div><div className="rounded-2xl border border-[#e4e9e1] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Your accounts</h2><span className="text-xs text-[#7d897f]">Start date: {answers.accounts.trackingStartDate}</span></div>{answers.accounts.items.length ? <div className="divide-y divide-[#edf0eb]">{answers.accounts.items.map((account) => <div key={account.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{account.name}</p><p className="mt-1 text-xs capitalize text-[#839087]">{account.accountType} · {account.classification}</p></div><p className="shrink-0 text-sm font-semibold">{(() => { try { return formatRawMoney(parseNonnegativeMoneyToMinor(account.openingBalance || '0', currencyCode), currencyCode) } catch { return `Invalid amount` } })()}</p></div>)}</div> : <p className="text-sm text-rose-700">You need at least one account before completing setup.</p>}<div className="mt-3 flex justify-between border-t border-[#edf0eb] pt-3 text-sm font-bold"><span>Total opening balance</span><span>{formattedTotal}</span></div></div><button type="button" role="checkbox" aria-checked={confirmed} onClick={() => setConfirmed((current) => !current)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm leading-6 transition ${confirmed ? 'border-[#8eaa82] bg-[#eef5e9] text-[#435a46]' : 'border-[#e2e8df] bg-[#f8faf7] text-[#526157] hover:border-[#a8bca0]'}`}><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${confirmed ? 'bg-[#5d8554] text-white' : 'border border-[#cbd6c9] bg-white text-transparent'}`}><Check size={15}/></span><span>I reviewed my setup. These opening balances are what I currently have, and they are not new income.</span></button></div>}
        </motion.div></AnimatePresence>
        <div className="mt-8"><InlineError>{error}</InlineError><div className="mt-4 flex flex-col-reverse justify-between gap-3 sm:flex-row">{step > 0 ? <button type="button" onClick={() => goTo(step - 1)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dfe6dd] px-4 text-sm font-semibold text-[#536358] hover:bg-[#f5f7f3]"><ArrowLeft size={16}/>Back</button> : <span/>}{step < 6 ? <button type="button" onClick={() => goTo(step + 1)} disabled={busy || (step === 0 && !answers.profile.fullName.trim()) || (step === 1 && !answers.income.occupation)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#28573f] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#35694c] disabled:opacity-50">{busy ? 'Saving progress…' : <>Continue <ArrowRight size={16}/></>}</button> : <button type="button" onClick={finish} disabled={busy || !confirmed || !answers.accounts.items.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#28573f] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#35694c] disabled:opacity-50">{busy ? 'Creating your workspace…' : <>Complete setup <Check size={16}/></>}</button>}</div></div>
      </section><p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-5 text-[#89948c]">No bank connection required · Your financial profile is private to your Firebase account · You can add accounts and move money later</p>
    </div>
  </main>
}

function ReviewCard({ label, value }) {
  return <div className="rounded-xl bg-[#f7f9f5] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#849087]">{label}</p><p className="mt-1 text-sm font-medium text-[#3a4c40]">{value || 'Not provided'}</p></div>
}

function formatRawMoney(minorValue, currencyCode) {
  const exponent = currencyExponent(currencyCode)
  const scale = 10 ** exponent
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: exponent }).format(Number(minorValue) / scale)
}
