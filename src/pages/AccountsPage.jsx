import { useCallback, useEffect, useState } from 'react'
import { Archive, Pencil, Plus, WalletCards } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney, parseMoneyToMinor, parseNonnegativeMoneyToMinor } from '../lib/money'
import { formatDateForDisplay } from '../lib/dates'
import { adjustAccountBalance, archiveAccount, createAccount, listAccountHistory, listAccounts, reactivateAccount, updateAccount } from '../services/ledgerService'
import { Button, Card, EmptyState, Field, InlineError, LoadingState, Modal, PageHeading, SelectField } from '../components/ui'

const blank = () => ({ name: '', accountType: 'bank', classification: 'spending', opening: '0', provider: '', description: '', purpose: '', subtype: '' })

export default function AccountsPage() {
  const { user, profile } = useAuth()
  usePreferences()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [adjustmentForm, setAdjustmentForm] = useState(null)
  const [historyAccount, setHistoryAccount] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setAccounts(await listAccounts(user.uid, { includeArchived: true })); setError('') }
    catch (caught) { setError(caught.message || 'Could not load accounts.') }
    finally { setLoading(false) }
  }, [user.uid])
  useEffect(() => { refresh() }, [refresh])
  const total = accounts.reduce((sum, account) => sum + BigInt(account.balanceMinor || 0), 0n)

  async function submit(event) {
    event.preventDefault()
    try {
      if (form.id) await updateAccount(user.uid, form.id, form)
      else await createAccount(user.uid, { name: form.name, accountType: form.accountType, classification: form.classification, currencyCode: profile.currencyCode, openingBalanceMinor: parseNonnegativeMoneyToMinor(form.opening, profile.currencyCode), provider: form.provider, description: form.description, purpose: form.purpose, subtype: form.subtype })
      setForm(null)
      await refresh()
    } catch (caught) { setError(caught.message || 'Could not save the account.') }
  }
  async function archive(account) {
    try { await archiveAccount(user.uid, account.id); await refresh() }
    catch (caught) { setError(caught.message || 'Could not archive the account.') }
  }
  async function reactivate(account) {
    try { await reactivateAccount(user.uid, account.id); await refresh() }
    catch (caught) { setError(caught.message || 'Could not reactivate the account.') }
  }
  async function submitAdjustment(event) {
    event.preventDefault()
    try { await adjustAccountBalance(user.uid, adjustmentForm.account.id, { newBalanceMinor: parseMoneyToMinor(adjustmentForm.amount, profile.currencyCode), reason: adjustmentForm.reason }); setAdjustmentForm(null); await refresh() }
    catch (caught) { setError(caught.message || 'Could not adjust the account balance.') }
  }
  async function toggleHistory(account) {
    if (historyAccount?.id === account.id) { setHistoryAccount(null); return }
    try { setHistoryRows(await listAccountHistory(user.uid, account.id)); setHistoryAccount(account) }
    catch (caught) { setError(caught.message || 'Could not load this account history.') }
  }

  return <><PageHeading eyebrow="Your money, in its places" title="Accounts" description="Track money in wallets, banks, and savings accounts." action={<Button onClick={() => setForm(blank())}><Plus size={16}/>Add account</Button>}/>
    {error && <div className="mb-4"><InlineError>{error}</InlineError></div>}
    {!loading && <Card className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-[#849087]">Current tracked balance</p><p className="mt-2 text-3xl font-semibold text-[#1e3428]">{formatMoney(total, profile.currencyCode)}</p><p className="mt-1 text-xs text-[#87938a]">Opening balances and posted account activity</p></Card>}
    {loading ? <LoadingState/> : accounts.length ? <div className="grid gap-4 md:grid-cols-2">{accounts.map((account) => <Card key={account.id}><div className="flex items-start gap-3"><div className="rounded-xl bg-[#eef4e8] p-2.5 text-[#62894e]"><WalletCards size={19}/></div><div className="min-w-0 flex-1"><h2 className="font-semibold text-[#263a2f]">{account.name}</h2><p className="mt-1 text-xs capitalize text-[#87938a]">{account.accountType} · {account.classification} · {account.status}</p></div>{account.status === 'active' ? <><button aria-label="Edit account" onClick={() => setForm({ ...account })} className="rounded-lg p-2 text-[#6e7c72] hover:bg-[#f0f3ee]"><Pencil size={16}/></button><button aria-label="Archive account" onClick={() => archive(account)} className="rounded-lg p-2 text-[#6e7c72] hover:bg-[#f0f3ee]"><Archive size={16}/></button></> : <Button variant="secondary" onClick={() => reactivate(account)}>Reactivate</Button>}</div>{account.provider && <p className="mt-3 text-xs text-[#87938a]">{account.provider}{account.subtype ? ` · ${account.subtype}` : ''}</p>}{account.description && <p className="mt-2 text-sm text-[#78857c]">{account.description}</p>}{account.purpose && <p className="mt-2 text-xs text-[#87938a]">Purpose: {account.purpose}</p>}<p className="mt-6 text-2xl font-semibold tabular-nums text-[#263a2f]">{formatMoney(BigInt(account.balanceMinor || 0), profile.currencyCode)}</p><p className="mt-1 text-xs text-[#87938a]">Opening balance {formatMoney(account.openingBalanceMinor || '0', profile.currencyCode)}{account.openingBalanceDate ? ` · Tracking from ${formatDateForDisplay(account.openingBalanceDate)}` : ''}</p>{account.status === 'active' && <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setAdjustmentForm({ account, amount: minorToInput(account.balanceMinor || 0, profile.currencyCode), reason: '' })}>Adjust balance</Button><Button variant="subtle" onClick={() => toggleHistory(account)}>{historyAccount?.id === account.id ? 'Hide history' : 'Account history'}</Button></div>}</Card>)}</div> : <Card><EmptyState icon={WalletCards} title="Add your first account" description="Set an optional opening balance for the money you already have." action={<Button onClick={() => setForm(blank())}>Add account</Button>}/></Card>}
    {historyAccount && <Card className="mt-5"><h2 className="font-serif text-xl font-semibold text-[#23372b]">{historyAccount.name} history</h2>{historyRows.length ? <div className="mt-3 divide-y divide-[#edf0eb]">{historyRows.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium capitalize text-[#405247]">{entry.kind.replaceAll('_', ' ')}{entry.categoryName ? ` · ${entry.categoryName}` : ''}</p><p className="mt-1 text-xs text-[#87938a]">{formatDateForDisplay(entry.occurredOn)}{entry.note ? ` · ${entry.note}` : ''}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums text-[#304337]">{BigInt(entry.accountDeltaMinor) >= 0n ? '+' : '−'}{formatMoney(BigInt(entry.accountDeltaMinor) >= 0n ? BigInt(entry.accountDeltaMinor) : -BigInt(entry.accountDeltaMinor), profile.currencyCode)}</span></div>)}</div> : <p className="mt-3 text-sm text-[#849087]">No posted activity yet.</p>}</Card>}
    {form && <Modal wide title={form.id ? 'Edit account' : 'Add account'} description={form.id ? 'Account details can be changed without changing its balance.' : 'Opening balance is existing money, not income.'} onClose={() => setForm(null)}><form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Account name" maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required/><SelectField label="Account type" value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })}><option value="cash">Cash wallet</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option><option value="other">Other</option></SelectField><SelectField label="Classification" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })}><option value="spending">Spending account</option><option value="savings">Savings account</option></SelectField>{!form.id && <Field label={`Opening balance (${profile.currencyCode})`} type="number" min="0" step="any" inputMode="decimal" value={form.opening} onChange={(event) => setForm({ ...form, opening: event.target.value })} required/>}<Field label="Bank or wallet provider (optional)" maxLength={80} value={form.provider || ''} onChange={(event) => setForm({ ...form, provider: event.target.value })}/><SelectField label="Purpose (optional)" value={form.purpose || ''} onChange={(event) => setForm({ ...form, purpose: event.target.value })}><option value="">Choose purpose</option>{['Daily spending', 'Salary account', 'Savings', 'Emergency fund', 'Household expenses', 'Business-related funds', 'Other'].map((item) => <option key={item}>{item}</option>)}</SelectField><Field label="Subtype (optional)" maxLength={50} value={form.subtype || ''} onChange={(event) => setForm({ ...form, subtype: event.target.value })}/><Field label="Description (optional)" maxLength={240} value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })}/><div className="flex justify-end gap-2 pt-1 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Save account</Button></div></form></Modal>}
    {adjustmentForm && <Modal wide title={`Adjust ${adjustmentForm.account.name}`} description="This creates a dated, auditable balance adjustment. It is not income or an expense." onClose={() => setAdjustmentForm(null)}><form onSubmit={submitAdjustment} className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label={`Correct balance (${profile.currencyCode})`} type="number" min="0" step="any" inputMode="decimal" value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })} required/><Field label="Reason" maxLength={240} value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })} required/><div className="flex justify-end gap-2 pt-1 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setAdjustmentForm(null)}>Cancel</Button><Button type="submit">Save adjustment</Button></div></form></Modal>}
  </>
}

function minorToInput(value, currencyCode) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  const amount = BigInt(value)
  const scale = 10n ** BigInt(digits)
  return digits ? `${amount / scale}.${(amount % scale).toString().padStart(digits, '0')}` : String(amount)
}
