import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore'

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
  db = initializeFirestore(app, { localCache: memoryLocalCache() })
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
