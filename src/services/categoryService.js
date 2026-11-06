import {
  addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query,
  serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { DEFAULT_CATEGORIES } from '../constants/categories'

const categoriesRef = (uid) => collection(requireDb(), 'users', uid, 'categories')
const transactionsRef = (uid) => collection(requireDb(), 'users', uid, 'transactions')
const seededUsers = new Set()
const categorySeedWarnings = new Map()

export function getDefaultCategoryWarning(uid) {
  return categorySeedWarnings.get(uid) || ''
}

export async function ensureDefaultCategories(uid, { force = false } = {}) {
  if (force) seededUsers.delete(uid)
  if (seededUsers.has(uid)) return
  const db = requireDb()
  const collectionRef = categoriesRef(uid)
  const snapshot = await getDocs(collectionRef)
  const existingIds = new Set(snapshot.docs.map((item) => item.id))
  categorySeedWarnings.delete(uid)
  for (const kind of ['expense', 'income', 'saving']) {
    const missing = DEFAULT_CATEGORIES.filter((category) => category.kind === kind && !existingIds.has(category.id))
    if (!missing.length) continue
    const batch = writeBatch(db)
    for (const category of missing) {
      batch.set(doc(collectionRef, category.id), {
        kind: category.kind,
        name: category.name,
        normalizedName: category.name.toLocaleLowerCase(),
        isArchived: false,
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    try {
      await batch.commit()
    } catch (error) {
      if (kind === 'saving' && error?.code === 'permission-denied') {
        categorySeedWarnings.set(uid, 'Expense and income categories are ready. Deploy the latest firestore.rules to enable the original savings categories.')
        continue
      }
      throw error
    }
  }
  seededUsers.add(uid)
}

export async function listCategories(uid, includeArchived = false) {
  await ensureDefaultCategories(uid)
  const snapshot = await getDocs(query(categoriesRef(uid), orderBy('normalizedName')))
  const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  return includeArchived ? rows : rows.filter((item) => !item.isArchived)
}

export async function createCategory(uid, { kind, name }) {
  if (!['income', 'expense', 'saving'].includes(kind)) throw new Error('Choose a valid category type.')
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 60) throw new Error('Category names must be between 1 and 60 characters.')
  const normalizedName = cleanName.toLocaleLowerCase()
  const duplicate = await getDocs(query(categoriesRef(uid), where('kind', '==', kind), where('normalizedName', '==', normalizedName), limit(1)))
  if (!duplicate.empty) throw new Error('A category with that name already exists.')
  return addDoc(categoriesRef(uid), {
    kind,
    name: cleanName,
    normalizedName,
    isArchived: false,
    isDefault: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function renameCategory(uid, category, name) {
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 60) throw new Error('Category names must be between 1 and 60 characters.')
  const normalizedName = cleanName.toLocaleLowerCase()
  const duplicate = await getDocs(query(categoriesRef(uid), where('kind', '==', category.kind), where('normalizedName', '==', normalizedName), limit(1)))
  if (duplicate.docs.some((item) => item.id !== category.id)) throw new Error('A category with that name already exists.')
  await updateDoc(doc(categoriesRef(uid), category.id), { name: cleanName, normalizedName, updatedAt: serverTimestamp() })
}

export async function removeCategory(uid, category) {
  if (category.isDefault) throw new Error('Default categories cannot be removed; archive them instead.')
  const used = await getDocs(query(transactionsRef(uid), where('categoryId', '==', category.id), limit(1)))
  if (!used.empty) {
    await updateDoc(doc(categoriesRef(uid), category.id), { isArchived: true, updatedAt: serverTimestamp() })
    return 'archived'
  }
  await deleteDoc(doc(categoriesRef(uid), category.id))
  return 'deleted'
}

export async function archiveCategory(uid, category) {
  if (category.isDefault) {
    await updateDoc(doc(categoriesRef(uid), category.id), { isArchived: true, updatedAt: serverTimestamp() })
    return
  }
  return removeCategory(uid, category)
}
