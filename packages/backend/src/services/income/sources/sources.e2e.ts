import { generateRandomRecordId } from '@common/lib/record-id-helpers';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import * as helpers from '@tests/helpers';

describe('Income Sources E2E', () => {
  describe('POST /income/sources', () => {
    it('creates a source with defaults applied', async () => {
      const source = await helpers.createIncomeSource({
        payload: helpers.buildIncomeSourcePayload({ name: 'Acme Engineer' }),
        raw: true,
      });

      expect(source.name).toBe('Acme Engineer');
      expect(source.status).toBe('active');
      expect(source.currencyCode).toBe(global.BASE_CURRENCY_CODE);
    });

    it('rejects an unknown currency code', async () => {
      const response = await helpers.createIncomeSource({
        payload: helpers.buildIncomeSourcePayload({ currencyCode: 'ZZZ' }),
      });

      expect(response.statusCode).toBe(ERROR_CODES.ValidationError);
    });
  });

  describe('GET /income/sources', () => {
    it('returns an empty list when the user has no sources', async () => {
      const sources = await helpers.listIncomeSources({ raw: true });
      expect(sources).toEqual([]);
    });

    it('lists created sources newest-startDate-first', async () => {
      await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload({ startDate: '2022-01-01' }) });
      await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload({ startDate: '2024-01-01' }) });

      const sources = await helpers.listIncomeSources({ raw: true });
      expect(sources).toHaveLength(2);
      expect(sources[0]!.startDate).toBe('2024-01-01');
    });

    it('lists sources in descending order of the last credit date', async () => {
      const olderJob = await helpers.createIncomeSource({
        payload: helpers.buildIncomeSourcePayload({ name: 'Old Job', startDate: '2020-01-01' }),
        raw: true,
      });
      const newerJob = await helpers.createIncomeSource({
        payload: helpers.buildIncomeSourcePayload({ name: 'New Job', startDate: '2024-01-01' }),
        raw: true,
      });

      // Older job has a recent credit in September
      await helpers.createIncomeCredit({
        sourceId: olderJob.id,
        payload: helpers.buildIncomeCreditPayload({ creditDate: '2026-09-01' }),
      });
      // Newer job has an earlier credit in August
      await helpers.createIncomeCredit({
        sourceId: newerJob.id,
        payload: helpers.buildIncomeCreditPayload({ creditDate: '2026-08-01' }),
      });

      const sources = await helpers.listIncomeSources({ raw: true });
      expect(sources.length).toBeGreaterThanOrEqual(2);
      const olderJobIndex = sources.findIndex((s) => s.id === olderJob.id);
      const newerJobIndex = sources.findIndex((s) => s.id === newerJob.id);
      expect(olderJobIndex).toBeLessThan(newerJobIndex);
      expect(sources[olderJobIndex]!.latestCreditDate).toBe('2026-09-01');
    });
  });

  describe('GET /income/sources/:id', () => {
    it('returns 404 for another user’s or unknown source', async () => {
      const response = await helpers.getIncomeSource({ sourceId: generateRandomRecordId() });
      expect(response.statusCode).toBe(ERROR_CODES.NotFoundError);
    });
  });

  describe('PUT /income/sources/:id', () => {
    it('updates mutable fields', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

      const updated = await helpers.updateIncomeSource({
        sourceId: source.id,
        payload: { jobTitle: 'Staff Engineer', status: 'ended' },
        raw: true,
      });

      expect(updated.jobTitle).toBe('Staff Engineer');
      expect(updated.status).toBe('ended');
    });
  });

  describe('DELETE /income/sources/:id', () => {
    it('soft-deletes a source and hides it from the list', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

      const deleteResponse = await helpers.deleteIncomeSource({ sourceId: source.id });
      expect(deleteResponse.statusCode).toBe(200);

      const getResponse = await helpers.getIncomeSource({ sourceId: source.id });
      expect(getResponse.statusCode).toBe(ERROR_CODES.NotFoundError);
    });
  });
});
