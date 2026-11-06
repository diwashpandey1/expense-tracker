const CSV_COLUMNS = ['date', 'type', 'amount', 'account', 'destination_account', 'category', 'note', 'currency', 'category_splits']

function escapeCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function amountToDecimal(minorValue, currencyCode) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  const minor = BigInt(minorValue || '0')
  const scale = 10n ** BigInt(digits)
  if (!digits) return String(minor)
  return `${minor / scale}.${(minor % scale).toString().padStart(digits, '0')}`
}

export function transactionsToCsv(transactions, accounts, currencyCode) {
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const rows = transactions.map((item) => [
    item.occurredOn,
    item.kind,
    amountToDecimal(item.amountMinor, currencyCode),
    accountNames.get(item.accountId) || '',
    accountNames.get(item.destinationAccountId) || '',
    item.categoryName || '',
    item.note || '',
    currencyCode,
    item.categorySplits?.length ? JSON.stringify(item.categorySplits.map(({ categoryName, amountMinor }) => ({ category: categoryName, amount: amountToDecimal(amountMinor, currencyCode) }))) : '',
  ])
  return [CSV_COLUMNS, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const records = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell.length === 0) quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some((value) => value.trim())) records.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error('The CSV file has an unclosed quoted field.')
  row.push(cell)
  if (row.some((value) => value.trim())) records.push(row)
  if (records.length < 2) throw new Error('The CSV file needs a header and at least one transaction row.')
  const headers = records[0].map((value) => value.trim().toLowerCase().replaceAll(' ', '_'))
  const required = ['date', 'type', 'amount', 'account']
  const missing = required.filter((name) => !headers.includes(name))
  if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`)
  return records.slice(1).map((values, index) => ({
    ...Object.fromEntries(headers.map((header, col) => [header, values[col] ?? ''])),
    sourceRow: index + 2,
  }))
}

export function transactionFingerprint(item) {
  const splitKey = (item.categorySplits || []).map((line) => `${line.categoryId}:${line.amountMinor}`).join(',')
  return [item.occurredOn, item.kind, String(item.amountMinor), item.accountId || '', item.destinationAccountId || '', item.categoryId || '', splitKey, (item.note || '').trim().toLocaleLowerCase()]
    .join('|')
}

export async function stableCsvOperationId(item) {
  const bytes = new TextEncoder().encode(transactionFingerprint(item))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `csv_${hash}`
}

export function downloadCsv(csv, filename = 'avora-transactions.csv') {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
