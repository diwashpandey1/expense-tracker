export function budgetUtilization(spentMinor, limitMinor, warningThreshold = 80) {
  const spent = BigInt(spentMinor)
  const limit = BigInt(limitMinor)
  if (spent < 0n || limit <= 0n) throw new Error('Budget spend must be nonnegative and the limit must be positive.')
  const percent = Number(spent * 100n / limit)
  return {
    percent,
    remainingMinor: limit > spent ? limit - spent : 0n,
    overMinor: spent > limit ? spent - limit : 0n,
    status: percent >= 100 ? 'exceeded' : percent >= warningThreshold ? 'warning' : 'on_track',
  }
}
