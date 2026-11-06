export function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentMonth() {
  return localDateString().slice(0, 7)
}

export function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 1, 1)
  const next = new Date(year, monthNumber, 1)
  const last = new Date(next.getTime() - 86400000)
  return { from: localDateString(start), to: localDateString(last) }
}

export function weekRange(dateValue, weekStartsOn = 'monday') {
  const [year, month, day] = dateValue.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const firstDay = weekStartsOn === 'sunday' ? 0 : 1
  const offset = (start.getDay() - firstDay + 7) % 7
  start.setDate(start.getDate() - offset)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { from: localDateString(start), to: localDateString(end) }
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function formatDateForDisplay(value, locale = navigator.language) {
  if (!isCalendarDate(value)) return value || ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const format = typeof document === 'undefined' ? 'locale' : document.documentElement.dataset.dateFormat || 'locale'
  if (format === 'iso') return value
  if (format === 'us') return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date)
  if (format === 'eu') return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function monthLabel(month, locale = navigator.language) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
}
