import { PAYMENT_TYPES, TRANSACTION_TRANSFER_NATURE, TRANSACTION_TYPES } from '@bt/shared/types';
import { generateRandomRecordId } from '@common/lib/record-id-helpers';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import * as helpers from '@tests/helpers';

describe('Income Credit Linking E2E', () => {
  describe('POST /income/credits/:id/links', () => {
    it('links an income transaction, keeps it counted as income in cash flow, and rejects a double-link', async () => {
      const account = await helpers.createAccount({ raw: true });
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });
      const credit = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: helpers.buildIncomeCreditPayload(),
        raw: true,
      });

      const tx = await helpers.createTransaction({
        payload: helpers.buildTransactionPayload({
          accountId: account.id,
          amount: 55000,
          transactionType: TRANSACTION_TYPES.income,
          paymentType: PAYMENT_TYPES.creditCard,
          transferNature: TRANSACTION_TRANSFER_NATURE.not_transfer,
          time: '2024-04-05T00:00:00.000Z',
        }),
        raw: true,
      });
      const [transaction] = tx;

      const linkResponse = await helpers.linkTransactionsToCredit({
        creditId: credit.id,
        transactionIds: [transaction!.id],
      });
      expect(linkResponse.statusCode).toBe(201);

      // Regression guard: linking must not re-stamp transferNature — a salary
      // credit that got re-stamped as a transfer would silently drop out of
      // cash-flow / savings / net-worth stats.
      const cashFlow = await helpers.getCashFlow({
        from: '2024-04-01',
        to: '2024-04-30',
        granularity: 'monthly',
        raw: true,
      });
      expect(cashFlow.totals.income).toBeGreaterThanOrEqual(550);

      const doubleLink = await helpers.linkTransactionsToCredit({
        creditId: credit.id,
        transactionIds: [transaction!.id],
      });
      expect(doubleLink.statusCode).toBe(ERROR_CODES.ConflictError);
    }, 30000);

    it('rejects linking an expense transaction', async () => {
      const account = await helpers.createAccount({ raw: true });
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });
      const credit = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: helpers.buildIncomeCreditPayload(),
        raw: true,
      });

      const [transaction] = await helpers.createTransaction({
        payload: helpers.buildTransactionPayload({
          accountId: account.id,
          amount: 1000,
          transactionType: TRANSACTION_TYPES.expense,
        }),
        raw: true,
      });

      const response = await helpers.linkTransactionsToCredit({
        creditId: credit.id,
        transactionIds: [transaction!.id],
      });
      expect(response.statusCode).toBe(ERROR_CODES.ValidationError);
    });

    it('returns 404 for an unknown credit', async () => {
      const account = await helpers.createAccount({ raw: true });
      const [transaction] = await helpers.createTransaction({
        payload: helpers.buildTransactionPayload({
          accountId: account.id,
          transactionType: TRANSACTION_TYPES.income,
        }),
        raw: true,
      });

      const response = await helpers.linkTransactionsToCredit({
        creditId: generateRandomRecordId(),
        transactionIds: [transaction!.id],
      });
      expect(response.statusCode).toBe(ERROR_CODES.NotFoundError);
    });
  });

  describe('DELETE /income/credits/:id/links/:transactionId', () => {
    it('unlinks a transaction', async () => {
      const account = await helpers.createAccount({ raw: true });
      const source = await helpers.createIncomeSource({ payload: helpers.buildIncomeSourcePayload(), raw: true });
      const credit = await helpers.createIncomeCredit({
        sourceId: source.id,
        payload: helpers.buildIncomeCreditPayload(),
        raw: true,
      });
      const [transaction] = await helpers.createTransaction({
        payload: helpers.buildTransactionPayload({
          accountId: account.id,
          transactionType: TRANSACTION_TYPES.income,
        }),
        raw: true,
      });

      await helpers.linkTransactionsToCredit({ creditId: credit.id, transactionIds: [transaction!.id] });

      const unlinkResponse = await helpers.unlinkTransactionFromCredit({
        creditId: credit.id,
        transactionId: transaction!.id,
      });
      expect(unlinkResponse.statusCode).toBe(200);
    });
  });
});
