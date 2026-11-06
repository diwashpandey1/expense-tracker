import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney, parseMoneyToMinor } from '../lib/money'
import { explainFirebaseError } from '../lib/firebaseErrors'
import { formatDateForDisplay, localDateString } from '../lib/dates'
import { deleteTransaction, editTransaction, listAllTransactions } from '../services/transactionService'
import { editFinancialEvent, InsufficientBalanceError, listAccounts, postFinancialEvent, voidFinancialEvent } from '../services/ledgerService'
import { listCategories } from '../services/categoryService'
import { listGoals } from '../services/goalService'
import { Button, Card, EmptyState, Field, InlineError, LoadingState, Modal, PageHeading, SelectField } from '../components/ui'

const blank = (accountId = '', kind = 'expense', categoryId = '') => ({ kind, amount: '', occurredOn: localDateString(), categoryId, goalId: '', note: '', accountId, destinationAccountId: '' })

export default function TransactionsPage() {
  const { user, profile } = useAuth()
  const { preferences } = usePreferences()
  const transactionPrefs = preferences.transactions
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [goals, setGoals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [queryText, setQueryText] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState(transactionPrefs.sort)
  const [sortTouched, setSortTouched] = useState(false)
  const [page, setPage] = useState(0)
  const [form, setForm] = useState(null)
  const [fundingPrompt, setFundingPrompt] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { if (!sortTouched) setSort(transactionPrefs.sort) }, [transactionPrefs.sort, sortTouched])

  const refresh = useCallback(async () => {
    try {
      const [transactions, categoryRows, goalRows, accountRows] = await Promise.all([listAllTransactions(user.uid, { from: dateFrom || undefined, to: dateTo || undefined }), listCategories(user.uid), listGoals(user.uid), listAccounts(user.uid)])
      setRows(transactions)
      setCategories(categoryRows)
      setGoals(goalRows.filter((goal) => goal.status === 'active'))
      setAccounts(accountRows)
      setError('')
    } catch (caught) { setError(explainFirebaseError(caught, 'transactions')) }
    finally { setLoading(false) }
  }, [user.uid, dateFrom, dateTo])

  useEffect(() => { refresh() }, [refresh])

  function newTransactionForm() {
    const kind = transactionPrefs.defaultType
    const selectableAccounts = accounts.filter((account) => kind !== 'expense' || account.classification === 'spending')
    const accountId = selectableAccounts.some((account) => account.id === transactionPrefs.defaultAccountId) ? transactionPrefs.defaultAccountId : selectableAccounts[0]?.id || ''
    const categoryKind = kind === 'income' ? 'income' : 'expense'
    const selectableCategories = categories.filter((category) => category.kind === categoryKind)
    const categoryId = selectableCategories.some((category) => category.id === transactionPrefs.defaultCategoryId) ? transactionPrefs.defaultCategoryId : selectableCategories[0]?.id || ''
    return blank(accountId, kind, categoryId)
  }
  const visibleRows = useMemo(() => {
    const matches = rows.filter((row) => (!kindFilter || row.kind === kindFilter) && (!categoryFilter || row.categoryId === categoryFilter) && (!queryText.trim() || [row.note, row.categoryName, row.goalName].some((value) => value?.toLowerCase().includes(queryText.toLowerCase()))))
    return matches.sort((a, b) => {
      if (sort === 'oldest') return a.occurredOn.localeCompare(b.occurredOn) || a.id.localeCompare(b.id)
      if (sort === 'amount-high') return BigInt(a.amountMinor) > BigInt(b.amountMinor) ? -1 : BigInt(a.amountMinor) < BigInt(b.amountMinor) ? 1 : 0
      if (sort === 'amount-low') return BigInt(a.amountMinor) < BigInt(b.amountMinor) ? -1 : BigInt(a.amountMinor) > BigInt(b.amountMinor) ? 1 : 0
      return b.occurredOn.localeCompare(a.occurredOn) || b.id.localeCompare(a.id)
    })
  }, [rows, kindFilter, categoryFilter, queryText, sort])
  const pageSize = 50
  const pageRows = visibleRows.slice(page * pageSize, (page + 1) * pageSize)

  async function saveForm() {
    setError('')
    try {
      const kind = form.kind
      const category = categories.find((item) => item.id === form.categoryId)
      const goal = goals.find((item) => item.id === form.goalId)
      const payload = {
        kind,
        amountMinor: parseMoneyToMinor(form.amount, profile.currencyCode),
        occurredOn: form.occurredOn,
        note: form.note.trim(),
        categoryId: category?.id || null,
        categoryName: category?.name || null,
        goalId: kind.startsWith('savings_') ? goal?.id : null,
        goalName: kind.startsWith('savings_') ? goal?.name : null,
        accountId: form.accountId,
        destinationAccountId: form.destinationAccountId,
        currencyCode: profile.currencyCode,
      }
      if (form.id && form.accountId) await editFinancialEvent(user.uid, form.id, payload)
      else if (form.id) await editTransaction(user.uid, form.id, payload, profile.currencyCode)
      else await postFinancialEvent(user.uid, payload)
      setForm(null)
      setConfirming(false)
      await refresh()
    } catch (caught) {
      if (caught instanceof InsufficientBalanceError) setFundingPrompt({ payload: { ...form, amountMinor: parseMoneyToMinor(form.amount, profile.currencyCode), categoryId: categories.find((item) => item.id === form.categoryId)?.id || null, categoryName: categories.find((item) => item.id === form.categoryId)?.name || null, currencyCode: profile.currencyCode }, shortfallMinor: caught.shortfallMinor, accounts: caught.savingsAccounts })
      else setError(caught.message || 'Could not save this transaction.')
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (transactionPrefs.confirmBeforeSave && !form.id) { setConfirming(true); return }
    await saveForm()
  }

  async function remove(row) {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return
    try { if (row.accountId) await voidFinancialEvent(user.uid, row.id); else await deleteTransaction(user.uid, row.id, profile.currencyCode); await refresh() }
    catch { setError('Could not delete this transaction. Try again.') }
  }

  const categoriesForKind = categories.filter((item) => item.kind === (form?.kind?.startsWith('savings_') ? 'saving' : form?.kind))
  async function confirmSavingsTransfer() {
    if (!fundingPrompt?.accountId) return
    try {
      await postFinancialEvent(user.uid, fundingPrompt.payload, { savingsAccountId: fundingPrompt.accountId })
      setFundingPrompt(null)
      setForm(null)
      await refresh()
    } catch (caught) { setError(caught.message || 'Could not complete the savings transfer and expense.'); setFundingPrompt(null) }
  }
  return <>
    <PageHeading eyebrow="Your money, clearly" title="Transactions" description="Keep income, everyday spending, and account transfers in one place." action={<Button onClick={() => { setConfirming(false); setForm(newTransactionForm()) }}><Plus size={17}/>Add transaction</Button>} />
    {error && <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><InlineError>{error}</InlineError><Button variant="secondary" onClick={() => { setLoading(true); refresh() }}>Retry</Button></div>}
    <Card className="!p-0">
      <div className="grid min-w-0 gap-3 border-b border-[#edf0eb] p-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 sm:p-5">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b978e]"/><input aria-label="Search transactions" value={queryText} onChange={(event) => { setQueryText(event.target.value); setPage(0) }} placeholder="Search notes or categories" className="w-full rounded-xl border border-[#e1e6df] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#648d57]"/></label>
        <select aria-label="Filter by type" value={kindFilter} onChange={(event) => { setKindFilter(event.target.value); setPage(0) }} className="rounded-xl border border-[#e1e6df] bg-white px-3 py-2.5 text-sm"><option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option><option value="savings_contribution">Legacy goal contributions</option><option value="savings_withdrawal">Legacy goal withdrawals</option></select>
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(0) }} className="rounded-xl border border-[#e1e6df] bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <label className="flex items-center gap-2 rounded-xl border border-[#e1e6df] bg-white px-3 text-xs text-[#78857c]">From<input aria-label="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(0) }} className="min-w-0 flex-1 py-2 text-sm text-[#34463b] outline-none"/></label>
        <label className="flex items-center gap-2 rounded-xl border border-[#e1e6df] bg-white px-3 text-xs text-[#78857c]">To<input aria-label="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(0) }} className="min-w-0 flex-1 py-2 text-sm text-[#34463b] outline-none"/></label>
        <select aria-label="Sort transactions" value={sort} onChange={(event) => { setSortTouched(true); setSort(event.target.value); setPage(0) }} className="rounded-xl border border-[#e1e6df] bg-white px-3 py-2.5 text-sm"><option value="newest">Date: newest</option><option value="oldest">Date: oldest</option><option value="amount-high">Amount: high to low</option><option value="amount-low">Amount: low to high</option></select>
      </div>
      {loading ? <LoadingState/> : visibleRows.length ? <><div className="divide-y divide-[#f0f2ee]">{pageRows.map((row) => <div key={row.id} className={`flex items-center gap-3 px-4 sm:px-5 ${transactionPrefs.listView === 'compact' ? 'py-2' : 'py-4'}`}><span className={'grid h-10 w-10 shrink-0 place-items-center rounded-xl '+(row.kind === 'income' ? 'bg-[#edf5e8] text-[#50804f]' : row.kind === 'transfer' ? 'bg-[#edf3f5] text-[#527d8d]' : 'bg-[#f9eeeb] text-[#b87465]')}>{row.kind === 'income' ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#304337]">{row.kind === 'transfer' ? 'Account transfer' : row.kind.startsWith('savings_') && row.categoryName ? `${row.categoryName} · ${row.goalName || 'Savings goal'}` : row.categoryName || row.goalName || 'Transaction'}{row.note ? ` · ${row.note}` : ''}</p><p className="mt-1 text-xs text-[#8a958d]">{formatDateForDisplay(row.occurredOn)} · {row.kind.replaceAll('_', ' ')}</p></div><span className="whitespace-nowrap text-sm font-bold tabular-nums text-[#34483a]">{row.kind === 'income' ? '+' : row.kind === 'expense' ? '−' : ''}{formatMoney(row.amountMinor, profile.currencyCode)}</span><button aria-label="Edit transaction" onClick={() => setForm({ ...row, categoryId: row.categoryId || '', amount: minorToInput(row.amountMinor, profile.currencyCode) })} className="rounded-lg p-2 text-[#708176] hover:bg-[#eef2ec]"><Pencil size={16}/></button><button aria-label="Delete transaction" onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></div>)}</div><div className="flex items-center justify-between px-4 py-3 text-xs text-[#849087]"><span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, visibleRows.length)} of {visibleRows.length}</span><div className="flex gap-1"><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))} className="rounded-lg p-2 hover:bg-[#eef2ec] disabled:opacity-40"><ChevronLeft size={17}/></button><button aria-label="Next page" disabled={(page + 1) * pageSize >= visibleRows.length} onClick={() => setPage((value) => value + 1)} className="rounded-lg p-2 hover:bg-[#eef2ec] disabled:opacity-40"><ChevronRight size={17}/></button></div></div></> : <EmptyState title="No matching transactions" description={rows.length ? 'Try another search or filter.' : 'Add your first entry to start tracking your money.'} action={!rows.length && <Button onClick={() => { setConfirming(false); setForm(newTransactionForm()) }}>Add transaction</Button>}/>}
    </Card>
    {form && <Modal wide title={form.id ? 'Edit transaction' : 'Add transaction'} description={form.id && !form.accountId ? 'This is a legacy transaction without an account. Its history is preserved.' : 'New entries update the selected account balance atomically.'} onClose={() => { setConfirming(false); setForm(null) }}>
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submit}>
        {!form.id && <SelectField label="Type" value={form.kind} onChange={(event) => { const kind = event.target.value; const category = categories.find((item) => item.id === transactionPrefs.defaultCategoryId && item.kind === (kind === 'income' ? 'income' : 'expense')); const fallback = categories.find((item) => item.kind === (kind === 'income' ? 'income' : 'expense')); setForm({ ...form, kind, categoryId: category?.id || fallback?.id || '', goalId: '' }) }}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></SelectField>}
        {!form.id && <SelectField label="From account" value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} required><option value="">Choose account</option>{accounts.filter((account) => form.kind !== 'expense' || account.classification === 'spending').map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(BigInt(account.balanceMinor || 0), profile.currencyCode)}</option>)}</SelectField>}
        {form.kind === 'transfer' && <SelectField label="To account" value={form.destinationAccountId || ''} onChange={(event) => setForm({ ...form, destinationAccountId: event.target.value })} required><option value="">Choose destination</option>{accounts.filter((account) => account.id !== form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</SelectField>}
        <Field label={`Amount (${profile.currencyCode})`} type="number" min="0.01" step="any" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" required />
        <Field label="Date" type="date" value={form.occurredOn} onChange={(event) => setForm({ ...form, occurredOn: event.target.value })} required />
        {form.kind !== 'transfer' && <SelectField label="Category" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Choose category</option>{categoriesForKind.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectField>}
        <Field label="Note (optional)" maxLength={500} value={form.note || ''} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="A little context" />
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={!form.id && !accounts.length}>Save transaction</Button></div>
      </form>
    </Modal>}
    {confirming && form && <Modal title="Confirm transaction" description={`Review this ${form.kind} for ${form.amount} ${profile.currencyCode}, dated ${formatDateForDisplay(form.occurredOn)}. Saving will update the selected account.`} onClose={() => setConfirming(false)}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirming(false)}>Go back</Button><Button onClick={saveForm}>Confirm and save</Button></div></Modal>}
    {fundingPrompt && <Modal title="Use savings to cover this expense?" description={`This expense needs ${formatMoney(fundingPrompt.shortfallMinor, profile.currencyCode)} transferred into your spending account. The transfer and expense will post together.`} onClose={() => setFundingPrompt(null)}><div className="space-y-4"><SelectField label="Savings account" value={fundingPrompt.accountId || ''} onChange={(event) => setFundingPrompt({ ...fundingPrompt, accountId: event.target.value })}><option value="">Choose savings account</option>{fundingPrompt.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(BigInt(account.balanceMinor), profile.currencyCode)}</option>)}</SelectField><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFundingPrompt(null)}>Cancel</Button><Button onClick={confirmSavingsTransfer} disabled={!fundingPrompt.accountId}>Transfer and save expense</Button></div></div></Modal>}
  </>
}

function minorToInput(value, currencyCode) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  const minor = BigInt(value)
  const scale = 10n ** BigInt(digits)
  return digits ? `${minor / scale}.${(minor % scale).toString().padStart(digits, '0')}` : String(minor)
}
