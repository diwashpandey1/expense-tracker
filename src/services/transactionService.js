import {
  collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, orderBy, query, runTransaction, startAfter,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { isCalendarDate } from '../lib/dates'
import { assertMonthlyOutflowsWithinIncome, assertTransactionWithinMonthlyIncome, transactionsAfterChange } from '../domain/financialLimits'
import { getMonthlyFinanceData } from './monthlyFinanceService'

const transactionRef = (uid) => collection(requireDb(), 'users', uid, 'transactions')

function validateTransaction(data) {
  if (!['income', 'expense', 'savings_contribution', 'savings_withdrawal'].includes(data.kind)) throw new Error('Choose a valid transaction type.')
  if (!/^([1-9][0-9]{0,14})$/.test(String(data.amountMinor))) throw new Error('Enter a valid positive amount.')
  if (!isCalendarDate(data.occurredOn)) throw new Error('Choose a valid calendar date.')
  if ((data.kind === 'income' || data.kind === 'expense') && (!data.categoryId || !data.categoryName)) throw new Error('Choose a category.')
  if (data.kind.startsWith('savings_') && (!data.goalId || !data.goalName || !data.categoryId || !data.categoryName)) throw new Error('Choose a savings category and goal.')
  if ((data.note ?? '').length > 500) throw new Error('Notes must be 500 characters or fewer.')
}

export async function listTransactions(uid, filters = {}) {
  const constraints = []
  if (filters.from) constraints.push(where('occurredOn', '>=', filters.from))
  if (filters.to) constraints.push(where('occurredOn', '<=', filters.to))
  if (filters.kind) constraints.push(where('kind', '==', filters.kind))
  if (filters.categoryId) constraints.push(where('categoryId', '==', filters.categoryId))
  constraints.push(orderBy('occurredOn', filters.sort === 'oldest' ? 'asc' : 'desc'))
  constraints.push(orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'))
  constraints.push(limit(Math.min(filters.limit ?? 500, 1000)))
  const snapshot = await getDocs(query(transactionRef(uid), ...constraints))
  let items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.voided)
  if (filters.search?.trim()) {
    const term = filters.search.trim().toLocaleLowerCase()
    items = items.filter((item) => [item.note, item.categoryName, item.goalName, item.kind]
      .some((value) => value?.toLocaleLowerCase().includes(term)))
  }
  if (filters.sort === 'amount-high') items.sort((a, b) => BigInt(a.amountMinor) > BigInt(b.amountMinor) ? -1 : 1)
  if (filters.sort === 'amount-low') items.sort((a, b) => BigInt(a.amountMinor) > BigInt(b.amountMinor) ? 1 : -1)
  return items
}

export async function listAllTransactions(uid, filters = {}) {
  const results = []
  let cursor = null
  let hasMore = true
  while (hasMore) {
    const constraints = []
    if (filters.from) constraints.push(where('occurredOn', '>=', filters.from))
    if (filters.to) constraints.push(where('occurredOn', '<=', filters.to))
    constraints.push(orderBy('occurredOn', 'desc'), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'))
    if (cursor) constraints.push(startAfter(cursor))
    constraints.push(limit(400))
    const snapshot = await getDocs(query(transactionRef(uid), ...constraints))
    results.push(...snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.voided))
    cursor = snapshot.docs.at(-1) ?? null
    hasMore = snapshot.size === 400
  }
  return results
}

export async function createTransaction(uid, payload, { operationId = crypto.randomUUID(), currencyCode = 'USD' } = {}) {
  validateTransaction(payload)
  const db = requireDb()
  const ref = doc(transactionRef(uid), operationId)
  const month = payload.occurredOn.slice(0, 7)
  const { transactions } = await getMonthlyFinanceData(uid, month)
  assertTransactionWithinMonthlyIncome(transactions, payload, null, currencyCode)
  if (payload.kind === 'income') {
    const projected = transactionsAfterChange(transactions, month, payload)
    assertMonthlyOutflowsWithinIncome(projected, month, currencyCode)
  }
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists()) return
    transaction.set(ref, {
      ...payload,
      note: (payload.note ?? '').trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
  return operationId
}

export async function editTransaction(uid, id, payload, currencyCode = 'USD') {
  validateTransaction(payload)
  const currentSnapshot = await getDoc(doc(transactionRef(uid), id))
  if (!currentSnapshot.exists()) throw new Error('This transaction no longer exists. Refresh the list and try again.')
  const current = { id, ...currentSnapshot.data() }
  const oldMonth = current.occurredOn.slice(0, 7)
  const newMonth = payload.occurredOn.slice(0, 7)
  const newMonthData = await getMonthlyFinanceData(uid, newMonth)
  assertTransactionWithinMonthlyIncome(newMonthData.transactions, payload, id, currencyCode)

  if (oldMonth === newMonth) {
    if (current.kind === 'income' || payload.kind === 'income') {
      const projected = transactionsAfterChange(newMonthData.transactions, newMonth, payload, id)
      assertMonthlyOutflowsWithinIncome(projected, newMonth, currencyCode)
    }
  } else {
    const oldMonthData = await getMonthlyFinanceData(uid, oldMonth)
    if (current.kind === 'income') {
      const projected = transactionsAfterChange(oldMonthData.transactions, oldMonth, null, id)
      assertMonthlyOutflowsWithinIncome(projected, oldMonth, currencyCode)
    }
    if (payload.kind === 'income') {
      const projected = transactionsAfterChange(newMonthData.transactions, newMonth, payload, id)
      assertMonthlyOutflowsWithinIncome(projected, newMonth, currencyCode)
    }
  }
  await updateDoc(doc(transactionRef(uid), id), {
    ...payload,
    note: (payload.note ?? '').trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTransaction(uid, id, currencyCode = 'USD') {
  const ref = doc(transactionRef(uid), id)
  const currentSnapshot = await getDoc(ref)
  if (!currentSnapshot.exists()) return
  const current = { id, ...currentSnapshot.data() }
  if (current.kind === 'income') {
    const month = current.occurredOn.slice(0, 7)
    const { transactions } = await getMonthlyFinanceData(uid, month)
    const projected = transactionsAfterChange(transactions, month, null, id)
    assertMonthlyOutflowsWithinIncome(projected, month, currencyCode)
  }
  await deleteDoc(ref)
}
