import { INCOME_COMPONENT_KIND } from '@bt/shared/types/income';
import { generateRandomRecordId } from '@common/lib/record-id-helpers';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import * as helpers from '@tests/helpers';

describe('Income Credits E2E', () => {
  describe('POST /income/sources/:sourceId/credits', () => {
    it('reconciles gross/net/deductions from the component breakdown', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

      const credit = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: helpers.buildIncomeCreditPayload({
          components: [
            { name: 'Basic', kind: INCOME_COMPONENT_KIND.earning, amount: '60000' },
            { name: 'HRA', kind: INCOME_COMPONENT_KIND.earning, amount: '20000' },
            { name: 'Provident Fund', kind: INCOME_COMPONENT_KIND.deduction, amount: '5000' },
            { name: 'Employer PF', kind: INCOME_COMPONENT_KIND.employer_contribution, amount: '4800' },
          ],
        }),
        raw: true,
      });

      expect(credit.grossAmount).toBe('80000.00');
      expect(credit.totalDeductions).toBe('5000.00');
      expect(credit.netAmount).toBe('75000.00');
      expect(credit.employerContributions).toBe('4800.00');
      expect(credit.components).toHaveLength(4);
    });

    it('returns 404 for an unknown income source', async () => {
      const response = await helpers.createIncomeCredit({
        sourceId: generateRandomRecordId(),
        payload: helpers.buildIncomeCreditPayload(),
      });
      expect(response.statusCode).toBe(ERROR_CODES.NotFoundError);
    });

    it('rejects a credit with no components', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });

      const response = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: { ...helpers.buildIncomeCreditPayload(), components: [] },
      });
      expect(response.statusCode).toBe(ERROR_CODES.ValidationError);
    });
  });

  describe('GET /income/sources/:sourceId/credits', () => {
    it('returns an empty list for a source with no credits yet', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });
      const credits = await helpers.listIncomeCredits({ sourceId: source.id, raw: true });
      expect(credits).toEqual([]);
    });
  });

  describe('PUT /income/credits/:id', () => {
    it('re-reconciles totals when components are replaced', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });
      const credit = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: helpers.buildIncomeCreditPayload(),
        raw: true,
      });

      const updated = await helpers.updateIncomeCredit({
        creditId: credit.id,
        payload: {
          components: [{ name: 'Basic', kind: INCOME_COMPONENT_KIND.earning, amount: '70000', sortOrder: 0 }],
        },
        raw: true,
      });

      expect(updated.grossAmount).toBe('70000.00');
      expect(updated.netAmount).toBe('70000.00');
      expect(updated.components).toHaveLength(1);
    });
  });

  describe('DELETE /income/credits/:id', () => {
    it('deletes a credit and its components', async () => {
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });
      const credit = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: helpers.buildIncomeCreditPayload(),
        raw: true,
      });

      const deleteResponse = await helpers.deleteIncomeCredit({ creditId: credit.id });
      expect(deleteResponse.statusCode).toBe(200);

      const credits = await helpers.listIncomeCredits({ sourceId: source.id, raw: true });
      expect(credits).toEqual([]);
    });
  });
});
