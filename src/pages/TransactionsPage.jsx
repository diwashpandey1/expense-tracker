import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatMoney, parseMoneyToMinor } from '../lib/money'
import { explainFirebaseError } from '../lib/firebaseErrors'
import { formatDateForDisplay, isCalendarDate, localDateString } from '../lib/dates'
import { deleteTransaction, editTransaction, listAllTransactions } from '../services/transactionService'
import { editFinancialEvent, InsufficientBalanceError, listAccounts, postFinancialEvent, voidFinancialEvent } from '../services/ledgerService'
import { listCategories } from '../services/categoryService'
import { listGoals } from '../services/goalService'
import { downloadCsv, parseCsv, stableCsvOperationId, transactionFingerprint, transactionsToCsv } from '../services/csvBackupService'
import { Button, Card, EmptyState, Field, InlineError, LoadingState, Modal, PageHeading, SelectField } from '../components/ui'
import { toast } from 'sonner'

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
  const [notice, setNotice] = useState('')
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const importInput = useRef(null)

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
    const matches = rows.filter((row) => (!kindFilter || row.kind === kindFilter) && (!categoryFilter || row.categoryId === categoryFilter || row.categorySplits?.some((line) => line.categoryId === categoryFilter)) && (!queryText.trim() || [row.note, row.categoryName, row.goalName, ...(row.categorySplits || []).map((line) => line.categoryName)].some((value) => value?.toLowerCase().includes(queryText.toLowerCase()))))
    return matches.sort((a, b) => {
      if (sort === 'oldest') return a.occurredOn.localeCompare(b.occurredOn) || a.id.localeCompare(b.id)
      if (sort === 'amount-high') return BigInt(a.amountMinor) > BigInt(b.amountMinor) ? -1 : BigInt(a.amountMinor) < BigInt(b.amountMinor) ? 1 : 0
      if (sort === 'amount-low') return BigInt(a.amountMinor) < BigInt(b.amountMinor) ? -1 : BigInt(a.amountMinor) > BigInt(b.amountMinor) ? 1 : 0
      return b.occurredOn.localeCompare(a.occurredOn) || b.id.localeCompare(a.id)
    })
  }, [rows, kindFilter, categoryFilter, queryText, sort])
  const pageSize = 50
  const pageRows = visibleRows.slice(page * pageSize, (page + 1) * pageSize)

  async function previewCsv(file) {
    if (!file) return
    setError('')
    setNotice('')
    try {
      const parsedRows = parseCsv(await file.text())
      const accountByName = new Map(accounts.map((item) => [item.name.trim().toLocaleLowerCase(), item]))
      const categoryByName = new Map(categories.map((item) => [`${item.kind}|${item.name.trim().toLocaleLowerCase()}`, item]))
      const known = new Set(rows.map(transactionFingerprint))
      const prepared = parsedRows.map((row) => {
        let reason = ''
        const kind = row.type.trim().toLowerCase()
        const currency = row.currency.trim().toUpperCase()
        if (!isCalendarDate(row.date.trim())) reason = 'Invalid date.'
        else if (!['income', 'expense', 'transfer'].includes(kind)) reason = 'Only income, expense, and transfer rows can be imported.'
        else if (currency && currency !== profile.currencyCode) reason = `Currency ${currency} does not match your profile currency ${profile.currencyCode}.`
        const account = accountByName.get(row.account.trim().toLocaleLowerCase())
        const destination = accountByName.get((row.destination_account || '').trim().toLocaleLowerCase())
        if (!reason && !account) reason = `Account “${row.account}” was not found.`
        if (!reason && kind === 'transfer' && (!destination || destination.id === account?.id)) reason = 'A transfer needs a different destination account.'
        let amountMinor = ''
        try { amountMinor = parseMoneyToMinor(row.amount.trim(), profile.currencyCode) }
        catch (caught) { if (!reason) reason = caught.message }
        let category = null
        let categorySplits = null
        if (!reason && kind !== 'transfer') {
          if (row.category_splits.trim()) {
            try {
              const splitRows = JSON.parse(row.category_splits)
              categorySplits = splitRows.map((line) => {
                const matched = categoryByName.get(`expense|${String(line.category || '').trim().toLocaleLowerCase()}`)
                if (!matched) throw new Error(`Expense category “${line.category}” was not found.`)
                return { categoryId: matched.id, categoryName: matched.name, amountMinor: parseMoneyToMinor(String(line.amount), profile.currencyCode) }
              })
              if (kind !== 'expense' || categorySplits.length < 2 || categorySplits.length > 3) throw new Error('CSV split transactions must have two or three expense categories.')
              if (categorySplits.reduce((sum, line) => sum + BigInt(line.amountMinor), 0n) !== BigInt(amountMinor)) throw new Error('Split line amounts do not add up to the transaction total.')
              category = categories.find((item) => item.id === categorySplits[0].categoryId)
            } catch (caught) { reason = caught.message || 'Invalid split categories.' }
          } else {
            category = categoryByName.get(`${kind}|${row.category.trim().toLocaleLowerCase()}`)
            if (!category) reason = `Category “${row.category}” was not found for ${kind}.`
          }
        }
        const item = { occurredOn: row.date.trim(), kind, amountMinor, accountId: account?.id || '', destinationAccountId: destination?.id || '', categoryId: category?.id || '', categoryName: category?.name || '', categorySplits, note: (row.note || '').trim(), currencyCode: profile.currencyCode }
        const fingerprint = transactionFingerprint(item)
        const duplicate = known.has(fingerprint)
        if (duplicate && !reason) reason = 'Already exists; this row will be skipped.'
        if (kind !== 'transfer' && !categorySplits?.length) item.categoryName = category?.name || ''
        known.add(fingerprint)
        return { ...item, sourceRow: row.sourceRow, reason, duplicate }
      })
      setImportPreview({ fileName: file.name, entries: prepared })
    } catch (caught) { setError(caught.message || 'Could not read this CSV file.') }
  }

  async function importCsvRows() {
    if (!importPreview) return
    const candidates = importPreview.entries.filter((row) => !row.reason)
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || (a.kind === 'income' ? -1 : 1))
    setImporting(true)
    let imported = 0
    const results = []
    try {
      for (const item of candidates) {
        try {
          const operationId = await stableCsvOperationId(item)
          await postFinancialEvent(user.uid, item, { operationId })
          imported += 1
          results.push({ row: item.sourceRow, message: 'Imported' })
        } catch (caught) { results.push({ row: item.sourceRow, message: caught.message || 'Could not post this row.' }) }
      }
      setImportPreview(null)
      setNotice(`Imported ${imported} row${imported === 1 ? '' : 's'}; ${results.length - imported} skipped or failed. Review accounts and balances before importing historical statements.`)
      await refresh()
      if (results.some((item) => item.message !== 'Imported')) setError(results.filter((item) => item.message !== 'Imported').slice(0, 5).map((item) => `Row ${item.row}: ${item.message}`).join(' '))
    } finally { setImporting(false) }
  }

  async function saveForm() {
    setError('')
    try {
      const kind = form.kind
      const splitLines = form.splitMode ? form.categorySplits.map((line) => {
        const splitCategory = categories.find((item) => item.id === line.categoryId)
        return { categoryId: splitCategory?.id || '', categoryName: splitCategory?.name || '', amountMinor: parseMoneyToMinor(line.amount, profile.currencyCode) }
      }) : null
      const category = splitLines?.length ? categories.find((item) => item.id === splitLines[0].categoryId) : categories.find((item) => item.id === form.categoryId)
      const goal = goals.find((item) => item.id === form.goalId)
      const payload = {
        kind,
        amountMinor: parseMoneyToMinor(form.amount, profile.currencyCode),
        occurredOn: form.occurredOn,
        note: form.note.trim(),
        categoryId: category?.id || null,
        categoryName: category?.name || null,
        categorySplits: splitLines,
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
      if (caught instanceof InsufficientBalanceError) {
        const splitLines = form.splitMode ? form.categorySplits.map((line) => { const item = categories.find((row) => row.id === line.categoryId); return { categoryId: item?.id || '', categoryName: item?.name || '', amountMinor: parseMoneyToMinor(line.amount, profile.currencyCode) } }) : null
        const first = splitLines?.length ? categories.find((item) => item.id === splitLines[0].categoryId) : categories.find((item) => item.id === form.categoryId)
        setFundingPrompt({ payload: { ...form, amountMinor: parseMoneyToMinor(form.amount, profile.currencyCode), categoryId: first?.id || null, categoryName: first?.name || null, categorySplits: splitLines, currencyCode: profile.currencyCode }, shortfallMinor: caught.shortfallMinor, accounts: caught.savingsAccounts })
      }
      else setError(caught.message || 'Could not save this transaction.')
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (transactionPrefs.confirmBeforeSave && !form.id) { setConfirming(true); return }
    await saveForm()
  }

  async function remove(row) {
    setDeleteTarget(row)
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    try {
      if (deleteTarget.accountId) await voidFinancialEvent(user.uid, deleteTarget.id)
      else await deleteTransaction(user.uid, deleteTarget.id, profile.currencyCode)
      setDeleteTarget(null)
      toast.success('Transaction deleted.')
      await refresh()
    } catch (caught) {
      toast.error('Could not delete this transaction.', { description: caught.message || 'Try again.' })
    } finally { setDeleteBusy(false) }
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
    <PageHeading eyebrow="Your money, clearly" title="Transactions" description="Keep income, everyday spending, and account transfers in one place." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => downloadCsv(transactionsToCsv(rows, accounts, profile.currencyCode), `avora-transactions-${localDateString()}.csv`)}><Download size={16}/>Export CSV</Button><Button variant="secondary" onClick={() => importInput.current?.click()}><Upload size={16}/>Import CSV</Button><input ref={importInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { previewCsv(event.target.files?.[0]); event.target.value = '' }}/><Button onClick={() => { setConfirming(false); setForm(newTransactionForm()) }}><Plus size={17}/>Add transaction</Button></div>} />
    {error && <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><InlineError>{error}</InlineError><Button variant="secondary" onClick={() => { setLoading(true); refresh() }}>Retry</Button></div>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-[#d9e7d3] bg-[#f0f6eb] px-4 py-3 text-sm text-[#45664a]">{notice}</p>}
    <Card className="!p-0">
      <div className="grid min-w-0 gap-3 border-b border-[#edf0eb] p-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 sm:p-5">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b978e]"/><input aria-label="Search transactions" value={queryText} onChange={(event) => { setQueryText(event.target.value); setPage(0) }} placeholder="Search notes or categories" className="w-full rounded-xl border border-[#e1e6df] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#648d57]"/></label>
        <select aria-label="Filter by type" value={kindFilter} onChange={(event) => { setKindFilter(event.target.value); setPage(0) }} className="rounded-xl border border-[#e1e6df] bg-white px-3 py-2.5 text-sm"><option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option><option value="savings_contribution">Legacy goal contributions</option><option value="savings_withdrawal">Legacy goal withdrawals</option></select>
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(0) }} className="rounded-xl border border-[#e1e6df] bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <label className="flex items-center gap-2 rounded-xl border border-[#e1e6df] bg-white px-3 text-xs text-[#78857c]">From<input aria-label="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(0) }} className="min-w-0 flex-1 py-2 text-sm text-[#34463b] outline-none"/></label>
        <label className="flex items-center gap-2 rounded-xl border border-[#e1e6df] bg-white px-3 text-xs text-[#78857c]">To<input aria-label="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(0) }} className="min-w-0 flex-1 py-2 text-sm text-[#34463b] outline-none"/></label>
        <select aria-label="Sort transactions" value={sort} onChange={(event) => { setSortTouched(true); setSort(event.target.value); setPage(0) }} className="rounded-xl border border-[#e1e6df] bg-white px-3 py-2.5 text-sm"><option value="newest">Date: newest</option><option value="oldest">Date: oldest</option><option value="amount-high">Amount: high to low</option><option value="amount-low">Amount: low to high</option></select>
      </div>
      {loading ? <LoadingState/> : visibleRows.length ? <><div className="divide-y divide-[#f0f2ee]">{pageRows.map((row) => <div key={row.id} className={`flex items-center gap-3 px-4 sm:px-5 ${transactionPrefs.listView === 'compact' ? 'py-2' : 'py-4'}`}><span className={'grid h-10 w-10 shrink-0 place-items-center rounded-xl '+(row.kind === 'income' ? 'bg-[#edf5e8] text-[#50804f]' : row.kind === 'transfer' ? 'bg-[#edf3f5] text-[#527d8d]' : 'bg-[#f9eeeb] text-[#b87465]')}>{row.kind === 'income' ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#304337]">{row.kind === 'transfer' ? 'Account transfer' : row.kind.startsWith('savings_') && row.categoryName ? `${row.categoryName} · ${row.goalName || 'Savings goal'}` : row.categorySplits?.length ? `Split: ${row.categorySplits.map((line) => line.categoryName).join(', ')}` : row.categoryName || row.goalName || 'Transaction'}{row.note ? ` · ${row.note}` : ''}</p><p className="mt-1 text-xs text-[#8a958d]">{formatDateForDisplay(row.occurredOn)} · {row.kind.replaceAll('_', ' ')}</p></div><span className="whitespace-nowrap text-sm font-bold tabular-nums text-[#34483a]">{row.kind === 'income' ? '+' : row.kind === 'expense' ? '−' : ''}{formatMoney(row.amountMinor, profile.currencyCode)}</span><button aria-label="Edit transaction" onClick={() => setForm({ ...row, categoryId: row.categoryId || '', splitMode: Boolean(row.categorySplits?.length), categorySplits: row.categorySplits?.map((line) => ({ ...line, amount: minorToInput(line.amountMinor, profile.currencyCode) })), amount: minorToInput(row.amountMinor, profile.currencyCode) })} className="rounded-lg p-2 text-[#708176] hover:bg-[#eef2ec]"><Pencil size={16}/></button><button aria-label="Delete transaction" onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></div>)}</div><div className="flex items-center justify-between px-4 py-3 text-xs text-[#849087]"><span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, visibleRows.length)} of {visibleRows.length}</span><div className="flex gap-1"><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))} className="rounded-lg p-2 hover:bg-[#eef2ec] disabled:opacity-40"><ChevronLeft size={17}/></button><button aria-label="Next page" disabled={(page + 1) * pageSize >= visibleRows.length} onClick={() => setPage((value) => value + 1)} className="rounded-lg p-2 hover:bg-[#eef2ec] disabled:opacity-40"><ChevronRight size={17}/></button></div></div></> : <EmptyState title="No matching transactions" description={rows.length ? 'Try another search or filter.' : 'Add your first entry to start tracking your money.'} action={!rows.length && <Button onClick={() => { setConfirming(false); setForm(newTransactionForm()) }}>Add transaction</Button>}/>}
    </Card>
    {form && <Modal wide title={form.id ? 'Edit transaction' : 'Add transaction'} description={form.id && !form.accountId ? 'This is a legacy transaction without an account. Its history is preserved.' : 'New entries update the selected account balance atomically.'} onClose={() => { setConfirming(false); setForm(null) }}>
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submit}>
        {!form.id && <SelectField label="Type" value={form.kind} onChange={(event) => { const kind = event.target.value; const category = categories.find((item) => item.id === transactionPrefs.defaultCategoryId && item.kind === (kind === 'income' ? 'income' : 'expense')); const fallback = categories.find((item) => item.kind === (kind === 'income' ? 'income' : 'expense')); setForm({ ...form, kind, categoryId: category?.id || fallback?.id || '', splitMode: false, categorySplits: [], goalId: '' }) }}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></SelectField>}
        {!form.id && <SelectField label="From account" value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} required><option value="">Choose account</option>{accounts.filter((account) => form.kind !== 'expense' || account.classification === 'spending').map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(BigInt(account.balanceMinor || 0), profile.currencyCode)}</option>)}</SelectField>}
        {form.kind === 'transfer' && <SelectField label="To account" value={form.destinationAccountId || ''} onChange={(event) => setForm({ ...form, destinationAccountId: event.target.value })} required><option value="">Choose destination</option>{accounts.filter((account) => account.id !== form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</SelectField>}
        <Field label={`Amount (${profile.currencyCode})`} type="number" min="0.01" step="any" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" required />
        {form.kind === 'expense' && <div className="sm:col-span-2"><button type="button" className="text-sm font-semibold text-[#2b5941] underline decoration-[#b7cbb7] underline-offset-4" onClick={() => setForm({ ...form, splitMode: !form.splitMode, categorySplits: form.splitMode ? [] : [{ categoryId: form.categoryId, amount: '' }, { categoryId: '', amount: '' }] })}>{form.splitMode ? 'Use one category' : 'Split across categories'}</button>{form.splitMode && <div className="mt-3 space-y-3">{form.categorySplits.map((line, index) => <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-xl bg-[#f5f8f2] p-3 sm:grid-cols-[1.2fr_1fr_auto]"><SelectField label={`Category ${index + 1}`} value={line.categoryId} onChange={(event) => setForm({ ...form, categorySplits: form.categorySplits.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId: event.target.value } : item) })}><option value="">Choose category</option>{categories.filter((item) => item.kind === 'expense').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectField><Field label={`Split amount (${profile.currencyCode})`} type="number" min="0.01" step="any" value={line.amount} onChange={(event) => setForm({ ...form, categorySplits: form.categorySplits.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item) })} required/>{form.categorySplits.length > 2 && <button type="button" aria-label={`Remove category split ${index + 1}`} onClick={() => setForm({ ...form, categorySplits: form.categorySplits.filter((_, itemIndex) => itemIndex !== index) })} className="mb-2 text-sm font-semibold text-rose-700">Remove</button>}</div>)}{form.categorySplits.length < 3 && <button type="button" onClick={() => setForm({ ...form, categorySplits: [...form.categorySplits, { categoryId: '', amount: '' }] })} className="rounded-lg border border-[#dce5d8] px-3 py-2 text-sm font-semibold text-[#456b4d]">Add category split</button>}<p className="text-xs text-[#79877d]">Split amounts must add up exactly to the full transaction amount.</p></div>}</div>}
        <Field label="Date" type="date" value={form.occurredOn} onChange={(event) => setForm({ ...form, occurredOn: event.target.value })} required />
        {form.kind !== 'transfer' && !form.splitMode && <SelectField label="Category" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Choose category</option>{categoriesForKind.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectField>}
        <Field label="Note (optional)" maxLength={500} value={form.note || ''} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="A little context" />
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={!form.id && !accounts.length}>Save transaction</Button></div>
      </form>
    </Modal>}
    {confirming && form && <Modal title="Confirm transaction" description={`Review this ${form.kind} for ${form.amount} ${profile.currencyCode}, dated ${formatDateForDisplay(form.occurredOn)}. Saving will update the selected account.`} onClose={() => setConfirming(false)}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirming(false)}>Go back</Button><Button onClick={saveForm}>Confirm and save</Button></div></Modal>}
    {deleteTarget && <Modal title="Delete this transaction?" description="This cannot be undone. The transaction will be removed from your history and its account posting will be reversed." onClose={() => !deleteBusy && setDeleteTarget(null)}><div className="flex justify-end gap-2"><Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>Keep transaction</Button><Button variant="danger" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? 'Deleting…' : 'Delete transaction'}</Button></div></Modal>}
    {importPreview && <Modal wide title="Review CSV import" description="Review rows before they post. Imported rows update the selected accounts; importing history already reflected in an opening balance can double-count it." onClose={() => !importing && setImportPreview(null)}><div className="space-y-4"><p className="text-sm text-[#66756a]">{importPreview.fileName} · {importPreview.entries.filter((item) => !item.reason).length} ready · {importPreview.entries.filter((item) => item.reason).length} skipped</p><div className="max-h-[45vh] overflow-auto rounded-xl border border-[#e8ebe5]"><table className="w-full min-w-[620px] text-left text-sm"><thead className="sticky top-0 bg-[#f4f7f1] text-xs text-[#77847c]"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Review</th></tr></thead><tbody className="divide-y divide-[#edf0eb]">{importPreview.entries.map((item) => <tr key={item.sourceRow}><td className="px-3 py-2">{item.sourceRow}</td><td className="px-3 py-2">{item.occurredOn}</td><td className="px-3 py-2 capitalize">{item.kind}</td><td className="px-3 py-2">{item.amountMinor ? formatMoney(item.amountMinor, profile.currencyCode) : '—'}</td><td className="px-3 py-2">{accounts.find((account) => account.id === item.accountId)?.name || '—'}</td><td className={`px-3 py-2 text-xs ${item.reason ? 'text-rose-700' : 'text-[#4e7650]'}`}>{item.reason || 'Ready'}</td></tr>)}</tbody></table></div><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={importing} onClick={() => setImportPreview(null)}>Cancel</Button><Button disabled={importing || !importPreview.entries.some((item) => !item.reason)} onClick={importCsvRows}>{importing ? 'Importing…' : `Import ${importPreview.entries.filter((item) => !item.reason).length} rows`}</Button></div></div></Modal>}
    {fundingPrompt && <Modal title="Use savings to cover this expense?" description={`This expense needs ${formatMoney(fundingPrompt.shortfallMinor, profile.currencyCode)} transferred into your spending account. The transfer and expense will post together.`} onClose={() => setFundingPrompt(null)}><div className="space-y-4"><SelectField label="Savings account" value={fundingPrompt.accountId || ''} onChange={(event) => setFundingPrompt({ ...fundingPrompt, accountId: event.target.value })}><option value="">Choose savings account</option>{fundingPrompt.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(BigInt(account.balanceMinor), profile.currencyCode)}</option>)}</SelectField><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFundingPrompt(null)}>Cancel</Button><Button onClick={confirmSavingsTransfer} disabled={!fundingPrompt.accountId}>Transfer and save expense</Button></div></div></Modal>}
  </>
}

function minorToInput(value, currencyCode) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  const minor = BigInt(value)
  const scale = 10n ** BigInt(digits)
  return digits ? `${minor / scale}.${(minor % scale).toString().padStart(digits, '0')}` : String(minor)
}
