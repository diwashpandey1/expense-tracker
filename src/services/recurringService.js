import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { localDateString } from '../lib/dates'
import { isCalendarDate } from '../lib/dates'
import { postFinancialEvent, InsufficientBalanceError } from './ledgerService'

const rows = (uid, name) => collection(requireDb(), 'users', uid, name)

export function recurringOccurrenceId(scheduleId, dueOn) {
  if (!scheduleId || !isCalendarDate(dueOn)) throw new Error('A schedule ID and valid due date are required.')
  return `${scheduleId}_${dueOn}`
}

export function nextScheduledDate(dateValue, frequency, interval = 1) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (frequency === 'daily' || frequency === 'weekly' || frequency === 'custom') date.setUTCDate(date.getUTCDate() + (frequency === 'weekly' ? 7 : frequency === 'custom' ? interval : 1))
  else if (frequency === 'monthly') {
    const target = new Date(Date.UTC(year, month, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
  } else if (frequency === 'yearly') {
    const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate()
    return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
  }
  else throw new Error('Choose a supported recurring frequency.')
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export async function listRecurringSchedules(uid) {
  const snapshot = await getDocs(query(rows(uid, 'recurringSchedules')))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function listRecurringOccurrences(uid, scheduleId) {
  const snapshot = await getDocs(query(rows(uid, 'recurringOccurrences'), where('scheduleId', '==', scheduleId)))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => b.dueOn.localeCompare(a.dueOn))
}

export async function saveRecurringSchedule(uid, input) {
  if (!input.name?.trim() || input.name.trim().length > 80) throw new Error('Schedule name is required (up to 80 characters).')
  if (!['income', 'expense'].includes(input.kind)) throw new Error('Choose income or expense.')
  if (!['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(input.frequency)) throw new Error('Choose a schedule frequency.')
  if (input.frequency === 'custom' && (!Number.isInteger(input.intervalDays) || input.intervalDays < 1 || input.intervalDays > 365)) throw new Error('Custom interval must be 1–365 days.')
  if (!/^[1-9][0-9]{0,15}$/.test(String(input.amountMinor))) throw new Error('Enter a positive amount.')
  if (!input.accountId || !input.categoryId || !input.categoryName) throw new Error('Choose an account and category.')
  if (!isCalendarDate(input.startOn) || (input.endOn && !isCalendarDate(input.endOn))) throw new Error('Choose valid schedule dates.')
  if (input.endOn && input.endOn < input.startOn) throw new Error('End date cannot be before the start date.')
  const db = requireDb()
  const ref = input.id ? doc(rows(uid, 'recurringSchedules'), input.id) : doc(rows(uid, 'recurringSchedules'))
  const schedule = {
    name: input.name.trim(), kind: input.kind, amountMinor: String(input.amountMinor), accountId: input.accountId,
    categoryId: input.categoryId, categoryName: input.categoryName, frequency: input.frequency,
    intervalDays: input.frequency === 'custom' ? input.intervalDays : null,
    startOn: input.startOn, endOn: input.endOn || null, nextDueOn: input.nextDueOn || null,
    status: input.status || 'active', updatedAt: serverTimestamp(),
  }
  if (!input.id) schedule.createdAt = serverTimestamp()
  await runTransaction(db, async (tx) => {
    const current = input.id ? await tx.get(ref) : null
    if (input.id && !current.exists()) throw new Error('This schedule no longer exists.')
    tx.set(ref, { ...schedule, nextDueOn: schedule.nextDueOn || current?.data().nextDueOn || input.startOn, createdAt: current?.data().createdAt || schedule.createdAt })
  })
  return ref.id
}

async function advanceSchedule(uid, schedule, occurrenceId, status, errorMessage = '') {
  const db = requireDb()
  const scheduleRef = doc(rows(uid, 'recurringSchedules'), schedule.id)
  const occurrenceRef = doc(rows(uid, 'recurringOccurrences'), occurrenceId)
  await runTransaction(db, async (tx) => {
    const [scheduleSnapshot, occurrenceSnapshot] = await Promise.all([tx.get(scheduleRef), tx.get(occurrenceRef)])
    if (!scheduleSnapshot.exists()) return
    if (!occurrenceSnapshot.exists()) tx.set(occurrenceRef, {
      scheduleId: schedule.id, name: schedule.name, kind: schedule.kind, amountMinor: schedule.amountMinor,
      accountId: schedule.accountId, categoryId: schedule.categoryId, categoryName: schedule.categoryName,
      dueOn: schedule.nextDueOn, status, errorMessage, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    else tx.update(occurrenceRef, { status, errorMessage, updatedAt: serverTimestamp() })
    const nextDueOn = nextScheduledDate(schedule.nextDueOn, schedule.frequency, schedule.intervalDays)
    tx.update(scheduleRef, { nextDueOn, updatedAt: serverTimestamp() })
  })
}

export async function processDueSchedules(uid, currencyCode, today = localDateString()) {
  const schedules = await listRecurringSchedules(uid)
  let processed = 0
  for (const schedule of schedules) {
    if (schedule.status !== 'active') continue
    let current = schedule
    let count = 0
    while (current.nextDueOn <= today && (!current.endOn || current.nextDueOn <= current.endOn) && count < 120) {
      const occurrenceId = recurringOccurrenceId(current.id, current.nextDueOn)
      if (current.kind === 'income') {
        await advanceSchedule(uid, current, occurrenceId, 'pending_confirmation')
      } else {
        const operationId = `recurring_${occurrenceId}`
        let status = 'posted'
        let failure = ''
        try {
          await postFinancialEvent(uid, { kind: 'expense', amountMinor: current.amountMinor, occurredOn: current.nextDueOn, accountId: current.accountId, categoryId: current.categoryId, categoryName: current.categoryName, note: `Recurring: ${current.name}`, currencyCode }, { operationId })
        } catch (error) {
          status = error instanceof InsufficientBalanceError ? 'pending_funding' : 'failed'
          failure = error.message
        }
        await advanceSchedule(uid, current, occurrenceId, status, failure)
      }
      current = { ...current, nextDueOn: nextScheduledDate(current.nextDueOn, current.frequency, current.intervalDays) }
      processed += 1
      count += 1
    }
  }
  return processed
}

export async function confirmRecurringIncome(uid, occurrence, currencyCode) {
  await postFinancialEvent(uid, { kind: 'income', amountMinor: occurrence.amountMinor, occurredOn: occurrence.dueOn, accountId: occurrence.accountId, categoryId: occurrence.categoryId, categoryName: occurrence.categoryName, note: `Recurring income received: ${occurrence.name}`, currencyCode }, { operationId: `recurring_${occurrence.id}` })
  const db = requireDb()
  await runTransaction(db, async (tx) => {
    const ref = doc(rows(uid, 'recurringOccurrences'), occurrence.id)
    const snapshot = await tx.get(ref)
    if (snapshot.exists()) tx.update(ref, { status: 'posted', errorMessage: '', updatedAt: serverTimestamp() })
  })
}

export async function confirmRecurringExpense(uid, occurrence, currencyCode, savingsAccountId = null) {
  await postFinancialEvent(uid, { kind: 'expense', amountMinor: occurrence.amountMinor, occurredOn: occurrence.dueOn, accountId: occurrence.accountId, categoryId: occurrence.categoryId, categoryName: occurrence.categoryName, note: `Recurring expense: ${occurrence.name}`, currencyCode }, { operationId: `recurring_${occurrence.id}`, savingsAccountId })
  const db = requireDb()
  await runTransaction(db, async (tx) => {
    const ref = doc(rows(uid, 'recurringOccurrences'), occurrence.id)
    const snapshot = await tx.get(ref)
    if (snapshot.exists()) tx.update(ref, { status: 'posted', errorMessage: '', updatedAt: serverTimestamp() })
  })
}

export async function setRecurringStatus(uid, scheduleId, status) {
  if (!['active', 'paused', 'cancelled'].includes(status)) throw new Error('Invalid schedule status.')
  const ref = doc(rows(uid, 'recurringSchedules'), scheduleId)
  await runTransaction(requireDb(), async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('This recurring schedule no longer exists.')
    tx.update(ref, { status, updatedAt: serverTimestamp() })
  })
}
