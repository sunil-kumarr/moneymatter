import {
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_EVENT_TYPE,
  FIXED_INCOME_INSTRUMENT_TYPE,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { removeUndefinedKeys } from '@js/helpers';
import { createFixedIncomeEvent as _createFixedIncomeEvent } from '@services/investments/fixed-income/events/create.service';
import { getFixedIncomePositionMetrics as _getFixedIncomePositionMetrics } from '@services/investments/fixed-income/metrics/get-position-metrics.service';
import { createFixedIncomePosition as _createFixedIncomePosition } from '@services/investments/fixed-income/positions/create.service';

import { makeRequest } from '../common';

export function buildFixedIncomePositionPayload({
  portfolioId,
  instrumentType = FIXED_INCOME_INSTRUMENT_TYPE.fixed_deposit,
  name = 'Test FD',
  currencyCode = global.BASE_CURRENCY_CODE,
  principal = '10000',
  interestRatePct = '10',
  compoundingFrequency = INTEREST_COMPOUNDING_FREQUENCY.annually,
  dayCountConvention = DAY_COUNT_CONVENTION.actual_365,
  startDate = '2024-01-01',
  expectedEndDate,
  interestPayoutFrequency = INTEREST_PAYOUT_FREQUENCY.cumulative,
  maturityInstruction = FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account,
  payoutAccountId,
}: Partial<Omit<Parameters<typeof _createFixedIncomePosition>[0], 'userId'>> & { portfolioId: string }) {
  return {
    portfolioId,
    instrumentType,
    name,
    currencyCode,
    principal,
    interestRatePct,
    compoundingFrequency,
    dayCountConvention,
    startDate,
    interestPayoutFrequency,
    maturityInstruction,
    ...removeUndefinedKeys({ expectedEndDate, payoutAccountId }),
  };
}

export async function createFixedIncomePosition<R extends boolean | undefined = false>({
  payload,
  raw,
}: {
  payload: ReturnType<typeof buildFixedIncomePositionPayload>;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _createFixedIncomePosition>>, R>({
    method: 'post',
    url: '/fixed-income/positions',
    payload,
    raw,
  });
}

export async function createFixedIncomeEvent<R extends boolean | undefined = false>({
  positionId,
  payload,
  raw,
}: {
  positionId: string;
  payload: {
    type: FIXED_INCOME_EVENT_TYPE;
    eventDate: string;
    grossAmount?: string | null;
    principalComponent?: string | null;
    interestComponent?: string | null;
    currencyCode?: string;
    cashFlowMode?: FIXED_INCOME_CASH_FLOW_MODE;
    transactionIds?: string[];
  };
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _createFixedIncomeEvent>>, R>({
    method: 'post',
    url: `/fixed-income/positions/${positionId}/events`,
    payload: { currencyCode: global.BASE_CURRENCY_CODE, ...payload },
    raw,
  });
}

export async function getFixedIncomePositionMetrics<R extends boolean | undefined = false>({
  positionId,
  raw,
}: {
  positionId: string;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _getFixedIncomePositionMetrics>>, R>({
    method: 'get',
    url: `/fixed-income/positions/${positionId}/metrics`,
    raw,
  });
}
