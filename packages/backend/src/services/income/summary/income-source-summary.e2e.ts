import { INCOME_COMPONENT_KIND } from '@bt/shared/types/income';
import { generateRandomRecordId } from '@common/lib/record-id-helpers';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import * as helpers from '@tests/helpers';

describe('Income Source Summary E2E', () => {
  it('returns zeroed KPIs for a source with no credits yet', async () => {
    const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

    const summary = await helpers.getIncomeSourceSummary({ sourceId: source.id, raw: true });

    expect(summary.totalGross).toBe('0.00');
    expect(summary.totalNet).toBe('0.00');
    expect(summary.monthsCounted).toBe(0);
    expect(summary.latestCreditDate).toBeNull();
  });

  it('aggregates gross/net/deductions and the effective deduction rate across credits', async () => {
    const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

    await helpers.createIncomeCredit({
      sourceId: source.id,
      payload: helpers.buildIncomeCreditPayload({
        creditDate: '2024-04-05',
        components: [
          { name: 'Basic', kind: INCOME_COMPONENT_KIND.earning, amount: '80000' },
          { name: 'Tax', kind: INCOME_COMPONENT_KIND.deduction, amount: '20000' },
        ],
      }),
    });
    await helpers.createIncomeCredit({
      sourceId: source.id,
      payload: helpers.buildIncomeCreditPayload({
        creditDate: '2024-05-05',
        components: [
          { name: 'Basic', kind: INCOME_COMPONENT_KIND.earning, amount: '80000' },
          { name: 'Tax', kind: INCOME_COMPONENT_KIND.deduction, amount: '20000' },
        ],
      }),
    });

    const summary = await helpers.getIncomeSourceSummary({ sourceId: source.id, raw: true });

    expect(summary.totalGross).toBe('160000.00');
    expect(summary.totalDeductions).toBe('40000.00');
    expect(summary.totalNet).toBe('120000.00');
    expect(summary.effectiveDeductionRatePct).toBe('25.00');
    expect(summary.monthsCounted).toBe(2);
    expect(summary.latestCreditDate).toBe('2024-05-05');
  }, 30000);

  it('returns the all-sources rollup when no id is given', async () => {
    await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload({ name: 'Job A' }) });
    await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload({ name: 'Job B' }) });

    const summary = await helpers.getIncomeSourceSummary({ raw: true });
    expect(summary.sourceId).toBe('all');
    expect(summary.sourceName).toBe('All Sources');
  });

  it('returns 404 for an unknown source id', async () => {
    const response = await helpers.getIncomeSourceSummary({ sourceId: generateRandomRecordId() });
    expect(response.statusCode).toBe(ERROR_CODES.NotFoundError);
  });
});
