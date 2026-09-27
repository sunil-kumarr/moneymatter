import { INCOME_COMPONENT_KIND } from '@bt/shared/types/income';
import { Money } from '@common/types/money';

import { reconcileCreditTotals } from './reconcile-credit-totals';

describe('reconcileCreditTotals', () => {
  it('sums earnings into gross, deductions into totalDeductions, and derives net', () => {
    const totals = reconcileCreditTotals([
      { kind: INCOME_COMPONENT_KIND.earning, amount: Money.fromDecimal('60000') },
      { kind: INCOME_COMPONENT_KIND.earning, amount: Money.fromDecimal('20000') },
      { kind: INCOME_COMPONENT_KIND.deduction, amount: Money.fromDecimal('5000') },
      { kind: INCOME_COMPONENT_KIND.employer_contribution, amount: Money.fromDecimal('4800') },
    ]);

    expect(totals.grossAmount.toDecimalString(2)).toBe('80000.00');
    expect(totals.totalDeductions.toDecimalString(2)).toBe('5000.00');
    expect(totals.netAmount.toDecimalString(2)).toBe('75000.00');
    expect(totals.employerContributions.toDecimalString(2)).toBe('4800.00');
  });

  it('returns zero totals for an empty component list', () => {
    const totals = reconcileCreditTotals([]);

    expect(totals.grossAmount.isZero()).toBe(true);
    expect(totals.netAmount.isZero()).toBe(true);
  });
});
