import { collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { isCalendarDate, localDateString } from '../lib/dates'
import { currencyExponent } from '../lib/money'
import { SUPPORTED_CURRENCIES } from '../constants/currencies'

const profileRef = (uid) => doc(requireDb(), 'users', uid)
const draftRef = (uid) => doc(requireDb(), 'users', uid, 'onboarding', 'state')
const financeStateRef = (uid) => doc(requireDb(), 'users', uid, 'financeState', 'summary')
const accountsCollection = (uid) => collection(requireDb(), 'users', uid, 'accounts')
const accountRef = (uid, id) => doc(accountsCollection(uid), id)
const financialProfileRef = (uid) => doc(requireDb(), 'users', uid, 'financialProfile', 'general')
const ledgerRef = (uid, id) => doc(requireDb(), 'users', uid, 'ledgerEntries', id)
const operationRef = (uid, id) => doc(requireDb(), 'users', uid, 'financialOperations', id)

export const ONBOARDING_STEPS = [
  { id: 'profile', label: 'Profile' },
  { id: 'income', label: 'Income' },
  { id: 'habits', label: 'Habits' },
  { id: 'household', label: 'Household' },
  { id: 'goals', label: 'Goals' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'review', label: 'Review' },
]

export async function readOnboardingDraft(uid) {
  const snapshot = await getDoc(draftRef(uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function saveOnboardingDraft(uid, currentStep, answers) {
  const safeStep = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, Number(currentStep) || 0))
  await runTransaction(requireDb(), async (transaction) => {
    const ref = profileRef(uid)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Your account profile could not be found.')
    if (snapshot.data().onboardingStatus === 'completed') throw new Error('Your setup is already complete.')
    transaction.set(draftRef(uid), { currentStep: safeStep, answers, updatedAt: serverTimestamp() })
    transaction.update(ref, { onboardingStatus: 'in_progress', updatedAt: serverTimestamp() })
  })
}

function parseOpeningBalance(value, currencyCode) {
  const text = String(value ?? '').trim()
  const exponent = currencyExponent(currencyCode)
  const match = /^(0|[1-9]\d{0,12})(?:\.(\d+))?$/.exec(text)
  if (!match || (match[2] || '').length > exponent) throw new Error(`Enter a valid opening balance with up to ${exponent} decimal places.`)
  const factor = 10n ** BigInt(exponent)
  const minor = BigInt(match[1]) * factor + BigInt(((match[2] || '') + '0'.repeat(exponent)).slice(0, exponent) || '0')
  if (minor > 999_999_999_999_999n) throw new Error('Opening balance is above the supported limit.')
  return minor
}

function safeNumber(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('An account balance is above the supported limit.')
  return Number(value)
}

export async function completeOnboarding(uid, answers, { displayName = '' } = {}) {
  const fullName = String(answers.profile?.fullName || '').trim()
  const currencyCode = String(answers.profile?.currencyCode || '')
  const occupation = String(answers.income?.occupation || '')
  const occupationChoices = ['Salaried employee', 'Business owner', 'Freelancer', 'Self-employed', 'Student', 'Homemaker', 'Retired', 'Currently unemployed', 'Other']
  const incomeSources = ['Monthly salary', 'Business income/profits', 'Freelancing', 'Investments', 'Rental income', 'Pension', 'Family support', 'Part-time work', 'Commission', 'Other', 'No regular income']
  const incomeChannels = ['Bank account', 'Physical cash', 'Digital wallet', 'Other']
  const incomeFrequencies = ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Multiple times per month', 'Irregularly', 'Seasonally', 'No regular schedule']
  const estimate = answers.income?.incomeEstimate || { mode: 'prefer_not_to_say' }
  const accounts = Array.isArray(answers.accounts?.items) ? answers.accounts.items : []
  const trackingStartDate = answers.accounts?.trackingStartDate || localDateString()
  if (!fullName || fullName.length > 100) throw new Error('Enter your full name to continue.')
  if (!SUPPORTED_CURRENCIES.includes(currencyCode)) throw new Error('Choose a supported primary currency.')
  if (!occupationChoices.includes(occupation)) throw new Error('Choose a valid occupation option, including no regular occupation if applicable.')
  if (!(answers.income?.incomeSources || []).every((item) => incomeSources.includes(item))) throw new Error('Choose valid income sources.')
  if (!(answers.income?.incomeChannels || []).every((item) => incomeChannels.includes(item))) throw new Error('Choose valid income channels.')
  if (answers.income?.incomeFrequency && !incomeFrequencies.includes(answers.income.incomeFrequency)) throw new Error('Choose a valid income frequency.')
  if (!['exact', 'range', 'prefer_not_to_say'].includes(estimate.mode)) throw new Error('Choose a valid income estimate preference.')
  if (estimate.mode === 'exact') parseOpeningBalance(estimate.amount || '', currencyCode)
  if (estimate.mode === 'range' && !estimate.range) throw new Error('Choose an approximate income range or select another disclosure option.')
  for (const amount of [answers.habits?.averageIncome, answers.habits?.averageExpenditure, answers.habits?.averageSavings]) if (amount) parseOpeningBalance(amount, currencyCode)
  if (answers.profile?.dateOfBirth && !isCalendarDate(answers.profile.dateOfBirth)) throw new Error('Choose a valid date of birth.')
  if (answers.profile?.gender && !['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'].includes(answers.profile.gender)) throw new Error('Choose a valid gender option.')
  if (accounts.length < 1 || accounts.length > 10) throw new Error('Set up between one and ten accounts.')
  if (!isCalendarDate(trackingStartDate)) throw new Error('Choose a valid tracking start date.')

  const preparedAccounts = accounts.map((item, index) => {
    const name = String(item.name || '').trim()
    if (!name || name.length > 80) throw new Error(`Enter a name for account ${index + 1}.`)
    if (!['cash', 'bank', 'ewallet', 'other'].includes(item.accountType)) throw new Error(`Choose a valid type for ${name}.`)
    if (!['spending', 'savings'].includes(item.classification)) throw new Error(`Choose a valid purpose for ${name}.`)
    const id = String(item.id || '')
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new Error(`Account ${name} needs a valid setup identifier.`)
    return {
      id, name, accountType: item.accountType, classification: item.classification,
      currencyCode,
      openingBalanceMinor: parseOpeningBalance(item.openingBalance || '0', currencyCode),
      provider: String(item.provider || '').trim().slice(0, 80),
      description: String(item.description || '').trim().slice(0, 240),
      purpose: String(item.purpose || '').trim().slice(0, 50),
      subtype: String(item.subtype || '').trim().slice(0, 50),
    }
  })

  const db = requireDb()
  const refs = preparedAccounts.map((account) => accountRef(uid, account.id))
  const operations = preparedAccounts.map((account) => `opening-${account.id}`)
  await runTransaction(db, async (transaction) => {
    const userReference = profileRef(uid)
    const draftReference = draftRef(uid)
    const stateReference = financeStateRef(uid)
    const financialProfileReference = financialProfileRef(uid)
    const userSnapshot = await transaction.get(userReference)
    if (!userSnapshot.exists()) throw new Error('Your account profile could not be found.')
    if (userSnapshot.data().onboardingStatus === 'completed') return
    const [stateSnapshot, accountSnapshots, draftSnapshot] = await Promise.all([
      transaction.get(stateReference),
      Promise.all(refs.map((ref) => transaction.get(ref))),
      transaction.get(draftReference),
    ])
    if (accountSnapshots.some((snapshot) => snapshot.exists())) throw new Error('Some setup accounts already exist. Refresh the page to continue safely.')
    const now = serverTimestamp()
    let openingSavings = 0n
    for (let index = 0; index < preparedAccounts.length; index += 1) {
      const account = preparedAccounts[index]
      const opening = account.openingBalanceMinor
      if (account.classification === 'savings') openingSavings += opening
      transaction.set(refs[index], {
        name: account.name,
        accountType: account.accountType,
        classification: account.classification,
        currencyCode,
        openingBalanceMinor: String(opening),
        balanceMinor: safeNumber(opening),
        status: 'active',
        provider: account.provider,
        description: account.description,
        purpose: account.purpose,
        subtype: account.subtype,
        openingBalanceDate: trackingStartDate,
        createdAt: now,
        updatedAt: now,
      })
      const operationId = operations[index]
      const amount = safeNumber(opening)
      transaction.set(operationRef(uid, operationId), { uid, kind: 'account_opening_balance', deltas: { [account.id]: amount }, createdAt: now })
      transaction.set(ledgerRef(uid, operationId), {
        kind: 'opening_balance', operationKind: 'account_opening_balance', amountMinor: String(opening),
        accountId: account.id, occurredOn: trackingStartDate,
        note: 'Starting balance when tracking began', postings: [{ accountId: account.id, deltaMinor: String(opening) }],
        lastOperationId: operationId, createdAt: now, updatedAt: now,
      })
    }
    const existingState = stateSnapshot.exists() ? stateSnapshot.data() : {}
    transaction.set(stateReference, {
      savingsBalanceMinor: String(BigInt(existingState.savingsBalanceMinor || '0') + openingSavings),
      goalAllocatedMinor: String(BigInt(existingState.goalAllocatedMinor || '0')),
      updatedAt: now,
    })
    const profile = answers.profile || {}
    const financialProfile = {
      occupation,
      occupationOther: answers.income?.occupationOther || '',
      incomeSources: answers.income?.incomeSources || [],
      incomeFrequency: answers.income?.incomeFrequency || '',
      incomeEstimate: estimate,
      incomeChannels: answers.income?.incomeChannels || [],
      financialHabits: answers.habits || {},
      household: answers.household || {},
      financialGoals: answers.goals || {},
      createdAt: now,
      updatedAt: now,
    }
    transaction.set(financialProfileReference, financialProfile)
    transaction.update(userReference, {
      displayName: String(displayName || profile.displayName || fullName).trim().slice(0, 100),
      fullName,
      currencyCode,
      countryCode: profile.countryCode || '',
      timeZone: profile.timeZone || '',
      ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
      ...(profile.gender ? { gender: profile.gender } : {}),
      onboardingStatus: 'completed',
      primaryAccountId: preparedAccounts[0].id,
      onboardingCompletedAt: now,
      updatedAt: now,
    })
    if (draftSnapshot.exists()) transaction.delete(draftReference)
  })
}
