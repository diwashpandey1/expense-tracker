import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentSingleTabManager, connectFirestoreEmulator } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseReady = Object.values(firebaseConfig).every(Boolean)

let auth = null
let db = null

if (firebaseReady) {
  const app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  try {
    const localCache = import.meta.env.MODE === 'test' || typeof indexedDB === 'undefined'
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentSingleTabManager() })
    db = initializeFirestore(app, { localCache })
  } catch {
    try { db = initializeFirestore(app, { localCache: memoryLocalCache() }) }
    catch { db = getFirestore(app) }
  }
  void setPersistence(auth, browserLocalPersistence)

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
}

export { auth, db }

export function requireAuth() {
  if (!auth) throw new Error('Firebase Authentication is not configured. Add the fresh project values to .env.')
  return auth
}

export function requireDb() {
  if (!db) throw new Error('Cloud Firestore is not configured. Add the fresh project values to .env.')
  return db
}
