import { PAYMENT_TYPES, TRANSACTION_TRANSFER_NATURE, TRANSACTION_TYPES } from '@bt/shared/types';
import { recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { deserializeCreateTransaction, serializeTransactionTuple } from '@root/serializers';
import { createTransaction } from '@services/transactions/create-transaction';
import { z } from 'zod';

import { getUserId, jsonContent, requireScope } from './helpers';

const inputSchema = {
  loanAccountId: recordId().describe('ID of the loan account being paid down'),
  sourceAccountId: recordId().describe('ID of the account the payment is made from'),
  amount: z.number().describe('Payment amount as a decimal, in the source account currency (e.g. 250.00)'),
  destinationAmount: z
    .number()
    .optional()
    .describe(
      'Amount credited to the loan balance, as a decimal in the loan account currency. Only needed when the loan currency differs from the source account currency; otherwise defaults to amount',
    ),
  paymentType: z
    .enum([
      PAYMENT_TYPES.bankTransfer,
      PAYMENT_TYPES.cash,
      PAYMENT_TYPES.creditCard,
      PAYMENT_TYPES.debitCard,
      PAYMENT_TYPES.mobilePayment,
      PAYMENT_TYPES.voucher,
      PAYMENT_TYPES.webPayment,
    ])
    .describe('Payment method used'),
  time: z.string().optional().describe('Payment date/time as ISO 8601 string. Defaults to now'),
  note: z.string().optional().describe('Optional note for this payment'),
  tagIds: z.array(recordId()).optional().describe('Tag IDs to assign to this payment'),
};

export function registerRecordLoanPayment(server: McpServer) {
  server.registerTool(
    'record_loan_payment',
    {
      description:
        'Record a payment against a loan, paying down its balance. Moves money from sourceAccountId to loanAccountId as an expense on the source side. The server rejects payments that would overpay the loan below zero.',
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      requireScope({ extra, scope: 'finance:write' });
      trackMcpToolUsed({ userId, tool: 'record_loan_payment', clientId: extra.authInfo?.clientId });

      const params = deserializeCreateTransaction(
        {
          amount: args.amount,
          note: args.note,
          time: args.time,
          transactionType: TRANSACTION_TYPES.expense,
          paymentType: args.paymentType,
          accountId: args.sourceAccountId,
          destinationAmount: args.destinationAmount ?? args.amount,
          destinationAccountId: args.loanAccountId,
          transferNature: TRANSACTION_TRANSFER_NATURE.common_transfer,
          tagIds: args.tagIds,
        },
        userId,
      );

      const result = await createTransaction(params);
      return jsonContent({ data: serializeTransactionTuple(result) });
    },
  );
}
