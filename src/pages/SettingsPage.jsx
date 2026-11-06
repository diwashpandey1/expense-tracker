import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Bell, Check, LayoutDashboard, LogOut, Palette, RotateCcw, Save, Settings2, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { Button, Card, Field, InlineError, Modal, PageHeading } from '../components/ui'
import { resetFinanceData } from '../services/dataLifecycleService'
import { listAccounts } from '../services/ledgerService'
import { listCategories } from '../services/categoryService'

const currencies = ['USD','EUR','GBP','INR','NPR','AUD','CAD','JPY','CNY','SGD','CHF','NZD']
const sections = [
  { id: 'profile', label: 'Profile & account', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Settings2 },
  { id: 'budget', label: 'Budget & savings', icon: Check },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & data', icon: ShieldCheck },
]

export default function SettingsPage() {
  const { user, profile, logout, resetPassword, updateAccountProfile, deleteAccount } = useAuth()
  const { preferences: p, loading: prefsLoading, error: prefsLoadError, savedAt, updatePreferences, resetPreferences } = usePreferences()
  const navigate = useNavigate()
  const [section, setSection] = useState('profile')
  const [name, setName] = useState(profile.displayName)
  const [currency, setCurrency] = useState(profile.currencyCode)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState('')
  const [actionError, setActionError] = useState('')
  const [password, setPassword] = useState('')
  const [resetPhrase, setResetPhrase] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listAccounts(user.uid), listCategories(user.uid)])
      .then(([accountRows, categoryRows]) => { if (active) { setAccounts(accountRows); setCategories(categoryRows.filter((row) => !row.isArchived)) } })
      .catch((caught) => { if (active) setError(caught.message || 'Could not load your account and category choices.') })
    return () => { active = false }
  }, [user.uid])

  async function change(group, patch) {
    setNotice('')
    setError('')
    try { await updatePreferences(group, patch); setNotice('Preferences saved.') }
    catch (caught) { setError(caught.message || 'Could not save this preference.') }
  }

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await updateAccountProfile({ displayName: name, currencyCode: currency }); setNotice('Your profile was saved. Existing amounts were not converted.') }
    catch (caught) { setError(caught.message || 'Could not save your profile.') }
    finally { setBusy(false) }
  }

  async function sendReset() {
    setBusy(true); setError(''); setNotice('')
    try { await resetPassword(profile.email); setNotice(`Password reset instructions were sent to ${profile.email}.`) }
    catch (caught) { setError(caught.message || 'Could not send a password reset email.') }
    finally { setBusy(false) }
  }

  async function resetData(event) {
    event.preventDefault(); setActionBusy(true); setActionError('')
    try { await resetFinanceData(user.uid); resetPreferences(); setDialog(''); setResetPhrase(''); setNotice('Financial data was cleared. Your profile and categories were kept. Preferences returned to their defaults.') }
    catch (caught) { setActionError(caught.message || 'Data reset failed. Some records may remain; retry to finish clearing them.') }
    finally { setActionBusy(false) }
  }

  async function removeAccount(event) {
    event.preventDefault(); setActionBusy(true); setActionError('')
    try { await deleteAccount(password); navigate('/signup', { replace: true }) }
    catch (caught) { setActionError(caught.message || 'Account deletion did not finish. Your sign-in account is still active.') }
    finally { setActionBusy(false) }
  }

  async function signOut() { await logout(); navigate('/login') }
  const needsPassword = user.providerData.some((provider) => provider.providerId === 'password')
  const initials = profile.displayName.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()
  const activeSection = sections.find((item) => item.id === section)

  return <>
    <PageHeading eyebrow="Make AVORA yours" title="Settings" description="Personalize how the app looks, what it shows, and how you enter transactions."/>
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium lg:w-full ${section === id ? 'bg-[#eaf2e4] text-[#28543a]' : 'text-[#708075] hover:bg-white'}`}><Icon size={16}/>{label}</button>)}
      </nav>
      <div className="min-w-0 space-y-4">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-serif text-xl font-semibold text-[#23372b]">{activeSection?.label}</h2><p className="mt-1 text-sm text-[#849087]">Changes save automatically unless a form has a Save button.</p></div><span role="status" className="text-xs text-[#718177]">{prefsLoading ? 'Loading preferences…' : savedAt ? 'Saved just now' : 'Ready'}</span></div>
          {prefsLoadError && <InlineError>{`Could not load saved preferences. Defaults are active. ${prefsLoadError}`}</InlineError>}
          {error && <div className="mb-4"><InlineError>{error}</InlineError></div>}
          {notice && <p role="status" className="mb-4 rounded-xl bg-[#f1f7ed] px-4 py-3 text-sm text-[#476b45]">{notice}</p>}

          {section === 'profile' && <div className="space-y-5">
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dcecc9] font-bold text-[#365a3b]">{initials || 'U'}</span><div><p className="font-semibold text-[#293e31]">{profile.displayName}</p><p className="text-sm text-[#849087]">{profile.email}</p></div></div>
              <Field label="Display name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required/>
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#34463b]">Display currency</span><select className="w-full rounded-xl border border-[#dfe5dd] bg-white px-3.5 py-2.5 text-sm" value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((code) => <option key={code}>{code}</option>)}</select><span className="mt-1 block text-xs text-[#87938a]">This only changes display formatting; stored transactions are not converted.</span></label>
              <Button disabled={busy}><Save size={16}/>{busy ? 'Saving…' : 'Save profile'}</Button>
            </form>
            <div className="grid gap-3 rounded-xl bg-[#f6f8f4] p-4 sm:grid-cols-2"><Info label="Sign-in email" value={profile.email}/><Info label="Account created" value={user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Not available'}/><Info label="Sign-in provider" value={user.providerData.map((provider) => provider.providerId === 'google.com' ? 'Google' : 'Email and password').join(', ') || 'Firebase Authentication'}/></div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8ebe5] p-4"><div><p className="font-medium text-[#34463b]">Password reset</p><p className="mt-1 text-sm text-[#849087]">Send a reset link to your sign-in email.</p></div><Button variant="secondary" disabled={busy} onClick={sendReset}>Send reset link</Button></div>
          </div>}

          {section === 'appearance' && <div className="space-y-3">
            <Select label="Color theme" description="Choose light, dark, or follow your device setting." value={p.appearance.theme} onChange={(value) => change('appearance', { theme: value })} options={['system','light','dark']}/>
            <Select label="Accent color" description="Used for selected controls and highlights." value={p.appearance.accent} onChange={(value) => change('appearance', { accent: value })} options={['lime','sage','blue','rose','violet']}/>
            <Select label="Interface density" value={p.appearance.density} onChange={(value) => change('appearance', { density: value })} options={['comfortable','compact']}/>
            <Select label="Base font size" value={p.appearance.fontSize} onChange={(value) => change('appearance', { fontSize: value })} options={['small','normal','large']}/>
            <Toggle label="Collapse the sidebar" description="Keep navigation icons visible and give the workspace more room." checked={p.appearance.sidebarCollapsed} onChange={(value) => change('appearance', { sidebarCollapsed: value })}/>
            <Toggle label="Enable animations" description="Turn off interface motion and transitions when reduced motion is preferred." checked={p.appearance.animations} onChange={(value) => change('appearance', { animations: value })}/>
          </div>}

          {section === 'dashboard' && <div className="space-y-3">
            <Select label="Default dashboard period" value={p.dashboard.defaultPeriod} onChange={(value) => change('dashboard', { defaultPeriod: value })} options={['weekly','monthly','yearly','lifetime']} labels={['Weekly','Monthly','Yearly','Lifetime']}/>
            <Select label="Default analytics chart" value={p.dashboard.analyticsChartType} onChange={(value) => change('dashboard', { analyticsChartType: value })} options={['pie','bar','line']}/>
            <Select label="Recent transactions shown" value={String(p.dashboard.recentTransactionCount)} onChange={(value) => change('dashboard', { recentTransactionCount: Number(value) })} options={['5','10','20']}/>
            <div className="rounded-xl border border-[#e8ebe5] p-4"><h3 className="text-sm font-semibold text-[#34463b]">Summary card layout</h3><p className="mt-1 text-xs leading-5 text-[#849087]">Move the summary groups up or down and choose how much dashboard width each group uses.</p><div className="mt-3 space-y-2">{p.dashboard.widgetOrder.map((key, index) => {
              const label = { balance: 'Account balances', income: 'Income summaries', expenses: 'Expense summaries', savings: 'Savings summaries' }[key]
              return <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#f6f8f4] px-3 py-2.5"><span className="min-w-32 flex-1 text-sm font-medium text-[#405247]">{label}</span><div className="flex items-center gap-2"><button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => { const order = [...p.dashboard.widgetOrder]; [order[index - 1], order[index]] = [order[index], order[index - 1]]; change('dashboard', { widgetOrder: order }) }} className="rounded-lg border border-[#dfe5dd] bg-white p-2 text-[#45684a] disabled:opacity-35"><ArrowUp size={15}/></button><button type="button" aria-label={`Move ${label} down`} disabled={index === p.dashboard.widgetOrder.length - 1} onClick={() => { const order = [...p.dashboard.widgetOrder]; [order[index + 1], order[index]] = [order[index], order[index + 1]]; change('dashboard', { widgetOrder: order }) }} className="rounded-lg border border-[#dfe5dd] bg-white p-2 text-[#45684a] disabled:opacity-35"><ArrowDown size={15}/></button><select aria-label={`${label} width`} value={p.dashboard.widgetSizes[key]} onChange={(event) => change('dashboard', { widgetSizes: { [key]: event.target.value } })} className="rounded-lg border border-[#dfe5dd] bg-white px-2.5 py-2 text-sm"><option value="regular">Regular width</option><option value="wide">Wide</option></select></div></div>
            })}</div></div>
            <Toggle label="Hide amounts on the dashboard" description="Mask dashboard money labels while leaving other app sections visible. Use Privacy to hide amounts throughout AVORA." checked={p.dashboard.hideAmounts} onChange={(value) => change('dashboard', { hideAmounts: value })}/>
            {Object.entries({ balance: 'Account balances', income: 'Income summaries', expenses: 'Expense summaries', savings: 'Savings summaries', budgets: 'Budget check-in', goals: 'Savings goals', recentTransactions: 'Recent transactions', spendingBreakdown: 'Spending charts', forecast: 'Cash-flow forecast', insights: 'Spending insights' }).map(([key, label]) => <Toggle key={key} label={`Show ${label.toLowerCase()}`} checked={p.dashboard.widgets[key] !== false} onChange={(value) => change('dashboard', { widgets: { [key]: value } })}/>) }
          </div>}

          {section === 'transactions' && <div className="space-y-3">
            <Select label="Default transaction type" value={p.transactions.defaultType} onChange={(value) => change('transactions', { defaultType: value, defaultCategoryId: '' })} options={['expense','income','transfer']}/>
            <Select label="Default account" description="Only active accounts are listed; a missing account falls back to a valid account." value={accounts.some((row) => row.id === p.transactions.defaultAccountId) ? p.transactions.defaultAccountId : ''} onChange={(value) => change('transactions', { defaultAccountId: value })} options={['', ...accounts.map((row) => row.id)]} labels={['Use first valid account', ...accounts.map((row) => `${row.name} · ${row.classification}`)]}/>
            <Select label="Default category" description="A deleted or archived category falls back to the first available category for the selected type." value={categories.some((row) => row.id === p.transactions.defaultCategoryId) ? p.transactions.defaultCategoryId : ''} onChange={(value) => change('transactions', { defaultCategoryId: value })} options={['', ...categories.filter((row) => row.kind === (p.transactions.defaultType === 'income' ? 'income' : 'expense')).map((row) => row.id)]} labels={['Use first matching category', ...categories.filter((row) => row.kind === (p.transactions.defaultType === 'income' ? 'income' : 'expense')).map((row) => row.name)]}/>
            <Select label="Date format" value={p.transactions.dateFormat} onChange={(value) => change('transactions', { dateFormat: value })} options={['iso','us','eu','locale']}/>
            <Select label="Week starts on" value={p.transactions.weekStartsOn} onChange={(value) => change('transactions', { weekStartsOn: value })} options={['monday','sunday']}/>
            <Select label="Transaction list spacing" value={p.transactions.listView} onChange={(value) => change('transactions', { listView: value })} options={['comfortable','compact']}/>
            <Select label="Default transaction sorting" value={p.transactions.sort} onChange={(value) => change('transactions', { sort: value })} options={['newest','oldest','amount-high','amount-low']}/>
            <Toggle label="Confirm before saving a transaction" description="Review the entry in a confirmation dialog before posting it to account balances." checked={p.transactions.confirmBeforeSave} onChange={(value) => change('transactions', { confirmBeforeSave: value })}/>
          </div>}

          {section === 'budget' && <div className="space-y-3">
            <div className="rounded-xl border border-[#e8ebe5] p-4"><label htmlFor="budget-threshold" className="flex justify-between gap-3 text-sm font-medium text-[#34463b]"><span>Budget warning threshold</span><span>{p.budget.warningThreshold}%</span></label><input id="budget-threshold" type="range" min="50" max="95" step="5" value={p.budget.warningThreshold} onChange={(event) => change('budget', { warningThreshold: Number(event.target.value) })} className="mt-3 w-full accent-[#6d965f]"/><p className="mt-1 text-xs text-[#849087]">A warning appears at this percentage. The 100% exceeded status remains fixed.</p></div>
            <Select label="Budget progress display" value={p.budget.progressDisplay} onChange={(value) => change('budget', { progressDisplay: value })} options={['bar','ring','both']}/>
            <Select label="Default budget period" value={p.budget.defaultPeriod} onChange={(value) => change('budget', { defaultPeriod: value })} options={['monthly','yearly']}/>
            <Toggle label="Budget threshold alerts" checked={p.notifications.budgetThreshold} onChange={(value) => change('notifications', { budgetThreshold: value })}/>
            <Toggle label="Overspending alerts" description="In-app notices are shown when actual spending exceeds a budget." checked={p.notifications.overspending} onChange={(value) => change('notifications', { overspending: value })}/>
            <Toggle label="Savings goal reminders" checked={p.notifications.savingsGoalReminders} onChange={(value) => change('notifications', { savingsGoalReminders: value })}/>
          </div>}

          {section === 'notifications' && <div className="space-y-3">
            <p className="rounded-xl bg-[#f6f8f4] p-4 text-sm leading-6 text-[#65756a]">AVORA uses in-app reminders when you open the app. Browser push and scheduled delivery are not enabled; this keeps notifications within the Firebase Spark browser-only setup.</p>
            <Toggle label="Budget threshold alerts" description="Show budget warnings starting at your chosen threshold." checked={p.notifications.budgetThreshold} onChange={(value) => change('notifications', { budgetThreshold: value })}/>
            <Toggle label="Overspending alerts" description="Show an alert when expenses pass a budget limit." checked={p.notifications.overspending} onChange={(value) => change('notifications', { overspending: value })}/>
            <Toggle label="Recurring transaction reminders" description="Show pending recurring income and unfunded scheduled expenses in the Recurring section." checked={p.notifications.recurringReminders} onChange={(value) => change('notifications', { recurringReminders: value })}/>
            <Toggle label="Savings goal reminders" checked={p.notifications.savingsGoalReminders} onChange={(value) => change('notifications', { savingsGoalReminders: value })}/>
            <Toggle label="Monthly financial summary" description="Show the current month summary on the dashboard." checked={p.notifications.monthlySummary} onChange={(value) => change('notifications', { monthlySummary: value })}/>
          </div>}

          {section === 'privacy' && <div className="space-y-4">
            <Toggle label="Hide financial amounts" description="Mask money values wherever AVORA formats them. This does not change stored data or calculations." checked={p.privacy.hideBalances} onChange={(value) => change('privacy', { hideBalances: value })}/>
            <div className="rounded-xl border border-[#e8ebe5] p-4"><h3 className="font-semibold text-[#293e31]">Your data and identity</h3><p className="mt-2 text-sm leading-6 text-[#78857c]">Firebase Authentication manages your sign-in. Firestore Rules scope settings and finance records to your account UID. No profile image upload or file storage is used.</p></div>
            <div className="rounded-xl border border-[#e8ebe5] p-4"><h3 className="font-semibold text-[#293e31]">Data controls</h3><p className="mt-2 text-sm leading-6 text-[#78857c]">Reset removes financial records, accounts, schedules, and preferences while keeping your profile and categories. Delete permanently removes associated Firestore records and your Firebase Authentication identity.</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setDialog('reset'); setActionError(''); setResetPhrase('') }}><RotateCcw size={16}/>Reset data</Button><Button variant="danger" onClick={() => { setDialog('delete'); setPassword(''); setActionError('') }}><Trash2 size={16}/>Delete account</Button></div></div>
            <Button variant="secondary" className="w-full" onClick={signOut}><LogOut size={16}/>Sign out</Button>
          </div>}
        </Card>
      </div>
    </div>
    {dialog === 'reset' && <Modal title="Reset finance data?" description="This permanently clears accounts, transactions, budgets, savings goals, recurring schedules, and preferences. Type RESET to confirm. Your profile and categories will remain." onClose={() => !actionBusy && setDialog('')}><form onSubmit={resetData} className="space-y-4"><Field label="Type RESET to confirm" autoComplete="off" value={resetPhrase} onChange={(event) => setResetPhrase(event.target.value)} required/>{actionError && <InlineError>{actionError}</InlineError>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={actionBusy} onClick={() => setDialog('')}>Cancel</Button><Button variant="danger" disabled={actionBusy || resetPhrase !== 'RESET'}>{actionBusy ? 'Clearing…' : 'Reset finance data'}</Button></div></form></Modal>}
    {dialog === 'delete' && <Modal title="Delete your account?" description="This permanently removes your account and its Firestore data. Every document is deleted in bounded batches before Firebase Authentication removes the identity." onClose={() => !actionBusy && setDialog('')}><form onSubmit={removeAccount} className="space-y-4">{needsPassword ? <Field label="Confirm with your account password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/> : <p className="rounded-xl bg-[#f4f6f2] p-3 text-sm leading-6 text-[#66756a]">Google will ask you to confirm your identity in a popup.</p>}{actionError && <InlineError>{actionError}</InlineError>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={actionBusy} onClick={() => setDialog('')}>Cancel</Button><Button variant="danger" disabled={actionBusy || (needsPassword && !password)}>{actionBusy ? 'Deleting…' : 'Delete account'}</Button></div></form></Modal>}
  </>
}

function Info({ label, value }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-[#849087]">{label}</p><p className="mt-1 break-all text-sm text-[#34463b]">{value}</p></div> }

function Toggle({ label, description, checked, onChange }) {
  return <div className="flex items-start justify-between gap-4 rounded-xl border border-[#e8ebe5] p-4"><span><span className="block text-sm font-medium text-[#34463b]">{label}</span>{description && <span className="mt-1 block text-xs leading-5 text-[#849087]">{description}</span>}</span><button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#608454] ${checked ? 'bg-[#47734b]' : 'bg-[#cbd3cc]'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
}

function Select({ label, description, value, onChange, options, labels = options }) {
  return <label className="block rounded-xl border border-[#e8ebe5] p-4"><span className="block text-sm font-medium text-[#34463b]">{label}</span>{description && <span className="mt-1 block text-xs leading-5 text-[#849087]">{description}</span>}<select className="mt-2 w-full rounded-lg border border-[#dfe5dd] bg-white px-3 py-2.5 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={option || 'default'} value={option}>{labels[index] || option[0].toUpperCase() + option.slice(1).replaceAll('-', ' ')}</option>)}</select></label>
}
