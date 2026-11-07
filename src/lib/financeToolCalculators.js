const number = (value, label) => {
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error(`Enter a valid ${label.toLowerCase()}.`)
  return result
}

const positive = (value, label) => {
  const result = number(value, label)
  if (result <= 0) throw new Error(`${label} must be greater than zero.`)
  return result
}

const nonNegative = (value, label) => {
  const result = number(value, label)
  if (result < 0) throw new Error(`${label} cannot be negative.`)
  return result
}

export function calculateFinanceTool(toolId, values) {
  if (toolId === 'compound-interest') {
    const principal = positive(values.principal, 'Starting amount')
    const rate = nonNegative(values.rate, 'Annual return') / 100
    const years = positive(values.years, 'Time period')
    const compoundsPerYear = positive(values.frequency, 'Compounding frequency')
    if (years > 100) throw new Error('Use a time period of 100 years or less.')
    const total = principal * (1 + rate / compoundsPerYear) ** (compoundsPerYear * years)
    return [
      { label: 'Estimated future value', value: total },
      { label: 'Estimated growth', value: total - principal },
      { label: 'Starting amount', value: principal },
    ]
  }

  if (toolId === 'loan-emi') {
    const principal = positive(values.principal, 'Loan amount')
    const annualRate = nonNegative(values.rate, 'Annual interest rate')
    const years = positive(values.years, 'Loan term')
    if (years > 100) throw new Error('Use a loan term of 100 years or less.')
    const months = Math.max(1, Math.round(years * 12))
    const monthlyRate = annualRate / 1200
    const payment = monthlyRate === 0
      ? principal / months
      : principal * monthlyRate * (1 + monthlyRate) ** months / ((1 + monthlyRate) ** months - 1)
    const totalPaid = payment * months
    return [
      { label: 'Estimated monthly payment', value: payment },
      { label: 'Total interest', value: totalPaid - principal },
      { label: 'Total repaid', value: totalPaid },
    ]
  }

  if (toolId === 'savings-goal') {
    const target = positive(values.target, 'Savings target')
    const current = nonNegative(values.current, 'Current savings')
    const months = positive(values.months, 'Number of months')
    const remaining = Math.max(target - current, 0)
    return [
      { label: 'Save each month', value: remaining / months },
      { label: 'Still to save', value: remaining },
      { label: 'Already saved', value: current },
    ]
  }

  if (toolId === 'emergency-fund') {
    const monthlyExpenses = positive(values.expenses, 'Monthly essential expenses')
    const months = positive(values.months, 'Months of coverage')
    if (months > 36) throw new Error('Choose up to 36 months of coverage.')
    const target = monthlyExpenses * months
    return [
      { label: 'Suggested fund target', value: target },
      { label: 'Monthly expenses', value: monthlyExpenses },
      { label: 'Months covered', value: `${months} months` },
    ]
  }

  if (toolId === 'budget-split') {
    const income = positive(values.income, 'Monthly take-home income')
    return [
      { label: 'Needs · 50%', value: income * 0.5 },
      { label: 'Wants · 30%', value: income * 0.3 },
      { label: 'Savings and debt · 20%', value: income * 0.2 },
    ]
  }

  if (toolId === 'debt-payoff') {
    const balance = positive(values.balance, 'Current debt balance')
    const payment = positive(values.payment, 'Monthly payment')
    const monthlyRate = nonNegative(values.rate, 'Annual interest rate') / 1200
    const interestFirstMonth = balance * monthlyRate
    if (payment <= interestFirstMonth) throw new Error('Monthly payment must be greater than the first month’s interest.')
    let remaining = balance
    let totalPaid = 0
    let months = 0
    while (remaining > 0 && months < 1200) {
      const interest = remaining * monthlyRate
      const installment = Math.min(payment, remaining + interest)
      remaining = Math.max(remaining + interest - installment, 0)
      totalPaid += installment
      months += 1
    }
    if (remaining > 0) throw new Error('This payment plan would take more than 100 years to repay.')
    return [
      { label: 'Time to repay', value: `${months} months` },
      { label: 'Estimated interest', value: totalPaid - balance },
      { label: 'Total paid', value: totalPaid },
    ]
  }

  if (toolId === 'net-worth') {
    const assets = nonNegative(values.assets, 'Total assets')
    const debts = nonNegative(values.debts, 'Total liabilities')
    return [
      { label: 'Estimated net worth', value: assets - debts },
      { label: 'Total assets', value: assets },
      { label: 'Total liabilities', value: debts },
    ]
  }

  if (toolId === 'inflation') {
    const amount = positive(values.amount, 'Current amount')
    const annualRate = nonNegative(values.rate, 'Annual inflation rate') / 100
    const years = positive(values.years, 'Time period')
    if (years > 100) throw new Error('Use a time period of 100 years or less.')
    const futureCost = amount * (1 + annualRate) ** years
    return [
      { label: 'Future amount needed', value: futureCost },
      { label: 'Extra amount due to inflation', value: futureCost - amount },
      { label: 'Today’s amount', value: amount },
    ]
  }

  if (toolId === 'take-home') {
    const gross = positive(values.income, 'Gross monthly income')
    const deductionsPercent = nonNegative(values.deductions, 'Deductions percentage')
    if (deductionsPercent > 100) throw new Error('Deductions cannot exceed 100%.')
    const takeHome = gross * (1 - deductionsPercent / 100)
    return [
      { label: 'Estimated take-home per month', value: takeHome },
      { label: 'Estimated deductions', value: gross - takeHome },
      { label: 'Estimated take-home per year', value: takeHome * 12 },
    ]
  }

  if (toolId === 'loan-affordability') {
    const income = positive(values.income, 'Monthly take-home income')
    const debts = nonNegative(values.debts, 'Monthly debt payments')
    const paymentRatio = positive(values.ratio, 'Payment ratio')
    const annualRate = nonNegative(values.rate, 'Annual interest rate')
    const years = positive(values.years, 'Loan term')
    if (paymentRatio > 100) throw new Error('Payment ratio cannot exceed 100%.')
    if (years > 100) throw new Error('Use a loan term of 100 years or less.')
    const maxPayment = Math.max(income * paymentRatio / 100 - debts, 0)
    const months = Math.max(1, Math.round(years * 12))
    const monthlyRate = annualRate / 1200
    const principal = monthlyRate === 0
      ? maxPayment * months
      : maxPayment * (1 - (1 + monthlyRate) ** -months) / monthlyRate
    return [
      { label: 'Estimated affordable loan', value: principal },
      { label: 'Payment limit per month', value: maxPayment },
      { label: 'Loan term', value: `${years} years` },
    ]
  }

  throw new Error('Choose a finance tool to calculate.')
}
