const MAX_MINOR = 999_999_999_999_999n
let cachedRatePayload = ''
let cachedUsdRates = {}

export function currencyExponent(currencyCode) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits
  } catch {
    throw new Error('Choose a valid currency code.')
  }
}

export function parseMoneyToMinor(input, currencyCode) {
  const value = input.trim()
  const exponent = currencyExponent(currencyCode)
  const match = /^(\d{1,13})(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error('Enter a positive amount using digits and a decimal point.')

  const fraction = match[2] ?? ''
  if (fraction.length > exponent) throw new Error(`This currency allows at most ${exponent} decimal places.`)
  const scale = 10n ** BigInt(exponent)
  const minor = BigInt(match[1]) * scale + BigInt((fraction + '0'.repeat(exponent)).slice(0, exponent) || '0')
  if (minor <= 0n) throw new Error('Amount must be greater than zero.')
  if (minor > MAX_MINOR) throw new Error('Amount is above the supported limit.')
  return minor.toString()
}

export function formatMoney(minorInput, currencyCode, locale = navigator.language) {
  if (typeof document !== 'undefined' && document.documentElement.dataset.hideBalances === 'true') return '••••'
  let raw = typeof minorInput === 'bigint' ? minorInput : BigInt(minorInput || '0')
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    const displayCurrency = root.dataset.displayCurrency
    const ratePayload = root.dataset.usdRates || '{}'
    if (ratePayload !== cachedRatePayload) {
      try { cachedUsdRates = JSON.parse(ratePayload) } catch { cachedUsdRates = {} }
      cachedRatePayload = ratePayload
    }
    const sourceRate = Number(cachedUsdRates[currencyCode])
    const targetRate = Number(cachedUsdRates[displayCurrency])
    const rate = targetRate / sourceRate
    if (displayCurrency && displayCurrency !== currencyCode && Number.isFinite(rate) && rate > 0) {
      const sourceScale = 10 ** currencyExponent(currencyCode)
      const targetScale = 10 ** currencyExponent(displayCurrency)
      const convertedMinor = Math.round(Number(raw) / sourceScale * rate * targetScale)
      if (Number.isSafeInteger(convertedMinor)) {
        raw = BigInt(convertedMinor)
        currencyCode = displayCurrency
      }
    }
  }
  const negative = raw < 0n
  const absolute = negative ? -raw : raw
  const exponent = currencyExponent(currencyCode)
  const scale = 10n ** BigInt(exponent)
  const whole = absolute / scale
  const fraction = exponent ? (absolute % scale).toString().padStart(exponent, '0') : ''
  const currencyParts = new Intl.NumberFormat(locale, {
    style: 'currency', currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).formatToParts(negative ? -1 : 1)
  const wholeText = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole)
  const decimal = exponent
    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      .formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.'
    : ''
  let insertedNumber = false
  return currencyParts.map((part) => {
    if (part.type === 'integer') {
      if (insertedNumber) return ''
      insertedNumber = true
      return wholeText + (exponent ? `${decimal}${fraction}` : '')
    }
    if (part.type === 'group' || part.type === 'decimal' || part.type === 'fraction') return ''
    return part.value
  }).join('')
}

export function addMinorUnits(...values) {
  return values.reduce((total, value) => total + BigInt(value || '0'), 0n)
}
