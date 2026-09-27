import { INCOME_CASH_FLOW_MODE, INCOME_COMPONENT_KIND, INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { createIncomeCredit as _createIncomeCredit } from '@services/income/credits/create.service';
import { updateIncomeCredit as _updateIncomeCredit } from '@services/income/credits/update.service';

import { makeRequest } from '../common';

interface BuildCreditComponentInput {
  name: string;
  kind: INCOME_COMPONENT_KIND;
  amount: string;
}

export function buildIncomeCreditPayload({
  creditType = INCOME_CREDIT_TYPE.regular_salary,
  creditDate = '2024-04-05',
  components = [
    { name: 'Basic', kind: INCOME_COMPONENT_KIND.earning, amount: '60000' },
    { name: 'Provident Fund', kind: INCOME_COMPONENT_KIND.deduction, amount: '5000' },
  ],
  cashFlowMode = INCOME_CASH_FLOW_MODE.none,
}: {
  creditType?: INCOME_CREDIT_TYPE;
  creditDate?: string;
  components?: BuildCreditComponentInput[];
  cashFlowMode?: INCOME_CASH_FLOW_MODE;
} = {}) {
  return {
    creditType,
    creditDate,
    components: components.map((component, index) => ({ ...component, sortOrder: index })),
    cashFlowMode,
  };
}

export async function createIncomeCredit<R extends boolean | undefined = false>({
  sourceId,
  payload,
  raw,
}: {
  sourceId: string;
  payload: ReturnType<typeof buildIncomeCreditPayload>;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _createIncomeCredit>>, R>({
    method: 'post',
    url: `/income/sources/${sourceId}/credits`,
    payload,
    raw,
  });
}

export async function listIncomeCredits<R extends boolean | undefined = false>({
  sourceId,
  raw,
}: {
  sourceId: string;
  raw?: R;
}) {
  return makeRequest<unknown, R>({ method: 'get', url: `/income/sources/${sourceId}/credits`, raw });
}

export async function updateIncomeCredit<R extends boolean | undefined = false>({
  creditId,
  payload,
  raw,
}: {
  creditId: string;
  payload: Record<string, unknown>;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _updateIncomeCredit>>, R>({
    method: 'put',
    url: `/income/credits/${creditId}`,
    payload,
    raw,
  });
}

export async function deleteIncomeCredit<R extends boolean | undefined = false>({
  creditId,
  raw,
}: {
  creditId: string;
  raw?: R;
}) {
  return makeRequest<unknown, R>({ method: 'delete', url: `/income/credits/${creditId}`, raw });
}

export async function linkTransactionsToCredit<R extends boolean | undefined = false>({
  creditId,
  transactionIds,
  raw,
}: {
  creditId: string;
  transactionIds: string[];
  raw?: R;
}) {
  return makeRequest<unknown, R>({
    method: 'post',
    url: `/income/credits/${creditId}/links`,
    payload: { transactionIds },
    raw,
  });
}

export async function unlinkTransactionFromCredit<R extends boolean | undefined = false>({
  creditId,
  transactionId,
  raw,
}: {
  creditId: string;
  transactionId: string;
  raw?: R;
}) {
  return makeRequest<unknown, R>({
    method: 'delete',
    url: `/income/credits/${creditId}/links/${transactionId}`,
    raw,
  });
}
