import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'

export const DEFAULT_PREFERENCES = {
  appearance: { theme: 'system', accent: 'lime', density: 'comfortable', fontSize: 'normal', sidebarCollapsed: false, animations: true },
  dashboard: {
    widgets: { balance: true, income: true, expenses: true, savings: true, budgets: true, goals: true, recentTransactions: true, spendingBreakdown: true },
    defaultPeriod: 'monthly', analyticsChartType: 'pie', recentTransactionCount: 5, hideAmounts: false,
    widgetOrder: ['balance', 'income', 'expenses', 'savings', 'budgets', 'goals', 'recentTransactions', 'spendingBreakdown'],
  },
  transactions: { defaultType: 'expense', defaultAccountId: '', defaultCategoryId: '', dateFormat: 'iso', weekStartsOn: 'monday', listView: 'comfortable', sort: 'newest', confirmBeforeSave: false },
  budget: { warningThreshold: 80, defaultPeriod: 'monthly', progressDisplay: 'bar' },
  notifications: { budgetThreshold: true, overspending: true, recurringReminders: true, savingsGoalReminders: true, monthlySummary: false },
  privacy: { hideBalances: false },
}

const settingsRef = (uid) => doc(requireDb(), 'users', uid, 'settings', 'preferences')

function mergeDeep(base, patch) {
  return Object.fromEntries(Object.entries({ ...base, ...patch }).map(([key, value]) => [
    key,
    value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object'
      ? mergeDeep(base[key], value)
      : value,
  ]))
}

export function normalizePreferences(saved = {}) {
  const safeSaved = Object.fromEntries(Object.keys(DEFAULT_PREFERENCES).map((section) => [
    section,
    saved[section] && typeof saved[section] === 'object' && !Array.isArray(saved[section]) ? saved[section] : {},
  ]))
  const prefs = mergeDeep(DEFAULT_PREFERENCES, safeSaved)
  if (!['light', 'dark', 'system'].includes(prefs.appearance.theme)) prefs.appearance.theme = 'system'
  if (!['lime', 'sage', 'blue', 'rose', 'violet'].includes(prefs.appearance.accent)) prefs.appearance.accent = 'lime'
  if (!['compact', 'comfortable'].includes(prefs.appearance.density)) prefs.appearance.density = 'comfortable'
  if (!['small', 'normal', 'large'].includes(prefs.appearance.fontSize)) prefs.appearance.fontSize = 'normal'
  if (!['weekly', 'monthly', 'yearly', 'lifetime'].includes(prefs.dashboard.defaultPeriod)) prefs.dashboard.defaultPeriod = 'monthly'
  if (!['pie', 'bar', 'line'].includes(prefs.dashboard.analyticsChartType)) prefs.dashboard.analyticsChartType = 'pie'
  prefs.dashboard.recentTransactionCount = [5, 10, 20].includes(Number(prefs.dashboard.recentTransactionCount)) ? Number(prefs.dashboard.recentTransactionCount) : 5
  prefs.dashboard.hideAmounts = typeof prefs.dashboard.hideAmounts === 'boolean' ? prefs.dashboard.hideAmounts : false
  prefs.dashboard.widgets = Object.fromEntries(Object.entries(DEFAULT_PREFERENCES.dashboard.widgets).map(([key, fallback]) => [key, typeof prefs.dashboard.widgets?.[key] === 'boolean' ? prefs.dashboard.widgets[key] : fallback]))
  prefs.budget.warningThreshold = Math.min(99, Math.max(1, Number(prefs.budget.warningThreshold) || 80))
  delete prefs.budget.overspendingNotifications
  delete prefs.budget.goalReminders
  if (!['monthly', 'yearly'].includes(prefs.budget.defaultPeriod)) prefs.budget.defaultPeriod = 'monthly'
  if (!['bar', 'ring', 'both'].includes(prefs.budget.progressDisplay)) prefs.budget.progressDisplay = 'bar'
  if (!['income', 'expense', 'transfer'].includes(prefs.transactions.defaultType)) prefs.transactions.defaultType = 'expense'
  if (typeof prefs.transactions.defaultAccountId !== 'string') prefs.transactions.defaultAccountId = ''
  if (typeof prefs.transactions.defaultCategoryId !== 'string') prefs.transactions.defaultCategoryId = ''
  if (!['iso', 'us', 'eu', 'locale'].includes(prefs.transactions.dateFormat)) prefs.transactions.dateFormat = 'iso'
  if (!['sunday', 'monday'].includes(prefs.transactions.weekStartsOn)) prefs.transactions.weekStartsOn = 'monday'
  if (!['newest', 'oldest', 'amount-high', 'amount-low'].includes(prefs.transactions.sort)) prefs.transactions.sort = 'newest'
  if (!['comfortable', 'compact'].includes(prefs.transactions.listView)) prefs.transactions.listView = 'comfortable'
  if (typeof prefs.transactions.confirmBeforeSave !== 'boolean') prefs.transactions.confirmBeforeSave = false
  for (const key of Object.keys(DEFAULT_PREFERENCES.notifications)) if (typeof prefs.notifications[key] !== 'boolean') prefs.notifications[key] = DEFAULT_PREFERENCES.notifications[key]
  if (typeof prefs.privacy.hideBalances !== 'boolean') prefs.privacy.hideBalances = false
  if (typeof prefs.appearance.sidebarCollapsed !== 'boolean') prefs.appearance.sidebarCollapsed = false
  if (typeof prefs.appearance.animations !== 'boolean') prefs.appearance.animations = true
  return prefs
}

export async function readPreferences(uid) {
  return runTransaction(requireDb(), async (tx) => {
    const ref = settingsRef(uid)
    const snapshot = await tx.get(ref)
    if (snapshot.exists()) return normalizePreferences(snapshot.data())
    const defaults = normalizePreferences()
    tx.set(ref, { ...defaults, updatedAt: serverTimestamp() })
    return defaults
  })
}

export async function savePreferences(uid, section, patch) {
  if (!Object.hasOwn(DEFAULT_PREFERENCES, section)) throw new Error('Choose a valid preferences section.')
  return runTransaction(requireDb(), async (tx) => {
    const ref = settingsRef(uid)
    const snapshot = await tx.get(ref)
    const current = normalizePreferences(snapshot.exists() ? snapshot.data() : {})
    const next = normalizePreferences({ ...current, [section]: mergeDeep(current[section], patch) })
    const accountId = next.transactions.defaultAccountId
    const categoryId = next.transactions.defaultCategoryId
    const accountSnapshot = accountId ? await tx.get(doc(requireDb(), 'users', uid, 'accounts', accountId)) : null
    const categorySnapshot = categoryId ? await tx.get(doc(requireDb(), 'users', uid, 'categories', categoryId)) : null
    if (accountId && (!accountSnapshot?.exists() || accountSnapshot.data().status !== 'active')) next.transactions.defaultAccountId = ''
    const expectedCategoryKind = next.transactions.defaultType === 'income' ? 'income' : 'expense'
    if (categoryId && (!categorySnapshot?.exists() || categorySnapshot.data().isArchived || categorySnapshot.data().kind !== expectedCategoryKind)) next.transactions.defaultCategoryId = ''
    tx.set(ref, { ...next, updatedAt: serverTimestamp() })
    return next
  })
}
