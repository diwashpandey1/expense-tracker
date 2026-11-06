import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { readFile } from 'node:fs/promises'
import { createAccount, editFinancialEvent, InsufficientBalanceError, listAccounts, postFinancialEvent, voidFinancialEvent } from '../services/ledgerService'
import { createGoal } from '../services/goalService'
import { listGoalAllocations, setGoalAllocation } from '../services/goalAllocationService'

const mockedDb = vi.hoisted(() => ({ current: null }))
vi.mock('../lib/firebase', () => ({ requireDb: () => mockedDb.current }))

let testEnv
let db

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-expense-ledger',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
  db = testEnv.authenticatedContext('ledger-user').firestore()
  mockedDb.current = db
  await setDoc(doc(db, 'users/ledger-user/categories/salary'), { kind: 'income', name: 'Salary', normalizedName: 'salary', isArchived: false, isDefault: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  await setDoc(doc(db, 'users/ledger-user/categories/food'), { kind: 'expense', name: 'Food', normalizedName: 'food', isArchived: false, isDefault: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
})

afterAll(async () => { mockedDb.current = null; await testEnv?.cleanup() })

describe('Firestore financial ledger workflows', () => {
  it('posts income once, funds an expense atomically from savings, and reverses the full event', async () => {
    await createAccount('ledger-user', { name: 'Wallet', accountType: 'cash', classification: 'spending', currencyCode: 'USD', openingBalanceMinor: '10000' })
    await createAccount('ledger-user', { name: 'Emergency savings', accountType: 'bank', classification: 'savings', currencyCode: 'USD', openingBalanceMinor: '5000' })
    const accounts = await listAccounts('ledger-user')
    const wallet = accounts.find((account) => account.name === 'Wallet')
    const savings = accounts.find((account) => account.name === 'Emergency savings')

    const goal = await createGoal('ledger-user', { name: 'Emergency fund', targetMinor: '10000' })
    await setGoalAllocation('ledger-user', goal.id, '4000')
    await expect(setGoalAllocation('ledger-user', goal.id, '5001')).rejects.toThrow('Goal allocations cannot exceed unallocated money in savings accounts.')

    const income = { kind: 'income', accountId: wallet.id, categoryId: 'salary', categoryName: 'Salary', amountMinor: '2000', occurredOn: '2026-11-06', note: 'pay', currencyCode: 'USD' }
    await postFinancialEvent('ledger-user', income, { operationId: 'income-once' })
    await postFinancialEvent('ledger-user', income, { operationId: 'income-once' })
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(12000)

    const expense = { kind: 'expense', accountId: wallet.id, categoryId: 'food', categoryName: 'Food', amountMinor: '14000', occurredOn: '2026-11-06', note: 'groceries', currencyCode: 'USD' }
    await expect(postFinancialEvent('ledger-user', expense, { operationId: 'expense-funded' })).rejects.toBeInstanceOf(InsufficientBalanceError)
    await postFinancialEvent('ledger-user', expense, { operationId: 'expense-funded', savingsAccountId: savings.id })
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(0)
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${savings.id}`))).data().balanceMinor).toBe(3000)
    expect((await listGoalAllocations('ledger-user')).find((item) => item.goalId === goal.id).amountMinor).toBe('3000')

    await voidFinancialEvent('ledger-user', 'expense-funded')
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(12000)
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${savings.id}`))).data().balanceMinor).toBe(5000)
    expect((await listGoalAllocations('ledger-user')).find((item) => item.goalId === goal.id).amountMinor).toBe('4000')

    await editFinancialEvent('ledger-user', 'income-once', { ...income, amountMinor: '3000', note: 'corrected pay' })
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(13000)
    await voidFinancialEvent('ledger-user', 'income-once')
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(10000)

    await postFinancialEvent('ledger-user', { kind: 'transfer', amountMinor: '1000', occurredOn: '2026-11-06', accountId: wallet.id, destinationAccountId: savings.id, currencyCode: 'USD', note: 'move to savings' }, { operationId: 'wallet-to-savings' })
    const afterTransfer = await listAccounts('ledger-user')
    expect(afterTransfer.reduce((sum, account) => sum + account.balanceMinor, 0)).toBe(15000)
    expect(afterTransfer.find((account) => account.id === wallet.id).balanceMinor).toBe(9000)
    expect(afterTransfer.find((account) => account.id === savings.id).balanceMinor).toBe(6000)
  })
})
