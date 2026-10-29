/*
  Money maths for the home dashboard: the goal-car plan and the revenue split.
  Planning estimates from Zak's own assumptions, not financial advice.
*/

/* NZ individual income tax, rates from 31 July 2024. */
export const NZ_TAX_BRACKETS: [number, number][] = [
  [15_600, 0.105], [53_500, 0.175], [78_100, 0.30], [180_000, 0.33], [Infinity, 0.39]
]
/* ACC earners' levy 2025/26, on earnings up to the cap. */
export const ACC_LEVY = { rate: 0.0167, cap: 152_790 }

export function nzIncomeTax(annual: number): number {
  let tax = 0
  let lower = 0
  for (const [upper, rate] of NZ_TAX_BRACKETS) {
    if (annual <= lower) break
    tax += (Math.min(annual, upper) - lower) * rate
    lower = upper
  }
  return tax
}

export function takeHome(annualGross: number): number {
  return annualGross - nzIncomeTax(annualGross) - Math.min(annualGross, ACC_LEVY.cap) * ACC_LEVY.rate
}

/* Standard amortised loan repayment per month. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12)
  if (principal <= 0 || n <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

export interface CarGoal {
  name: string
  price: number
  depositPct: number
  termYears: number
  ratePct: number
  /* Insurance, servicing, tyres, fuel, registration. */
  runningMonthly: number
  /*
    Total car costs as a share of gross personal income. Zak lives at home with
    no rent or mortgage, and the car is his main goal, so 30-40% is his ceiling
    (general rules of thumb assume housing costs and sit near 10-15%).
  */
  safeIncomePct: number
}

/* Zak's rule: never less than 40% down on a car. */
export const MIN_DEPOSIT_PCT = 40

export const DEFAULT_CAR_GOAL: CarGoal = {
  name: 'McLaren 570S', price: 200_000, depositPct: MIN_DEPOSIT_PCT, termYears: 4, ratePct: 11.95, runningMonthly: 1_200, safeIncomePct: 35
}

export interface CarPlan {
  deposit: number
  financed: number
  payment: number
  totalInterest: number
  monthlyCarCost: number
  requiredGrossAnnual: number
  requiredRevenueMonthly: number
  currentGrossAnnual: number
  extraRevenueMonthly: number
  retainersNeeded: number
  depositSaved: number
  depositPctSaved: number
}

/*
  "Safe" means total monthly car cost stays within safeIncomePct of gross
  personal income. Personal income comes from the business at the owner-pay
  share of revenue, so required revenue = required income / payShare.
*/
export function carPlan(goal: CarGoal, opts: { mrr: number; payPct: number; retainerFee: number; depositSaved: number }): CarPlan {
  const deposit = goal.price * (Math.max(MIN_DEPOSIT_PCT, goal.depositPct) / 100)
  const financed = Math.max(0, goal.price - deposit)
  const payment = monthlyPayment(financed, goal.ratePct, goal.termYears)
  const monthlyCarCost = payment + goal.runningMonthly
  const requiredGrossAnnual = (monthlyCarCost * 12) / Math.max(0.01, goal.safeIncomePct / 100)
  const share = Math.max(0.01, opts.payPct / 100)
  const requiredRevenueMonthly = requiredGrossAnnual / 12 / share
  const currentGrossAnnual = opts.mrr * 12 * share
  const extraRevenueMonthly = Math.max(0, requiredRevenueMonthly - opts.mrr)
  return {
    deposit, financed, payment, totalInterest: payment * goal.termYears * 12 - financed, monthlyCarCost,
    requiredGrossAnnual, requiredRevenueMonthly, currentGrossAnnual, extraRevenueMonthly,
    retainersNeeded: opts.retainerFee > 0 ? Math.ceil(extraRevenueMonthly / opts.retainerFee) : 0,
    depositSaved: opts.depositSaved, depositPctSaved: deposit > 0 ? Math.min(1, opts.depositSaved / deposit) : 1
  }
}

/* Where each dollar of revenue goes. Shares are percentages of revenue after GST. */
export interface RevenueSplit { pay: number; save: number; tax: number; opex: number; gstRegistered: boolean }

/* A solo service business under $250k: pay yourself first, keep tax aside, build a buffer. */
export const DEFAULT_SPLIT: RevenueSplit = { pay: 50, save: 10, tax: 15, opex: 25, gstRegistered: false }

export const BUCKETS = ['pay', 'save', 'tax', 'opex'] as const
export type Bucket = (typeof BUCKETS)[number]
export const BUCKET_LABEL: Record<Bucket, string> = { pay: 'Your pay', save: 'Savings', tax: 'Tax set aside', opex: 'Running costs' }

export function splitRevenue(amount: number, s: RevenueSplit): { gst: number; net: number; buckets: Record<Bucket, number> } {
  const gst = s.gstRegistered ? amount * (15 / 115) : 0
  const net = amount - gst
  const total = BUCKETS.reduce((t, b) => t + Math.max(0, s[b]), 0) || 1
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, (net * Math.max(0, s[b])) / total])) as Record<Bucket, number>
  return { gst, net, buckets }
}

/* Monthly totals for the last `months` months, oldest first, keyed YYYY-MM in local time. */
export function monthlySeries<T extends { amount: number }>(rows: T[], dateOf: (r: T) => string, months = 12, now = new Date()): { month: string; total: number }[] {
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const sums = new Map(keys.map((k) => [k, 0]))
  for (const r of rows) {
    const k = dateOf(r).slice(0, 7)
    if (sums.has(k)) sums.set(k, sums.get(k)! + r.amount)
  }
  return keys.map((month) => ({ month, total: sums.get(month)! }))
}
