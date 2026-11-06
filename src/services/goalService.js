import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'

const goalsRef = (uid) => collection(requireDb(), 'users', uid, 'goals')

export async function listGoals(uid) {
  const snapshot = await getDocs(query(goalsRef(uid), orderBy('createdAt', 'desc')))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function createGoal(uid, { name, targetMinor, targetDate }) {
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 80) throw new Error('Goal names must be between 1 and 80 characters.')
  if (!/^[1-9][0-9]{0,14}$/.test(String(targetMinor))) throw new Error('Target amount must be positive.')
  return addDoc(goalsRef(uid), {
    name: cleanName,
    targetMinor: String(targetMinor),
    targetDate: targetDate || null,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateGoal(uid, id, changes) {
  await updateDoc(doc(goalsRef(uid), id), { ...changes, updatedAt: serverTimestamp() })
}

export async function deleteGoal(uid, id) {
  const allocation = await getDoc(doc(collection(requireDb(), 'users', uid, 'goalAllocations'), id))
  if (allocation.exists() && BigInt(allocation.data().amountMinor || '0') > 0n) throw new Error('Release this goal’s savings allocation before deleting it.')
  await deleteDoc(doc(goalsRef(uid), id))
}
