import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Pause, Pencil, Play, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney, parseMoneyToMinor } from '../lib/money'
import { formatDateForDisplay, localDateString } from '../lib/dates'
import { listAccounts, InsufficientBalanceError } from '../services/ledgerService'
import { listCategories } from '../services/categoryService'
import { confirmRecurringExpense, confirmRecurringIncome, listRecurringOccurrences, listRecurringSchedules, processDueSchedules, saveRecurringSchedule, setRecurringStatus } from '../services/recurringService'
import { Button, Card, EmptyState, Field, InlineError, LoadingState, Modal, PageHeading, SelectField } from '../components/ui'

const blank = () => ({ name: '', kind: 'expense', amount: '', accountId: '', categoryId: '', frequency: 'monthly', intervalDays: 7, startOn: localDateString(), endOn: '' })

export default function RecurringPage() {
  const { user, profile } = useAuth()
  const { preferences } = usePreferences()
  const [schedules, setSchedules] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [funding, setFunding] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      await processDueSchedules(user.uid, profile.currencyCode)
      const [scheduleRows, accountRows, categoryRows] = await Promise.all([listRecurringSchedules(user.uid), listAccounts(user.uid), listCategories(user.uid)])
      const occurrenceRows = await Promise.all(scheduleRows.map((schedule) => listRecurringOccurrences(user.uid, schedule.id)))
      setSchedules(scheduleRows)
      setOccurrences(occurrenceRows.flat())
      setAccounts(accountRows)
      setCategories(categoryRows)
      setError('')
    } catch (caught) { setError(caught.message || 'Could not load recurring schedules.') }
    finally { setLoading(false) }
  }, [user.uid, profile.currencyCode])
  useEffect(() => { refresh() }, [refresh])

  async function submit(event) {
    event.preventDefault()
    const category = categories.find((row) => row.id === form.categoryId)
    try {
      await saveRecurringSchedule(user.uid, {
        ...form,
        amountMinor: parseMoneyToMinor(form.amount, profile.currencyCode),
        categoryName: category?.name || '',
      })
      setForm(null)
      await refresh()
    } catch (caught) { setError(caught.message || 'Could not save this schedule.') }
  }

  async function toggle(schedule) {
    try { await setRecurringStatus(user.uid, schedule.id, schedule.status === 'active' ? 'paused' : 'active'); await refresh() }
    catch (caught) { setError(caught.message || 'Could not update this schedule.') }
  }

  async function cancelSchedule(schedule) {
    try { await setRecurringStatus(user.uid, schedule.id, 'cancelled'); await refresh() }
    catch (caught) { setError(caught.message || 'Could not cancel this schedule.') }
  }

  async function confirmIncome(occurrence) {
    try { await confirmRecurringIncome(user.uid, occurrence, profile.currencyCode); await refresh() }
    catch (caught) { setError(caught.message || 'Could not confirm income.') }
  }

  async function confirmExpense() {
    try { await confirmRecurringExpense(user.uid, funding.occurrence, profile.currencyCode, funding.accountId || null); setFunding(null); await refresh() }
    catch (caught) {
      if (caught instanceof InsufficientBalanceError) setFunding({ ...funding, accounts: caught.savingsAccounts, error: caught.message })
      else setError(caught.message || 'Could not post this expense.')
    }
  }

  const expenseCategories = categories.filter((row) => row.kind === 'expense')
  const incomeCategories = categories.filter((row) => row.kind === 'income')
  const reminderCount = preferences.notifications.recurringReminders
    ? occurrences.filter((row) => ['pending_confirmation', 'pending_funding'].includes(row.status)).length
    : 0
  return <><PageHeading eyebrow="Plan ahead" title="Recurring transactions" description="Due expenses post when funded. Scheduled income waits for your confirmation." action={<Button onClick={() => setForm(blank())}><Plus size={16}/>New schedule</Button>}/>
    {error && <div className="mb-4"><InlineError>{error}</InlineError></div>}
    {!loading && reminderCount > 0 && <Card className="mb-4 border-[#dce8d4] bg-[#f2f7ed]"><p className="text-sm font-semibold text-[#344b38]">{reminderCount} recurring {reminderCount === 1 ? 'item needs' : 'items need'} your review</p><p className="mt-1 text-xs text-[#687b69]">Confirm scheduled income or review expenses that need funding.</p></Card>}
    {loading ? <LoadingState/> : schedules.length ? <div className="space-y-4">{schedules.map((schedule) => {
      const due = occurrences.filter((row) => row.scheduleId === schedule.id)
      return <Card key={schedule.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><span className="rounded-xl bg-[#eff4e9] p-2.5 text-[#66864f]"><CalendarClock size={20}/></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#263a2f]">{schedule.name}</h2><p className="mt-1 text-xs capitalize text-[#849087]">{schedule.kind} · {schedule.frequency}{schedule.frequency === 'custom' ? ` every ${schedule.intervalDays} days` : ''} · {schedule.status}</p></div><div className="flex items-center gap-2"><span className="font-semibold text-[#304337]">{formatMoney(schedule.amountMinor, profile.currencyCode)}</span>{schedule.status !== 'cancelled' && <><button aria-label="Edit schedule" onClick={() => setForm({ ...schedule, amount: minorToInput(schedule.amountMinor, profile.currencyCode), endOn: schedule.endOn || '' })} className="rounded-lg p-2 text-[#63786a] hover:bg-[#f0f3ee]"><Pencil size={16}/></button><button aria-label={schedule.status === 'active' ? 'Pause schedule' : 'Resume schedule'} onClick={() => toggle(schedule)} className="rounded-lg p-2 text-[#63786a] hover:bg-[#f0f3ee]">{schedule.status === 'active' ? <Pause size={16}/> : <Play size={16}/>}</button><Button variant="subtle" onClick={() => cancelSchedule(schedule)}>Cancel</Button></>}</div></div><p className="mt-2 text-xs text-[#849087]">Next due {formatDateForDisplay(schedule.nextDueOn)} · {schedule.categoryName} · {accounts.find((item) => item.id === schedule.accountId)?.name || 'Account'}</p>
        {due.length > 0 && <div className="mt-4 space-y-2 border-t border-[#edf0eb] pt-3">{due.slice(0, 4).map((occurrence) => <div key={occurrence.id} className="flex flex-col gap-2 rounded-xl bg-[#f7f8f5] p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#405247]">{occurrence.dueOn} · {formatMoney(occurrence.amountMinor, profile.currencyCode)}</p><p className="mt-0.5 text-xs capitalize text-[#8a958d]">{occurrence.status.replaceAll('_', ' ')}{occurrence.errorMessage ? ` · ${occurrence.errorMessage}` : ''}</p></div>{occurrence.status === 'pending_confirmation' && <Button onClick={() => confirmIncome(occurrence)}>Confirm received</Button>}{occurrence.status === 'pending_funding' && <Button variant="secondary" onClick={() => setFunding({ occurrence, accounts: accounts.filter((item) => item.classification === 'savings'), accountId: '' })}>Review funding</Button>}</div>)}</div>}</div></div></Card>
    })}</div> : <Card><EmptyState icon={CalendarClock} title="No recurring schedules" description="Add rent, bills, or income schedules. Expected income stays pending until you confirm receipt." action={<Button onClick={() => setForm(blank())}>Create a schedule</Button>}/></Card>}

    {form && <Modal wide title={form.id ? 'Edit recurring schedule' : 'New recurring schedule'} onClose={() => setForm(null)}><form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Name" maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required/><SelectField label="Type" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, categoryId: '' })}><option value="expense">Expense</option><option value="income">Expected income</option></SelectField><Field label={`Amount (${profile.currencyCode})`} type="number" min="0.01" step="any" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required/><SelectField label="Account" value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} required><option value="">Choose account</option>{accounts.filter((row) => form.kind !== 'expense' || row.classification === 'spending').map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</SelectField><SelectField label="Category" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Choose category</option>{(form.kind === 'expense' ? expenseCategories : incomeCategories).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</SelectField><SelectField label="Frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom interval</option></SelectField>{form.frequency === 'custom' && <Field label="Interval in days" type="number" min="1" max="365" value={form.intervalDays} onChange={(event) => setForm({ ...form, intervalDays: Number(event.target.value) })} required/>}<Field label="Start date" type="date" value={form.startOn} onChange={(event) => setForm({ ...form, startOn: event.target.value })} required/><Field label="End date (optional)" type="date" value={form.endOn} onChange={(event) => setForm({ ...form, endOn: event.target.value })}/><div className="flex justify-end gap-2 pt-1 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Save schedule</Button></div></form></Modal>}
    {funding && <Modal title="Review recurring expense funding" description="This scheduled expense is still pending. Choose a savings account to atomically fund it, or cancel and leave it pending." onClose={() => setFunding(null)}><div className="space-y-4"><SelectField label="Savings account" value={funding.accountId} onChange={(event) => setFunding({ ...funding, accountId: event.target.value })}><option value="">Choose savings account</option>{funding.accounts.map((row) => <option key={row.id} value={row.id}>{row.name} · {formatMoney(BigInt(row.balanceMinor), profile.currencyCode)}</option>)}</SelectField>{funding.error && <InlineError>{funding.error}</InlineError>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFunding(null)}>Keep pending</Button><Button onClick={confirmExpense}>Transfer and post</Button></div></div></Modal>}
  </>
}

function minorToInput(value, currencyCode) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  const amount = BigInt(value)
  const scale = 10n ** BigInt(digits)
  return digits ? `${amount / scale}.${(amount % scale).toString().padStart(digits, '0')}` : String(amount)
}
