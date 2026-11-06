import {
  collection, deleteDoc, doc, getDocs, query, runTransaction, serverTimestamp, where,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'

const budgetsRef = (uid) => collection(requireDb(), 'users', uid, 'budgets')

export async function listBudgets(uid, periodValue, period = 'monthly') {
  const filterField = period === 'yearly' ? 'year' : 'month'
  const snapshot = await getDocs(query(budgetsRef(uid), where(filterField, '==', periodValue)))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function saveBudget(uid, { month, year, period = 'monthly', categoryId, categoryName, amountMinor }) {
  if (period === 'yearly' ? !/^\d{4}$/.test(year) : !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(period === 'yearly' ? 'Choose a valid budget year.' : 'Choose a valid budget month.')
  if (!/^[1-9][0-9]{0,14}$/.test(String(amountMinor))) throw new Error('Budget amount must be positive.')
  const id = period === 'yearly' ? `yearly_${year}__${categoryId || 'overall'}` : `${month}__${categoryId || 'overall'}`
  const db = requireDb()
  const ref = doc(budgetsRef(uid), id)
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref)
    transaction.set(ref, {
      ...(period === 'yearly' ? { period: 'yearly', year } : { month }),
      categoryId: categoryId || null,
      categoryName: categoryName || null,
      amountMinor: String(amountMinor),
      createdAt: current.exists() ? current.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function deleteBudget(uid, id) {
  await deleteDoc(doc(budgetsRef(uid), id))
}
