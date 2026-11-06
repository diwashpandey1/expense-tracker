import { collection, getDocs, query, where } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { monthRange } from '../lib/dates'

export async function getMonthlyFinanceData(uid, month) {
  const db = requireDb()
  const range = monthRange(month)
  const transactions = collection(db, 'users', uid, 'transactions')
  const budgets = collection(db, 'users', uid, 'budgets')
  const [transactionSnapshot, budgetSnapshot] = await Promise.all([
    getDocs(query(transactions, where('occurredOn', '>=', range.from), where('occurredOn', '<=', range.to))),
    getDocs(query(budgets, where('month', '==', month))),
  ])
  return {
    transactions: transactionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    budgets: budgetSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
  }
}

export async function getMonthlyTransactions(uid, month) {
  const db = requireDb()
  const range = monthRange(month)
  const collectionRef = collection(db, 'users', uid, 'transactions')
  const snapshot = await getDocs(query(collectionRef, where('occurredOn', '>=', range.from), where('occurredOn', '<=', range.to)))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}
