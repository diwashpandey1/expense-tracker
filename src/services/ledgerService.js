import {
  collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, where,
} from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { isCalendarDate } from '../lib/dates'
import { requireNonnegativeBalance, toMinorBigInt } from '../domain/financialLedger'
import { localDateString } from '../lib/dates'

const userCollection = (uid, name) => collection(requireDb(), 'users', uid, name)
const accountDoc = (uid, id) => doc(userCollection(uid, 'accounts'), id)
const financeStateDoc = (uid) => doc(userCollection(uid, 'financeState'), 'summary')
const emptyFinanceState = () => ({ savingsBalanceMinor: '0', goalAllocatedMinor: '0', updatedAt: serverTimestamp() })
const safeNumber = (value) => {
  const amount = BigInt(value)
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Amount is above the supported limit.')
  return Number(amount)
}

export class InsufficientBalanceError extends Error {
  constructor(shortfallMinor, savingsAccounts) {
    super('This spending account does not have enough money. Confirm a transfer from savings to continue.')
    this.name = 'InsufficientBalanceError'
    this.shortfallMinor = String(shortfallMinor)
    this.savingsAccounts = savingsAccounts
  }
}

export async function listAccounts(uid, { includeArchived = false } = {}) {
  const snapshot = await getDocs(query(userCollection(uid, 'accounts'), orderBy('createdAt', 'asc')))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => includeArchived || item.status === 'active')
}

export async function createAccount(uid, { name, accountType, classification, currencyCode, openingBalanceMinor = '0' }) {
  const cleanName = String(name || '').trim()
  if (!cleanName || cleanName.length > 80) throw new Error('Account name must be between 1 and 80 characters.')
  if (!['cash', 'bank', 'ewallet', 'other'].includes(accountType)) throw new Error('Choose a valid account type.')
  if (!['spending', 'savings'].includes(classification)) throw new Error('Choose spending or savings classification.')
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Choose a valid currency.')
  const opening = toMinorBigInt(openingBalanceMinor, 'Opening balance')
  const db = requireDb()
  const ref = doc(userCollection(uid, 'accounts'))
  const auditRef = doc(userCollection(uid, 'auditEvents'), `account-open-${ref.id}`)
  await runTransaction(db, async (tx) => {
    const stateRef = financeStateDoc(uid)
    const stateSnapshot = await tx.get(stateRef)
    const state = stateSnapshot.exists() ? stateSnapshot.data() : emptyFinanceState()
    tx.set(ref, {
      name: cleanName,
      accountType,
      classification,
      currencyCode,
      openingBalanceMinor: String(opening),
      balanceMinor: safeNumber(opening),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    if (classification === 'savings') state.savingsBalanceMinor = String(BigInt(state.savingsBalanceMinor || '0') + opening)
    tx.set(stateRef, { ...state, updatedAt: serverTimestamp() })
    tx.set(auditRef, { action: 'account_created', accountId: ref.id, openingBalanceMinor: String(opening), createdAt: serverTimestamp() })
  })
  return ref.id
}

export async function updateAccount(uid, id, changes) {
  const name = String(changes.name || '').trim()
  if (!name || name.length > 80) throw new Error('Account name must be between 1 and 80 characters.')
  if (!['cash', 'bank', 'ewallet', 'other'].includes(changes.accountType)) throw new Error('Choose a valid account type.')
  if (!['spending', 'savings'].includes(changes.classification)) throw new Error('Choose spending or savings classification.')
  const db = requireDb()
  await runTransaction(db, async (tx) => {
    const ref = accountDoc(uid, id)
    const snapshot = await tx.get(ref)
    const stateRef = financeStateDoc(uid)
    const stateSnapshot = await tx.get(stateRef)
    const state = stateSnapshot.exists() ? stateSnapshot.data() : emptyFinanceState()
    if (!snapshot.exists() || snapshot.data().status !== 'active') throw new Error('This account is unavailable.')
    const current = snapshot.data()
    let savingsBalance = BigInt(state.savingsBalanceMinor || '0')
    const allocated = BigInt(state.goalAllocatedMinor || '0')
    if (current.classification === 'savings' && changes.classification !== 'savings') {
      const remainingSavings = savingsBalance - BigInt(current.balanceMinor || 0)
      if (allocated > remainingSavings) throw new Error('Release goal allocations before changing this savings account to spending.')
      savingsBalance = remainingSavings
    }
    if (current.classification !== 'savings' && changes.classification === 'savings') savingsBalance += BigInt(current.balanceMinor || 0)
    tx.update(ref, { name, accountType: changes.accountType, classification: changes.classification, updatedAt: serverTimestamp() })
    tx.set(stateRef, { ...state, savingsBalanceMinor: String(savingsBalance), updatedAt: serverTimestamp() })
  })
}

export async function archiveAccount(uid, id) {
  const db = requireDb()
  await runTransaction(db, async (tx) => {
    const ref = accountDoc(uid, id)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) return
    if (snapshot.data().balanceMinor !== 0) throw new Error('Transfer the remaining balance before archiving this account.')
    tx.update(ref, { status: 'archived', updatedAt: serverTimestamp() })
  })
}

export async function adjustAccountBalance(uid, id, { newBalanceMinor, reason }) {
  const target = toMinorBigInt(newBalanceMinor, 'New balance')
  const note = String(reason || '').trim()
  if (!note || note.length > 240) throw new Error('Add a reason of up to 240 characters for this adjustment.')
  const db = requireDb()
  const operationId = `adjust-${id}-${crypto.randomUUID()}`
  const accountRef = accountDoc(uid, id)
  const operationRef = doc(userCollection(uid, 'financialOperations'), operationId)
  const entryRef = doc(userCollection(uid, 'ledgerEntries'), operationId)
  const auditRef = doc(userCollection(uid, 'auditEvents'), operationId)
  await runTransaction(db, async (tx) => {
    const accountSnapshot = await tx.get(accountRef)
    const stateRef = financeStateDoc(uid)
    const stateSnapshot = await tx.get(stateRef)
    const state = stateSnapshot.exists() ? stateSnapshot.data() : emptyFinanceState()
    if (!accountSnapshot.exists() || accountSnapshot.data().status !== 'active') throw new Error('This account is unavailable.')
    const account = accountSnapshot.data()
    const oldBalance = BigInt(account.balanceMinor)
    const delta = target - oldBalance
    if (delta === 0n) return
    if (account.classification === 'savings' && delta < 0n) {
      const savingsAfter = BigInt(state.savingsBalanceMinor || '0') + delta
      const allocated = BigInt(state.goalAllocatedMinor || '0')
      if (allocated > savingsAfter) throw new Error('Release goal allocations before reducing savings below the allocated total.')
    }
    const savingsBalance = account.classification === 'savings' ? BigInt(state.savingsBalanceMinor || '0') + delta : BigInt(state.savingsBalanceMinor || '0')
    tx.update(accountRef, { balanceMinor: safeNumber(target), lastOperationId: operationId, updatedAt: serverTimestamp() })
    tx.set(stateRef, { ...state, savingsBalanceMinor: String(savingsBalance), updatedAt: serverTimestamp() })
    tx.set(operationRef, { uid, kind: 'balance_adjustment', deltas: { [id]: safeNumber(delta) }, createdAt: serverTimestamp() })
    const entry = { kind: 'adjustment', operationKind: 'balance_adjustment', amountMinor: String(delta < 0n ? -delta : delta), deltaMinor: String(delta), accountId: id, lastOperationId: operationId, occurredOn: localDateString(), note, postings: [{ accountId: id, deltaMinor: String(delta) }], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    tx.set(entryRef, entry)
    tx.set(auditRef, { action: 'account_balance_adjusted', accountId: id, beforeBalanceMinor: String(oldBalance), afterBalanceMinor: String(target), reason: note, createdAt: serverTimestamp() })
  })
}

export async function listLedgerEntries(uid, { from, to } = {}) {
  const constraints = []
  if (from) constraints.push(where('occurredOn', '>=', from))
  if (to) constraints.push(where('occurredOn', '<=', to))
  constraints.push(orderBy('occurredOn', 'desc'))
  const snapshot = await getDocs(query(userCollection(uid, 'ledgerEntries'), ...constraints))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => (!from || item.occurredOn >= from) && (!to || item.occurredOn <= to))
}

export async function listAccountHistory(uid, accountId) {
  const entries = await listLedgerEntries(uid)
  return entries.filter((entry) => !entry.voided && (entry.postings || []).some((posting) => posting.accountId === accountId))
    .map((entry) => ({ ...entry, accountDeltaMinor: entry.postings.find((posting) => posting.accountId === accountId).deltaMinor }))
}

export async function listFinancialTransactions(uid, { from, to } = {}) {
  const snapshot = await getDocs(query(userCollection(uid, 'transactions'), orderBy('occurredOn', 'desc')))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.accountId && !item.voided && (!from || item.occurredOn >= from) && (!to || item.occurredOn <= to))
}

function eventDeltas(event) {
  return Object.fromEntries((event.postings || []).map((posting) => [posting.accountId, BigInt(posting.deltaMinor)]))
}

function validateEventPayload(input) {
  const amount = toMinorBigInt(input.amountMinor)
  if (amount <= 0n || !isCalendarDate(input.occurredOn)) throw new Error('Enter a positive amount and valid date.')
  if (!['income', 'expense', 'transfer'].includes(input.kind)) throw new Error('Choose a valid event type.')
  if ((input.kind === 'income' || input.kind === 'expense') && (!input.categoryId || !input.categoryName)) throw new Error('Choose a category.')
  return amount
}

export async function editFinancialEvent(uid, id, input) {
  const amount = validateEventPayload(input)
  const db = requireDb()
  const entryRef = doc(userCollection(uid, 'ledgerEntries'), id)
  const txRef = doc(userCollection(uid, 'transactions'), id)
  const auditRef = doc(userCollection(uid, 'auditEvents'), `edit-${id}-${crypto.randomUUID()}`)
  const operationId = `edit-${id}-${crypto.randomUUID()}`
  const operationRef = doc(userCollection(uid, 'financialOperations'), operationId)
  await runTransaction(db, async (tx) => {
    const entrySnapshot = await tx.get(entryRef)
    if (!entrySnapshot.exists() || entrySnapshot.data().voided) throw new Error('This ledger transaction no longer exists.')
    const old = entrySnapshot.data()
    if (old.kind !== input.kind) throw new Error('A posted transaction type cannot be changed. Delete it and create a new transaction.')
    if (old.allocationAdjustments?.length) throw new Error('Void this transaction and create a replacement to preserve its savings-goal allocation history.')
    if ((old.kind === 'transfer' || old.savingsAccountId) && amount !== BigInt(old.amountMinor)) throw new Error('To change this linked savings transfer amount, void it and create a replacement so goal allocations stay correct.')
    const oldDeltas = eventDeltas(old)
    const ids = [...new Set([...Object.keys(oldDeltas), input.accountId, ...(input.destinationAccountId ? [input.destinationAccountId] : [])])]
    const refs = ids.map((accountId) => accountDoc(uid, accountId))
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)))
    const accounts = new Map(snapshots.map((snapshot, index) => [ids[index], snapshot.exists() ? { id: ids[index], ...snapshot.data() } : null]))
    const stateRef = financeStateDoc(uid)
    const stateSnapshot = await tx.get(stateRef)
    const state = stateSnapshot.exists() ? stateSnapshot.data() : emptyFinanceState()
    const base = new Map(ids.map((accountId) => [accountId, BigInt(accounts.get(accountId)?.balanceMinor ?? 0) - (oldDeltas[accountId] || 0n)]))
    const next = {}
    let savingsAccountId = null
    if (input.kind === 'income') {
      const destination = accounts.get(input.accountId)
      if (!destination || destination.status !== 'active') throw new Error('Choose an active account for income.')
      if (destination.currencyCode !== input.currencyCode) throw new Error('Account currency must match your profile currency.')
      next[input.accountId] = amount
    }
    else if (input.kind === 'expense') {
      const source = accounts.get(input.accountId)
      if (!source || source.classification !== 'spending' || source.status !== 'active') throw new Error('Choose an active spending account.')
      const shortfall = amount > base.get(input.accountId) ? amount - base.get(input.accountId) : 0n
      if (shortfall > 0n) {
        savingsAccountId = old.savingsAccountId
        const savings = accounts.get(savingsAccountId)
        if (!savings || savings.classification !== 'savings' || base.get(savingsAccountId) < shortfall) throw new Error('The edited expense needs a savings account with enough available funds.')
        next[input.accountId] = shortfall - amount
        next[savingsAccountId] = -shortfall
      } else next[input.accountId] = -amount
    } else {
      const source = accounts.get(input.accountId)
      const destination = accounts.get(input.destinationAccountId)
      if (!source || !destination || source.status !== 'active' || destination.status !== 'active' || input.accountId === input.destinationAccountId) throw new Error('Choose two different active accounts.')
      if (source.currencyCode !== destination.currencyCode || source.currencyCode !== input.currencyCode) throw new Error('Transfers require accounts that match your profile currency.')
      if (base.get(input.accountId) < amount) throw new Error('The edited transfer would make the source balance negative.')
      next[input.accountId] = -amount
      next[input.destinationAccountId] = amount
    }
    for (const accountId of ids) {
      const delta = next[accountId] || 0n
      const value = base.get(accountId) + delta
      requireNonnegativeBalance(value, accounts.get(accountId)?.name)
      tx.update(refs[ids.indexOf(accountId)], { balanceMinor: safeNumber(value), lastOperationId: operationId, updatedAt: serverTimestamp() })
    }
    const netDeltas = Object.fromEntries(ids.map((accountId) => [accountId, safeNumber((next[accountId] || 0n) - (oldDeltas[accountId] || 0n))]))
    const savingsDelta = ids.reduce((sum, accountId) => accounts.get(accountId)?.classification === 'savings' ? sum + BigInt(netDeltas[accountId]) : sum, 0n)
    tx.set(stateRef, { ...state, savingsBalanceMinor: String(BigInt(state.savingsBalanceMinor || '0') + savingsDelta), updatedAt: serverTimestamp() })
    tx.set(operationRef, { uid, kind: 'transaction_edit', deltas: netDeltas, createdAt: serverTimestamp() })
    const storedInput = { ...input }
    delete storedInput.currencyCode
    const updated = { ...old, ...storedInput, destinationAccountId: input.kind === 'transfer' ? input.destinationAccountId : null, savingsAccountId, lastOperationId: operationId, amountMinor: String(amount), postings: Object.entries(next).filter(([, delta]) => delta !== 0n).map(([accountId, delta]) => ({ accountId, deltaMinor: String(delta) })), updatedAt: serverTimestamp() }
    tx.set(entryRef, updated)
    tx.set(txRef, updated)
    tx.set(auditRef, { action: 'transaction_edited', transactionId: id, before: old, createdAt: serverTimestamp() })
  })
}

export async function voidFinancialEvent(uid, id) {
  const db = requireDb()
  const entryRef = doc(userCollection(uid, 'ledgerEntries'), id)
  const txRef = doc(userCollection(uid, 'transactions'), id)
  const auditRef = doc(userCollection(uid, 'auditEvents'), `void-${id}-${crypto.randomUUID()}`)
  const operationId = `void-${id}-${crypto.randomUUID()}`
  const operationRef = doc(userCollection(uid, 'financialOperations'), operationId)
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(entryRef)
    if (!snapshot.exists() || snapshot.data().voided) return
    const entry = snapshot.data()
    const stateRef = financeStateDoc(uid)
    const stateSnapshot = await tx.get(stateRef)
    const state = stateSnapshot.exists() ? stateSnapshot.data() : emptyFinanceState()
    const deltas = eventDeltas(entry)
    const ids = Object.keys(deltas)
    const refs = ids.map((accountId) => accountDoc(uid, accountId))
    const accounts = await Promise.all(refs.map((ref) => tx.get(ref)))
    const allocationAdjustments = entry.allocationAdjustments || []
    const allocationRefs = allocationAdjustments.map((item) => doc(userCollection(uid, 'goalAllocations'), item.goalId))
    const allocationSnapshots = await Promise.all(allocationRefs.map((ref) => tx.get(ref)))
    const savingsDelta = ids.reduce((sum, accountId, index) => accounts[index].exists() && accounts[index].data().classification === 'savings' ? sum - deltas[accountId] : sum, 0n)
    const allocationRestore = allocationAdjustments.reduce((sum, item) => sum - BigInt(item.deltaMinor), 0n)
    for (let index = 0; index < ids.length; index += 1) {
      const account = accounts[index]
      if (!account.exists()) throw new Error('A linked account is missing; this transaction cannot be reversed safely.')
      const restored = BigInt(account.data().balanceMinor) - deltas[ids[index]]
      requireNonnegativeBalance(restored, account.data().name)
      tx.update(refs[index], { balanceMinor: safeNumber(restored), lastOperationId: operationId, updatedAt: serverTimestamp() })
    }
    allocationSnapshots.forEach((allocationSnapshot, index) => {
      if (!allocationSnapshot.exists()) throw new Error('A linked savings goal allocation is missing; this transaction cannot be reversed safely.')
      const restoredAmount = BigInt(allocationSnapshot.data().amountMinor || '0') - BigInt(allocationAdjustments[index].deltaMinor)
      requireNonnegativeBalance(restoredAmount, 'Goal allocation')
      tx.update(allocationRefs[index], { amountMinor: String(restoredAmount), updatedAt: serverTimestamp() })
    })
    tx.set(operationRef, { uid, kind: 'transaction_void', deltas: Object.fromEntries(ids.map((accountId) => [accountId, safeNumber(-deltas[accountId])])), createdAt: serverTimestamp() })
    tx.set(stateRef, { ...state, savingsBalanceMinor: String(BigInt(state.savingsBalanceMinor || '0') + savingsDelta), goalAllocatedMinor: String(BigInt(state.goalAllocatedMinor || '0') + allocationRestore), updatedAt: serverTimestamp() })
    tx.update(entryRef, { voided: true, voidedAt: serverTimestamp(), lastOperationId: operationId, updatedAt: serverTimestamp() })
    tx.update(txRef, { voided: true, voidedAt: serverTimestamp(), lastOperationId: operationId, updatedAt: serverTimestamp() })
    tx.set(auditRef, { action: 'transaction_voided', transactionId: id, before: entry, createdAt: serverTimestamp() })
  })
}

export async function postFinancialEvent(uid, input, { savingsAccountId = null, operationId = crypto.randomUUID() } = {}) {
  const amount = toMinorBigInt(input.amountMinor)
  if (amount <= 0n) throw new Error('Enter an amount greater than zero.')
  if (!isCalendarDate(input.occurredOn)) throw new Error('Choose a valid date.')
  if (!['income', 'expense', 'transfer'].includes(input.kind)) throw new Error('Choose a valid financial event type.')
  if ((input.kind === 'income' || input.kind === 'expense') && (!input.categoryId || !input.categoryName)) throw new Error('Choose a category.')
  if (input.kind === 'transfer' && (!input.destinationAccountId || input.destinationAccountId === input.accountId)) throw new Error('Choose two different accounts for this transfer.')
  if ((input.note || '').length > 500) throw new Error('Notes must be 500 characters or fewer.')

  const db = requireDb()
  const eventRef = doc(userCollection(uid, 'ledgerEntries'), operationId)
  const transactionRef = doc(userCollection(uid, 'transactions'), operationId)
  const operationRef = doc(userCollection(uid, 'financialOperations'), operationId)
  const stateRef = financeStateDoc(uid)
  const allocationCandidates = (input.kind === 'expense' && savingsAccountId) || input.kind === 'transfer'
    ? (await getDocs(query(userCollection(uid, 'goalAllocations'), orderBy('updatedAt', 'desc')))).docs.map((item) => item.ref)
    : []
  const savingsRows = savingsAccountId ? [accountDoc(uid, savingsAccountId)] : []
  const refs = [...new Set([accountDoc(uid, input.accountId), ...(input.kind === 'transfer' ? [accountDoc(uid, input.destinationAccountId)] : []), ...savingsRows])]
  const accountIds = refs.map((ref) => ref.id)
  if (!input.accountId) throw new Error('Choose an account.')

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(eventRef)
    if (existing.exists()) return
    const stateSnapshot = await tx.get(stateRef)
    const state = stateSnapshot.exists() ? stateSnapshot.data() : emptyFinanceState()
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)))
    const accounts = new Map(snapshots.map((snapshot, index) => [accountIds[index], snapshot.exists() ? { id: accountIds[index], ...snapshot.data() } : null]))
    const allocationSnapshots = await Promise.all(allocationCandidates.map((ref) => tx.get(ref)))
    const allocations = allocationSnapshots.map((snapshot, index) => ({ id: snapshot.id, ref: allocationCandidates[index], ...(snapshot.exists() ? snapshot.data() : {}) })).filter((item) => item.goalId)
    const totalSavings = BigInt(state.savingsBalanceMinor || '0')
    let savingsBalance = totalSavings
    let allocatedTotal = BigInt(state.goalAllocatedMinor || '0')
    const allocationWrites = []
    const source = accounts.get(input.accountId)
    if (!source || source.status !== 'active') throw new Error('Choose an active account.')
    if (source.currencyCode !== input.currencyCode) throw new Error('Account currency must match your profile currency.')
    let deltas = {}
    let operationKind = input.kind
    let linkedSavingsAccountId = null
    const allocationAdjustments = []
    const releaseAllocationAmount = (withdrawal) => {
      let releaseRemaining = withdrawal > totalSavings - allocatedTotal ? withdrawal - (totalSavings - allocatedTotal) : 0n
      for (const allocation of allocations) {
        if (releaseRemaining <= 0n) break
        const current = BigInt(allocation.amountMinor || '0')
        const released = current < releaseRemaining ? current : releaseRemaining
        if (released > 0n) {
          allocationWrites.push({ ref: allocation.ref, amountMinor: String(current - released) })
          allocationAdjustments.push({ goalId: allocation.id, deltaMinor: String(-released) })
          releaseRemaining -= released
          allocatedTotal -= released
        }
      }
      if (releaseRemaining > 0n) throw new Error('Release goal allocations before withdrawing this savings amount.')
    }

    if (input.kind === 'income') deltas[input.accountId] = amount
    if (input.kind === 'expense') {
      if (source.classification !== 'spending') throw new Error('Choose a spending account for an expense.')
      const shortfall = amount > BigInt(source.balanceMinor) ? amount - BigInt(source.balanceMinor) : 0n
      if (shortfall > 0n) {
        if (!savingsAccountId) {
          const all = await getDocs(query(userCollection(uid, 'accounts'), orderBy('createdAt', 'asc')))
          const options = all.docs.map((row) => ({ id: row.id, ...row.data() })).filter((row) => row.classification === 'savings' && row.status === 'active' && BigInt(row.balanceMinor) > 0n)
          throw new InsufficientBalanceError(shortfall, options)
        }
        const savings = accounts.get(savingsAccountId)
        if (!savings || savings.status !== 'active' || savings.classification !== 'savings') throw new Error('Choose an active savings account.')
        if (BigInt(savings.balanceMinor) < shortfall) throw new Error('That savings account does not have enough to cover the shortfall.')
        releaseAllocationAmount(shortfall)
        deltas[input.accountId] = shortfall - amount
        deltas[savingsAccountId] = -shortfall
        linkedSavingsAccountId = savingsAccountId
        operationKind = 'expense_with_savings_transfer'
      } else deltas[input.accountId] = -amount
    }
    if (input.kind === 'transfer') {
      const destination = accounts.get(input.destinationAccountId)
      if (!destination || destination.status !== 'active') throw new Error('Choose an active destination account.')
      if (destination.currencyCode !== source.currencyCode) throw new Error('Transfers require accounts with the same currency.')
      if (BigInt(source.balanceMinor) < amount) throw new Error('This account does not have enough money to transfer.')
      if (source.classification === 'savings' && destination.classification !== 'savings') releaseAllocationAmount(amount)
      deltas[input.accountId] = -amount
      deltas[input.destinationAccountId] = amount
    }

    const postings = Object.entries(deltas).map(([accountId, delta]) => ({ accountId, deltaMinor: String(delta) }))
    const event = {
      kind: input.kind,
      operationKind,
      amountMinor: String(amount),
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId || null,
      savingsAccountId: linkedSavingsAccountId,
      allocationAdjustments,
      categoryId: input.categoryId || null,
      categoryName: input.categoryName || null,
      occurredOn: input.occurredOn,
      note: (input.note || '').trim(),
      postings,
      lastOperationId: operationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    for (const [accountId, delta] of Object.entries(deltas)) {
      const account = accounts.get(accountId)
      const next = BigInt(account.balanceMinor) + delta
      requireNonnegativeBalance(next, account.name)
      if (account.classification === 'savings') savingsBalance += delta
      tx.update(accountDoc(uid, accountId), { balanceMinor: safeNumber(next), lastOperationId: operationId, updatedAt: serverTimestamp() })
    }
    allocationWrites.forEach((write) => tx.update(write.ref, { amountMinor: write.amountMinor, updatedAt: serverTimestamp() }))
    tx.set(stateRef, { ...state, savingsBalanceMinor: String(savingsBalance), goalAllocatedMinor: String(allocatedTotal), updatedAt: serverTimestamp() })
    tx.set(eventRef, event)
    tx.set(operationRef, { uid, kind: operationKind, deltas: Object.fromEntries(Object.entries(deltas).map(([id, delta]) => [id, safeNumber(delta)])), createdAt: serverTimestamp() })
    tx.set(transactionRef, event)
  })
  return operationId
}
