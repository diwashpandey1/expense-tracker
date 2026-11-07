import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Target, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney, parseMoneyToMinor } from '../lib/money'
import { formatDateForDisplay, localDateString } from '../lib/dates'
import { createGoal, deleteGoal, listGoals, updateGoal } from '../services/goalService'
import { listGoalAllocations, setGoalAllocation } from '../services/goalAllocationService'
import { Button, Card, EmptyState, Field, InlineError, LoadingState, Modal, PageHeading } from '../components/ui'
import { toast } from 'sonner'

function loadErrorMessage(error) {
  if (error?.code === 'permission-denied') return 'Firestore denied this read. Check that the new project has the latest firestore.rules deployed.'
  if (error?.code === 'failed-precondition') return 'Firestore needs an index for this query. Deploy firestore.indexes.json, then retry.'
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') return 'The connection to Firestore is unavailable. Check your connection and retry.'
  return 'Savings goals could not be loaded. Retry the request.'
}

export default function GoalsPage() {
  const { user, profile } = useAuth()
  const { preferences } = usePreferences()
  const [goals, setGoals] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [allocationForm, setAllocationForm] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [error, setError] = useState('')
  const [today, setToday] = useState('')
  const refresh = useCallback(async () => {
    setError('')
    const [goalResult, allocationResult] = await Promise.allSettled([
      listGoals(user.uid),
      listGoalAllocations(user.uid),
    ])
    if (goalResult.status === 'fulfilled') setGoals(goalResult.value)
    else setError(loadErrorMessage(goalResult.reason))
    if (allocationResult.status === 'fulfilled') setAllocations(allocationResult.value)
    else setError((current) => current || `Savings allocations are unavailable. ${loadErrorMessage(allocationResult.reason)}`)
    setLoading(false)
  }, [user.uid])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { setToday(localDateString()) }, [])
  async function submit(event) { event.preventDefault(); try { await createGoal(user.uid, { name: form.name, targetMinor: parseMoneyToMinor(form.amount, profile.currencyCode), targetDate: form.targetDate || null }); setForm(null); setError(''); await refresh() } catch (caught) { setError(caught.message || 'Could not create goal.') } }
  async function submitAllocation(event) { event.preventDefault(); try { await setGoalAllocation(user.uid, allocationForm.goal.id, parseMoneyToMinor(allocationForm.amount, profile.currencyCode)); setAllocationForm(null); setError(''); await refresh() } catch (caught) { setError(caught.message || 'Could not save allocation.') } }
  async function finish(goal) { try { await updateGoal(user.uid, goal.id, { status: goal.status === 'completed' ? 'active' : 'completed' }); await refresh() } catch { setError('Could not update goal.') } }
  async function remove(goal) {
    if (BigInt(allocations.find((row) => row.goalId === goal.id)?.amountMinor || '0') > 0n) {
      toast.error('This goal still has savings allocated.', { description: 'Release its allocation before deleting it.' })
      return
    }
    setDeleteTarget(goal)
  }
  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteGoal(user.uid, deleteTarget.id)
      setDeleteTarget(null)
      toast.success('Savings goal deleted.')
      await refresh()
    } catch (caught) {
      toast.error('Could not delete the savings goal.', { description: caught.message || 'Try again.' })
    } finally { setDeleteBusy(false) }
  }
  const todayTimestamp = today ? Date.parse(`${today}T00:00:00`) : 0
  const reminderGoals = goals.filter((goal) => goal.status === 'active' && today && goal.targetDate && goal.targetDate >= today && (Date.parse(`${goal.targetDate}T00:00:00`) - todayTimestamp) / 86400000 <= 30 && BigInt(goal.targetMinor) > BigInt(allocations.find((row) => row.goalId === goal.id)?.amountMinor || '0'))
  return <><PageHeading eyebrow="Plan for something good" title="Savings goals" description="Goals reserve money already held in your savings accounts." action={<Button onClick={() => setForm({ name: '', amount: '', targetDate: '' })}><Plus size={16}/>New goal</Button>}/>{error && <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><InlineError>{error}</InlineError><Button variant="secondary" onClick={() => { setLoading(true); refresh() }}>Retry</Button></div>}{!loading && preferences.notifications.savingsGoalReminders && reminderGoals.length > 0 && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{reminderGoals.length} goal{reminderGoals.length === 1 ? ' has' : 's have'} a target date within 30 days and still needs an allocation.</div>}{loading ? <LoadingState/> : goals.length ? <div className="grid gap-4 md:grid-cols-2">{goals.map((goal) => { const allocated = BigInt(allocations.find((row) => row.goalId === goal.id)?.amountMinor || '0'); const target = BigInt(goal.targetMinor); const percent = target ? Math.min(Number(allocated * 10000n / target) / 100, 100) : 0; const remaining = target > allocated ? target - allocated : 0n; return <Card key={goal.id}><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef4e8] text-[#68894f]"><Target size={20}/></span><div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-[#293e31]">{goal.name}</h2><p className="mt-1 text-xs capitalize text-[#8a958d]">{goal.status}{goal.targetDate ? ` · target ${formatDateForDisplay(goal.targetDate)}` : ''}</p></div><button aria-label={goal.status === 'completed' ? 'Reopen goal' : 'Complete goal'} onClick={() => finish(goal)} className="rounded-lg p-2 text-[#64825b] hover:bg-[#eef4e8]">{goal.status === 'completed' ? <Target size={17}/> : <Check size={17}/>}</button><button aria-label="Delete goal" onClick={() => remove(goal)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></div><div className="mt-6 flex items-end justify-between"><p className="text-2xl font-semibold text-[#283d30]">{formatMoney(allocated, profile.currencyCode)}</p><p className="text-xs text-[#849087]">of {formatMoney(goal.targetMinor, profile.currencyCode)}</p></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#eff2ed]"><div className="h-full rounded-full bg-[#84aa61]" style={{ width: `${percent}%` }}/></div><div className="mt-3 flex items-center justify-between"><p className="text-xs text-[#849087]">{Math.round(percent)}% allocated · {formatMoney(remaining, profile.currencyCode)} to go</p><Button variant="secondary" onClick={() => setAllocationForm({ goal, amount: minorToInput(allocated, profile.currencyCode) })}>Manage allocation</Button></div></Card>})}</div> : <Card><EmptyState icon={Target} title="Make room for a goal" description="A trip, a buffer, or a new bike. Give your savings something to aim for." action={<Button onClick={() => setForm({ name: '', amount: '', targetDate: '' })}>Create a savings goal</Button>}/></Card>}{form && <Modal wide title="Create a savings goal" onClose={() => setForm(null)}><form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Goal name" maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required/><Field label={`Target (${profile.currencyCode})`} inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required placeholder="0.00"/><Field label="Target date (optional)" type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })}/><div className="flex justify-end gap-2 pt-1 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Create goal</Button></div></form></Modal>}{allocationForm && <Modal title={`Allocate savings to ${allocationForm.goal.name}`} description="This reserves money already held in savings accounts; it does not change account balances." onClose={() => setAllocationForm(null)}><form onSubmit={submitAllocation} className="space-y-4"><Field label={`Allocated amount (${profile.currencyCode})`} type="number" min="0" step="any" inputMode="decimal" value={allocationForm.amount} onChange={(event) => setAllocationForm({ ...allocationForm, amount: event.target.value })} required/><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAllocationForm(null)}>Cancel</Button><Button type="submit">Save allocation</Button></div></form></Modal>}{deleteTarget && <Modal title="Delete this savings goal?" description={`Delete “${deleteTarget.name}”? Its transaction history will remain. This action cannot be undone.`} onClose={() => !deleteBusy && setDeleteTarget(null)}><div className="flex justify-end gap-2"><Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>Keep goal</Button><Button variant="danger" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? 'Deleting…' : 'Delete goal'}</Button></div></Modal>}</>
}

function minorToInput(value, currencyCode) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  const minor = BigInt(value)
  const scale = 10n ** BigInt(digits)
  return digits ? `${minor / scale}.${(minor % scale).toString().padStart(digits, '0')}` : String(minor)
}
