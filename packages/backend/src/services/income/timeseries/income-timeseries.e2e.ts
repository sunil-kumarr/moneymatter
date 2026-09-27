import { generateRandomRecordId } from '@common/lib/record-id-helpers';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import * as helpers from '@tests/helpers';

describe('Income Timeseries E2E', () => {
  it('returns an empty-but-shaped response for a source with no credits', async () => {
    const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

    const timeseries = await helpers.getIncomeTimeseries({ sourceId: source.id, raw: true });

    expect(timeseries.sourceId).toBe(source.id);
    expect(timeseries.months.length).toBeGreaterThan(0);
    expect(timeseries.totalNet).toBe(0);
  });

  it('buckets credits into their financial-year month and accumulates cumulativeNet', async () => {
    const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

    await helpers.createIncomeCredit({
      sourceId: source.id,
      payload: helpers.buildIncomeCreditPayload({ creditDate: '2024-04-05' }),
    });
    await helpers.createIncomeCredit({
      sourceId: source.id,
      payload: helpers.buildIncomeCreditPayload({ creditDate: '2024-05-05' }),
    });

    const timeseries = await helpers.getIncomeTimeseries({
      sourceId: source.id,
      query: { financialYear: 'FY 2024-25' },
      raw: true,
    });

    const april = timeseries.months.find((m) => m.dateKey === '2024-04');
    const may = timeseries.months.find((m) => m.dateKey === '2024-05');

    expect(april?.net).toBe(55000);
    expect(may?.net).toBe(55000);
    expect(may?.cumulativeNet).toBe(110000);
  }, 30000);

  it('returns 404 for an unknown source id', async () => {
    const response = await helpers.getIncomeTimeseries({ sourceId: generateRandomRecordId() });
    expect(response.statusCode).toBe(ERROR_CODES.NotFoundError);
  });
});
