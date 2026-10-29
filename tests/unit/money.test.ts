import { describe, expect, it } from 'vitest'
import { carPlan, DEFAULT_CAR_GOAL, monthlyPayment, monthlySeries, nzIncomeTax, splitRevenue, takeHome } from '@shared/money'

describe('NZ tax', () => {
  it('applies the 2024 brackets', () => {
    expect(nzIncomeTax(15_600)).toBeCloseTo(1_638, 0)
    expect(nzIncomeTax(53_500)).toBeCloseTo(1_638 + 37_900 * 0.175, 0)
    expect(nzIncomeTax(100_000)).toBeCloseTo(1_638 + 6_632.5 + 7_380 + 21_900 * 0.33, 0)
    expect(takeHome(100_000)).toBeLessThan(100_000 - nzIncomeTax(100_000))
  })
})

describe('car plan', () => {
  it('amortises a loan', () => {
    expect(monthlyPayment(160_000, 11.95, 4)).toBeCloseTo(4_212, -1)
    expect(monthlyPayment(12_000, 0, 1)).toBe(1_000)
  })
  it('works out the revenue a safe 570S needs', () => {
    const p = carPlan(DEFAULT_CAR_GOAL, { mrr: 6_000, payPct: 50, retainerFee: 3_000, depositSaved: 10_000 })
    expect(p.deposit).toBe(80_000)
    expect(p.financed).toBe(120_000)
    expect(carPlan({ ...DEFAULT_CAR_GOAL, depositPct: 20 }, { mrr: 0, payPct: 50, retainerFee: 3_000, depositSaved: 0 }).deposit).toBe(80_000)
    const yearly = (p.payment + 1_200) * 12
    expect(DEFAULT_CAR_GOAL.safeIncomePct).toBe(35)
    expect(p.requiredGrossAnnual).toBeCloseTo(yearly / 0.35, 0)
    expect(p.requiredRevenueMonthly).toBeCloseTo(p.requiredGrossAnnual / 12 / 0.5, 0)
    expect(p.extraRevenueMonthly).toBeCloseTo(p.requiredRevenueMonthly - 6_000, 0)
    expect(p.retainersNeeded).toBe(Math.ceil(p.extraRevenueMonthly / 3_000))
    expect(p.depositPctSaved).toBeCloseTo(0.125)
  })
})

describe('revenue split', () => {
  it('takes GST off the top when registered and splits the rest', () => {
    const r = splitRevenue(11_500, { pay: 50, save: 10, tax: 15, opex: 25, gstRegistered: true })
    expect(r.gst).toBeCloseTo(1_500)
    expect(r.buckets.pay).toBeCloseTo(5_000)
    expect(r.buckets.save).toBeCloseTo(1_000)
    expect(splitRevenue(1_000, { pay: 50, save: 10, tax: 15, opex: 25, gstRegistered: false }).gst).toBe(0)
  })
  it('normalises shares that do not add to 100', () => {
    const r = splitRevenue(1_000, { pay: 1, save: 1, tax: 1, opex: 1, gstRegistered: false })
    expect(r.buckets.pay).toBe(250)
  })
  it('buckets revenue by month', () => {
    const s = monthlySeries([{ amount: 3000, at: '2026-10-02' }, { amount: 1400, at: '2026-09-15' }, { amount: 9, at: '2024-01-01' }], (r) => r.at, 3, new Date(2026, 9, 29))
    expect(s).toEqual([{ month: '2026-08', total: 0 }, { month: '2026-09', total: 1400 }, { month: '2026-10', total: 3000 }])
  })
})
