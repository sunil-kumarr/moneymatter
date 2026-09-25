import {
  DAY_COUNT_CONVENTION,
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_EVENT_TYPE,
  FIXED_INCOME_INSTRUMENT_TYPE,
  FIXED_INCOME_POSITION_STATUS,
  INTEREST_COMPOUNDING_FREQUENCY,
} from '@bt/shared/types/investments';
import { Money } from '@common/types/money';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { ValidationError } from '@js/errors';
import Currencies from '@models/currencies.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Portfolios from '@models/investments/portfolios.model';
import { withTransaction } from '@services/common/with-transaction';

import { createFixedIncomeEvent } from '../events/create.service';

interface InitialInvestmentInput {
  cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE;
  transactionIds?: string[];
}

interface CreateFixedIncomePositionParams {
  userId: number;
  portfolioId: string;
  instrumentType: FIXED_INCOME_INSTRUMENT_TYPE;
  name: string;
  currencyCode: string;
  principal: string;
  interestRatePct?: string;
  compoundingFrequency?: INTEREST_COMPOUNDING_FREQUENCY | null;
  dayCountConvention?: DAY_COUNT_CONVENTION;
  startDate: string;
  expectedEndDate?: string | null;
  counterpartyName?: string | null;
  counterpartyPayeeId?: string | null;
  notes?: string | null;
  initialInvestment?: InitialInvestmentInput;
}

const createFixedIncomePositionImpl = async (params: CreateFixedIncomePositionParams) => {
  const {
    userId,
    portfolioId,
    instrumentType,
    name,
    currencyCode,
    principal,
    interestRatePct = '0',
    compoundingFrequency = null,
    dayCountConvention = DAY_COUNT_CONVENTION.actual_365,
    startDate,
    expectedEndDate = null,
    counterpartyName = null,
    counterpartyPayeeId = null,
    notes = null,
  } = params;

  await findOrThrowNotFound({
    query: Currencies.findOne({ where: { code: currencyCode } }),
    message: 'Currency not found',
  });

  await findOrThrowNotFound({
    query: Portfolios.findOne({ where: { id: portfolioId, userId } }),
    message: 'Portfolio not found',
  });

  if (Number(principal) < 0) {
    throw new ValidationError({ message: 'Principal must be non-negative' });
  }

  // Peer loans are informal — the PRD rules out a compounding schedule for
  // them, so only 'simple' (or unset) is allowed.
  if (
    instrumentType === FIXED_INCOME_INSTRUMENT_TYPE.peer_loan &&
    compoundingFrequency &&
    compoundingFrequency !== INTEREST_COMPOUNDING_FREQUENCY.simple
  ) {
    throw new ValidationError({ message: 'Peer loans only support simple interest' });
  }

  const position = await FixedIncomePositions.create({
    userId,
    portfolioId,
    instrumentType,
    name: name.trim(),
    currencyCode,
    status: FIXED_INCOME_POSITION_STATUS.active,
    principal: Money.fromDecimal(principal),
    interestRatePct,
    compoundingFrequency,
    dayCountConvention,
    startDate,
    expectedEndDate,
    counterpartyName,
    counterpartyPayeeId,
    notes,
  });

  if (params.initialInvestment) {
    await createFixedIncomeEvent({
      userId,
      positionId: position.id,
      type: FIXED_INCOME_EVENT_TYPE.initial_investment,
      eventDate: startDate,
      grossAmount: principal,
      currencyCode,
      cashFlowMode: params.initialInvestment.cashFlowMode,
      transactionIds: params.initialInvestment.transactionIds ?? [],
    });
  }

  return position.reload();
};

export const createFixedIncomePosition = withTransaction(createFixedIncomePositionImpl);
