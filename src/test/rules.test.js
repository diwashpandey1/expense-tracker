import { afterAll, beforeAll, describe, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { readFile } from 'node:fs/promises'
import { DEFAULT_PREFERENCES } from '../services/preferencesService'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-expense-tracker',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(async () => { await testEnv?.cleanup() })

describe('Firestore ownership and validation rules', () => {
  it('denies unauthenticated access and cross-user reads', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/alice')))
    await assertFails(getDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'users/alice')))
  })

  it('allows a user to create their own profile but not change immutable email identity', async () => {
    const db = testEnv.authenticatedContext('alice', { email: 'alice@example.test' }).firestore()
    await assertSucceeds(setDoc(doc(db, 'users/alice'), {
      uid: 'alice', email: 'alice@example.test', displayName: 'Alice', currencyCode: 'USD',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    await assertFails(setDoc(doc(db, 'users/alice'), { email: 'other@example.test' }, { merge: true }))
  })

  it('allows only correctly scoped user categories', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    const category = { kind: 'expense', name: 'Food', normalizedName: 'food', isArchived: false, isDefault: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    await assertSucceeds(setDoc(doc(db, 'users/alice/categories/food'), category))
    await assertSucceeds(setDoc(doc(db, 'users/alice/categories/emergency-default'), { ...category, kind: 'saving', name: 'Emergency Funds', normalizedName: 'emergency funds', isDefault: true }))
    await assertFails(setDoc(doc(db, 'users/bob/categories/food'), category))
    await assertFails(setDoc(doc(db, 'users/alice/categories/bad'), { ...category, normalizedName: 'not-food' }))
  })

  it('allows owners to persist preferences and denies cross-user access', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    await assertSucceeds(setDoc(doc(alice, 'users/alice/settings/preferences'), { ...DEFAULT_PREFERENCES, updatedAt: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(alice, 'users/alice/settings/preferences')))
    await assertFails(getDoc(doc(bob, 'users/alice/settings/preferences')))
    await assertFails(setDoc(doc(bob, 'users/alice/settings/preferences'), { ...DEFAULT_PREFERENCES, updatedAt: serverTimestamp() }))
  })

  it('requires saving movements to reference the same user goal and saving category', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await setDoc(doc(db, 'users/alice/goals/trip'), {
      name: 'Trip', targetMinor: '100000', targetDate: null, status: 'active',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'users/alice/categories/emergency-transaction'), {
      kind: 'saving', name: 'Emergency Funds', normalizedName: 'emergency funds', isArchived: false,
      isDefault: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await assertSucceeds(setDoc(doc(db, 'users/alice/transactions/savings-entry'), {
      kind: 'savings_contribution', amountMinor: '5000', occurredOn: '2026-11-06',
      categoryId: 'emergency-transaction', categoryName: 'Emergency Funds', goalId: 'trip', goalName: 'Trip',
      note: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })

  it('allows an atomic account balance posting and blocks a negative account balance', async () => {
    const db = testEnv.authenticatedContext('ledger-user').firestore()
    const account = doc(db, 'users/ledger-user/accounts/wallet')
    await setDoc(doc(db, 'users/ledger-user/categories/salary'), {
      kind: 'income', name: 'Salary', normalizedName: 'salary', isArchived: false, isDefault: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await assertSucceeds(setDoc(account, {
      name: 'Wallet', accountType: 'cash', classification: 'spending', currencyCode: 'USD',
      openingBalanceMinor: '0', balanceMinor: 0, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    const batch = writeBatch(db)
    batch.set(doc(db, 'users/ledger-user/financialOperations/income-1'), {
      uid: 'ledger-user', kind: 'income', deltas: { wallet: 5000 }, createdAt: serverTimestamp(),
    })
    const event = {
      kind: 'income', operationKind: 'income', amountMinor: '5000', accountId: 'wallet', destinationAccountId: null,
      savingsAccountId: null, categoryId: 'salary', categoryName: 'Salary', occurredOn: '2026-11-06', note: '',
      postings: [{ accountId: 'wallet', deltaMinor: '5000' }], lastOperationId: 'income-1',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }
    batch.set(doc(db, 'users/ledger-user/ledgerEntries/income-1'), event)
    batch.set(doc(db, 'users/ledger-user/transactions/income-1'), event)
    batch.update(account, { balanceMinor: 5000, lastOperationId: 'income-1', updatedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())

    const bad = writeBatch(db)
    bad.set(doc(db, 'users/ledger-user/financialOperations/overspend'), {
      uid: 'ledger-user', kind: 'expense', deltas: { wallet: -6000 }, createdAt: serverTimestamp(),
    })
    bad.update(account, { balanceMinor: -1000, lastOperationId: 'overspend', updatedAt: serverTimestamp() })
    await assertFails(bad.commit())
  })

  it('allows users to delete their own data but blocks cross-user deletion', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const bob = testEnv.authenticatedContext('bob').firestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'users/alice'), { uid: 'alice', email: 'alice@example.test', displayName: 'Alice', currencyCode: 'USD', createdAt: new Date(), updatedAt: new Date() })
    })
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice')))
    await assertFails(deleteDoc(doc(bob, 'users/alice')))
  })

  it('allows yearly budgets while preserving the existing monthly budget shape', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(setDoc(doc(db, 'users/alice/budgets/2026__overall'), {
      month: '2026-11', categoryId: null, categoryName: null, amountMinor: '100000',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(setDoc(doc(db, 'users/alice/budgets/yearly_2026__overall'), {
      period: 'yearly', year: '2026', categoryId: null, categoryName: null, amountMinor: '1200000',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })
})
