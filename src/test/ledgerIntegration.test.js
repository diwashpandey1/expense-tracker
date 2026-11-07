import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { readFile } from 'node:fs/promises'
import { createAccount, editFinancialEvent, InsufficientBalanceError, listAccounts, postFinancialEvent, voidFinancialEvent } from '../services/ledgerService'
import { createGoal } from '../services/goalService'
import { listGoalAllocations, setGoalAllocation } from '../services/goalAllocationService'
import { completeOnboarding, readOnboardingDraft, saveOnboardingDraft } from '../services/onboardingService'

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

    await postFinancialEvent('ledger-user', { kind: 'external_transfer_in', amountMinor: '5000', occurredOn: '2026-11-06', accountId: wallet.id, categoryId: null, categoryName: null, currencyCode: 'USD', note: 'outside transfer' }, { operationId: 'external-in-once' })
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(14000)
    await postFinancialEvent('ledger-user', { kind: 'external_transfer_out', amountMinor: '1000', occurredOn: '2026-11-06', accountId: wallet.id, categoryId: null, categoryName: null, currencyCode: 'USD', note: '' }, { operationId: 'external-out-once' })
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(13000)
    await voidFinancialEvent('ledger-user', 'external-out-once')
    expect((await getDoc(doc(db, `users/ledger-user/accounts/${wallet.id}`))).data().balanceMinor).toBe(14000)
  })

  it('completes onboarding atomically, records opening balances outside income, and is resumable/idempotent', async () => {
    const onboardingDb = testEnv.authenticatedContext('onboarding-user', { email: 'onboarding@example.test' }).firestore()
    const previousDb = mockedDb.current
    mockedDb.current = onboardingDb
    try {
      await setDoc(doc(onboardingDb, 'users/onboarding-user'), {
        uid: 'onboarding-user', email: 'onboarding@example.test', displayName: 'Asha', currencyCode: 'USD', onboardingStatus: 'not_started',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      const answers = {
        profile: { fullName: 'Asha Rai', displayName: 'Asha', currencyCode: 'NPR', countryCode: 'NP', timeZone: 'Asia/Kathmandu' },
        income: { occupation: 'Student', incomeSources: ['Family support'], incomeFrequency: 'Monthly', incomeEstimate: { mode: 'prefer_not_to_say' }, incomeChannels: ['Physical cash'] },
        habits: { trackingMethod: 'Tracked manually', averageIncome: '20000', averageExpenditure: '', averageSavings: '', challenges: ['Difficulty saving'] },
        household: { householdSize: '3' },
        goals: { objectives: ['Save more money'], primaryObjective: 'Save more money' },
        accounts: { trackingStartDate: '2026-11-07', items: [
          { id: 'cash-wallet-0001', name: 'Cash Wallet', accountType: 'cash', classification: 'spending', openingBalance: '15000', provider: '', purpose: 'Daily spending', description: '', subtype: 'Cash wallet' },
          { id: 'bank-account-0001', name: 'Empty bank', accountType: 'bank', classification: 'spending', openingBalance: '0', provider: '', purpose: '', description: '', subtype: '' },
        ] },
      }
      await saveOnboardingDraft('onboarding-user', 2, answers)
      expect((await readOnboardingDraft('onboarding-user')).currentStep).toBe(2)
      await completeOnboarding('onboarding-user', answers)
      await completeOnboarding('onboarding-user', answers)
      const user = (await getDoc(doc(onboardingDb, 'users/onboarding-user'))).data()
      const cash = (await getDoc(doc(onboardingDb, 'users/onboarding-user/accounts/cash-wallet-0001'))).data()
      const opening = (await getDoc(doc(onboardingDb, 'users/onboarding-user/ledgerEntries/opening-cash-wallet-0001'))).data()
      const transactions = await getDocs(collection(onboardingDb, 'users/onboarding-user/transactions'))
      expect(user.onboardingStatus).toBe('completed')
      expect(user.currencyCode).toBe('NPR')
      expect(cash.balanceMinor).toBe(1500000)
      expect(opening.kind).toBe('opening_balance')
      expect(opening.amountMinor).toBe('1500000')
      expect(transactions.size).toBe(0)
      expect(await readOnboardingDraft('onboarding-user')).toBeNull()
    } finally { mockedDb.current = previousDb }
  })
})
