export function calculateSimpleInterest(principalInput, annualRateInput, yearsInput) {
  const principal = Number(principalInput)
  const annualRate = Number(annualRateInput)
  const years = Number(yearsInput)
  if (![principal, annualRate, years].every(Number.isFinite) || principal <= 0 || annualRate < 0 || years <= 0) throw new Error('Enter a positive principal and time, and a non-negative rate.')
  const interest = principal * annualRate * years / 100
  return { principal, interest, total: principal + interest }
}

export function calculateSipProjection(monthlyInput, annualRateInput, yearsInput) {
  const monthlyPayment = Number(monthlyInput)
  const annualRate = Number(annualRateInput)
  const years = Number(yearsInput)
  if (![monthlyPayment, annualRate, years].every(Number.isFinite) || monthlyPayment <= 0 || annualRate < 0 || !Number.isInteger(years) || years < 1 || years > 100) throw new Error('Enter a positive monthly investment, a non-negative rate, and 1–100 whole years.')
  const months = years * 12
  const monthlyRate = annualRate / 100 / 12
  const total = monthlyRate === 0 ? monthlyPayment * months : monthlyPayment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
  const invested = monthlyPayment * months
  return { invested, total, growth: total - invested, months }
}
