import { collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { toMinorBigInt } from '../domain/financialLedger'

const rows = (uid, name) => collection(requireDb(), 'users', uid, name)

export async function listGoalAllocations(uid) {
  const snapshot = await getDocs(query(rows(uid, 'goalAllocations'), orderBy('updatedAt', 'desc')))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function setGoalAllocation(uid, goalId, amountMinor) {
  const amount = toMinorBigInt(amountMinor, 'Allocation')
  const db = requireDb()
  const ref = doc(rows(uid, 'goalAllocations'), goalId)
  const goalRef = doc(rows(uid, 'goals'), goalId)
  const stateRef = doc(rows(uid, 'financeState'), 'summary')
  await runTransaction(db, async (tx) => {
    const [goalSnapshot, stateSnapshot, currentSnapshot] = await Promise.all([
      tx.get(goalRef), tx.get(stateRef), tx.get(ref),
    ])
    if (!goalSnapshot.exists() || goalSnapshot.data().status !== 'active') throw new Error('Choose an active savings goal.')
    const state = stateSnapshot.exists() ? stateSnapshot.data() : { savingsBalanceMinor: '0', goalAllocatedMinor: '0' }
    const savingsBalance = BigInt(state.savingsBalanceMinor || '0')
    const currentAmount = BigInt(currentSnapshot.data()?.amountMinor || '0')
    const totalAllocated = BigInt(state.goalAllocatedMinor || '0') - currentAmount + amount
    if (totalAllocated > savingsBalance) throw new Error('Goal allocations cannot exceed unallocated money in savings accounts.')
    tx.set(ref, { goalId, goalName: goalSnapshot.data().name, amountMinor: String(amount), createdAt: currentSnapshot.exists() ? currentSnapshot.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() })
    tx.set(stateRef, { ...state, goalAllocatedMinor: String(totalAllocated), updatedAt: serverTimestamp() })
  })
}

export async function removeGoalAllocation(uid, goalId) {
  await setGoalAllocation(uid, goalId, '0')
}
