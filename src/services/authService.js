import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
  updateProfile as updateAuthProfile,
} from 'firebase/auth'
import { collection, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { requireAuth, requireDb } from '../lib/firebase'
import { DEFAULT_CATEGORIES } from '../constants/categories'
import { ensureDefaultCategories } from './categoryService'
import { eraseUserData } from './dataLifecycleService'

function profilePayload(user, displayName, currencyCode) {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: displayName || user.displayName || user.email?.split('@')[0] || 'User',
    currencyCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export async function createAccount({ email, password, displayName, currencyCode }) {
  const credential = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password)
  await updateAuthProfile(credential.user, { displayName: displayName.trim() })
  const db = requireDb()
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', credential.user.uid), profilePayload(credential.user, displayName.trim(), currencyCode))
  for (const category of DEFAULT_CATEGORIES) {
    batch.set(doc(collection(db, 'users', credential.user.uid, 'categories'), category.id), {
      kind: category.kind,
      name: category.name,
      normalizedName: category.name.toLocaleLowerCase(),
      isArchived: false,
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  return credential.user
}

export async function loginAccount(email, password) {
  const credential = await signInWithEmailAndPassword(requireAuth(), email.trim(), password)
  await ensureProfile(credential.user)
  return credential.user
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(requireAuth(), new GoogleAuthProvider())
  await ensureProfile(credential.user)
  return credential.user
}

export async function deleteAccount(user, password = '') {
  const providers = user.providerData.map((item) => item.providerId)
  if (providers.includes('password')) {
    if (!password) throw new Error('Enter your password to confirm account deletion.')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } else if (providers.includes('google.com')) {
    await reauthenticateWithPopup(user, new GoogleAuthProvider())
  } else {
    throw new Error('This sign-in provider cannot reauthenticate for account deletion yet.')
  }

  await eraseUserData(user.uid)
  await deleteUser(user)
}

export async function ensureProfile(user, currencyCode = 'USD') {
  const db = requireDb()
  const profileRef = doc(db, 'users', user.uid)
  const existing = await getDoc(profileRef)
  if (existing.exists()) {
    await ensureDefaultCategories(user.uid)
    return { ...existing.data(), uid: user.uid }
  }

  const batch = writeBatch(db)
  batch.set(profileRef, profilePayload(user, user.displayName, currencyCode))
  for (const category of DEFAULT_CATEGORIES) {
    batch.set(doc(collection(db, 'users', user.uid, 'categories'), category.id), {
      kind: category.kind,
      name: category.name,
      normalizedName: category.name.toLocaleLowerCase(),
      isArchived: false,
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  const created = await getDoc(profileRef)
  return { ...created.data(), uid: user.uid }
}

export async function readProfile(uid) {
  const snapshot = await getDoc(doc(requireDb(), 'users', uid))
  return snapshot.exists() ? { ...snapshot.data(), uid } : null
}

export async function logoutAccount() {
  await signOut(requireAuth())
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(requireAuth(), email.trim())
}

export async function updateProfile(user, { displayName, currencyCode }) {
  const cleanName = displayName.trim()
  if (!cleanName || cleanName.length > 80) throw new Error('Display names must be between 1 and 80 characters.')
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Choose a valid currency code.')
  await updateAuthProfile(user, { displayName: cleanName })
  await updateDoc(doc(requireDb(), 'users', user.uid), { displayName: cleanName, currencyCode, updatedAt: serverTimestamp() })
  return readProfile(user.uid)
}
