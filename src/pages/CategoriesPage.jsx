import { useCallback, useEffect, useState } from 'react'
import { Archive, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ensureDefaultCategories, getDefaultCategoryWarning, listCategories, createCategory, renameCategory, removeCategory } from '../services/categoryService'
import { explainFirebaseError } from '../lib/firebaseErrors'
import { Button, Card, EmptyState, Field, InlineError, LoadingState, Modal, PageHeading, SelectField } from '../components/ui'

export default function CategoriesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const refresh = useCallback(async (force = false) => {
    try {
      if (force) await ensureDefaultCategories(user.uid, { force: true })
      setRows(await listCategories(user.uid, true))
      setError('')
      setNotice(getDefaultCategoryWarning(user.uid))
    } catch (caught) {
      setError(explainFirebaseError(caught, 'categories'))
    } finally { setLoading(false) }
  }, [user.uid])
  useEffect(() => { refresh() }, [refresh])
  async function submit(event) { event.preventDefault(); try { if (form.id) await renameCategory(user.uid, form, form.name); else await createCategory(user.uid, form); setForm(null); setError(''); await refresh() } catch (caught) { setError(caught.message || 'Could not save category.') } }
  async function remove(row) { try { const result = await removeCategory(user.uid, row); setError(result === 'archived' ? 'This category is used by a transaction, so it was archived.' : ''); await refresh() } catch (caught) { setError(caught.message || 'Could not remove category.') } }
  return <><PageHeading eyebrow="Make it yours" title="Categories" description="Organize income, expenses, and savings with categories that fit your life." action={<Button onClick={() => setForm({ kind: 'expense', name: '' })}><Plus size={17}/>New category</Button>}/>{error && <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><InlineError>{error}</InlineError><Button variant="secondary" onClick={() => { setLoading(true); refresh(true) }}>Retry</Button></div>}{notice && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{notice}</p>}<Card className="!p-0">{loading ? <LoadingState/> : rows.length ? <div className="divide-y divide-[#f0f2ee]">{rows.map((row) => <div key={row.id} className="flex items-center gap-3 px-5 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0f5eb] text-[#60804d]"><Tag size={17}/></span><div className="min-w-0 flex-1"><p className="font-semibold text-[#304337]">{row.name}{row.isArchived && <span className="ml-2 text-xs font-medium text-[#919b94]">Archived</span>}</p><p className="mt-1 text-xs capitalize text-[#8a958d]">{row.kind}{row.isDefault ? ' · default' : ''}</p></div><button aria-label={`Rename ${row.name}`} onClick={() => setForm(row)} className="rounded-lg p-2 text-[#708176] hover:bg-[#eef2ec]"><Pencil size={16}/></button>{!row.isDefault && <button aria-label={`Delete ${row.name}`} onClick={() => remove(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button>}{row.isDefault && <Archive size={16} className="mr-2 text-[#9aa49d]"/>}</div>)}</div> : <EmptyState title="No categories yet" description="Add a few categories to make your transactions easier to understand."/>}</Card>{form && <Modal wide title={form.id ? 'Rename category' : 'Create category'} onClose={() => setForm(null)}><form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">{!form.id && <SelectField label="Type" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option><option value="saving">Savings</option></SelectField>}<Field label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={60} required/><div className="flex justify-end gap-2 pt-1 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Save category</Button></div></form></Modal>}</>
}
