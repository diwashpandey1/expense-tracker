import { collection, deleteDoc, doc, documentId, getDocs, limit, orderBy, query, startAfter, writeBatch } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'

const USER_COLLECTIONS = ['transactions', 'ledgerEntries', 'financialOperations', 'auditEvents', 'accounts', 'goalAllocations', 'financeState', 'settings', 'recurringSchedules', 'recurringOccurrences', 'budgets', 'goals', 'categories', 'currencyRates', 'onboarding', 'financialProfile']

async function clearCollection(uid, collectionName) {
  const db = requireDb()
  const ref = collection(db, 'users', uid, collectionName)
  let cursor = null
  while (true) {
    const constraints = [orderBy(documentId()), limit(400)]
    if (cursor) constraints.splice(1, 0, startAfter(cursor))
    const snapshot = await getDocs(query(ref, ...constraints))
    if (snapshot.empty) return
    const batch = writeBatch(db)
    snapshot.docs.forEach((item) => batch.delete(item.ref))
    await batch.commit()
    if (snapshot.size < 400) return
    cursor = snapshot.docs.at(-1)
  }
}

export async function resetFinanceData(uid) {
  for (const name of ['transactions', 'ledgerEntries', 'financialOperations', 'auditEvents', 'accounts', 'goalAllocations', 'financeState', 'settings', 'recurringSchedules', 'recurringOccurrences', 'budgets', 'goals']) await clearCollection(uid, name)
}

export async function eraseUserData(uid) {
  for (const name of USER_COLLECTIONS) await clearCollection(uid, name)
  await deleteDoc(doc(requireDb(), 'users', uid))
}
