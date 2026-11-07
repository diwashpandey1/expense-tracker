const RATE_KEY = 'rates:USD:v1'
const RETRY_KEY = 'rates:USD:retry:v1'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'NPR', 'AUD', 'CAD', 'JPY', 'CNY', 'SGD', 'CHF', 'NZD']
let refreshInFlight = null

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      ...extraHeaders,
    },
  })
}

function validRates(rates) {
  return rates && typeof rates === 'object'
    && CURRENCIES.every((code) => Number.isFinite(Number(rates[code])) && Number(rates[code]) > 0)
}

async function getSnapshot(env) {
  const raw = await env.CURRENCY_RATES.get(RATE_KEY)
  if (!raw) return null
  try {
    const snapshot = JSON.parse(raw)
    if (snapshot.baseCurrency !== 'USD' || !validRates(snapshot.rates)) return null
    return snapshot
  } catch {
    return null
  }
}

async function refreshExpiredSnapshot(env) {
  const saved = await getSnapshot(env)
  if (saved && Date.now() < Number(saved.expiresAt)) return saved
  if (!env.CURRENCY_API_KEY) throw new Error('The CurrencyAPI secret is not configured on this Worker.')
  const retry = await env.CURRENCY_RATES.get(RETRY_KEY, 'json')
  if (Number(retry?.retryAfter) > Date.now()) {
    if (saved) return saved
    // A prior deployment may have backed off while the API key was missing.
    // Once a key is present, do not let that stale configuration failure block
    // the first successful initialization attempt.
    if (!String(retry?.lastError || '').includes('CurrencyAPI secret is not configured')) {
      throw new Error(retry?.lastError || 'Rate synchronization is in its retry window.')
    }
  }
  try {
    const targets = CURRENCIES.filter((code) => code !== 'USD')
    const url = new URL('https://api.currencyapi.com/v3/latest')
    url.searchParams.set('base_currency', 'USD')
    url.searchParams.set('currencies', targets.join(','))
    const response = await fetch(url, { headers: { apikey: env.CURRENCY_API_KEY } })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`CurrencyAPI request failed (${response.status}).`)

    const rates = { USD: 1 }
    for (const code of targets) {
      const value = Number(result.data?.[code]?.value ?? result.data?.[code])
      if (!Number.isFinite(value) || value <= 0) throw new Error(`CurrencyAPI returned no valid USD rate for ${code}.`)
      rates[code] = value
    }

    const syncedAt = Date.now()
    const snapshot = {
      baseCurrency: 'USD',
      rates,
      rateDate: result.meta?.last_updated_at || new Date(syncedAt).toISOString(),
      syncedAt,
      expiresAt: syncedAt + WEEK_MS,
    }
    await env.CURRENCY_RATES.put(RATE_KEY, JSON.stringify(snapshot))
    await env.CURRENCY_RATES.delete(RETRY_KEY)
    return snapshot
  } catch (error) {
    const attempts = Math.min((Number(retry?.attempts) || 0) + 1, 10)
    const retryDelay = Math.min(HOUR_MS * (2 ** (attempts - 1)), 24 * HOUR_MS)
    await env.CURRENCY_RATES.put(RETRY_KEY, JSON.stringify({
      attempts,
      retryAfter: Date.now() + retryDelay,
      lastError: error instanceof Error ? error.message : 'Currency provider request failed.',
    }))
    throw error
  }
}

function refreshIfExpired(env) {
  // Coalesce simultaneous first-load/expiry requests in the same Worker isolate.
  if (!refreshInFlight) {
    refreshInFlight = refreshExpiredSnapshot(env).finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

function publicSyncError(error) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('CurrencyAPI secret is not configured')) return 'Currency-rate sync is not configured. Add the CURRENCY_API_KEY Worker secret.'
  const status = message.match(/CurrencyAPI request failed \((\d{3})\)/)?.[1]
  if (status) return `The currency provider returned HTTP ${status}. Check the API key, plan, and quota.`
  if (message.includes('KV') || message.includes('CURRENCY_RATES')) return 'The currency-rate KV binding is unavailable. Check the CURRENCY_RATES Worker binding.'
  return 'Currency-rate sync failed. Check the Worker logs and currency provider configuration.'
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/currency-rates') {
      if (request.method === 'OPTIONS') return jsonResponse({}, 204)
      if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, OPTIONS' })
      try {
        const snapshot = await refreshIfExpired(env)
        if (!snapshot) return jsonResponse({ error: 'The shared exchange-rate snapshot could not be initialized.' }, 503)
        return jsonResponse({ ...snapshot, stale: Date.now() >= Number(snapshot.expiresAt) })
      } catch (error) {
        try {
          const staleSnapshot = await getSnapshot(env)
          if (staleSnapshot) {
            return jsonResponse({
              ...staleSnapshot,
              stale: true,
              refreshError: publicSyncError(error),
            })
          }
        } catch {
          // Fall through to the actionable setup error below.
        }
        return jsonResponse({ error: publicSyncError(error) }, 503)
      }
    }

    const response = await env.ASSETS.fetch(request)
    if (!response.headers.get('Content-Type')?.includes('text/html')) return response

    // firebase.json applies only on Firebase Hosting; set the popup-compatible
    // policy here as this app is served from Cloudflare Workers.
    const headers = new Headers(response.headers)
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshIfExpired(env).catch((error) => {
      console.error('Scheduled currency-rate refresh failed:', error.message)
    }))
  },
}
