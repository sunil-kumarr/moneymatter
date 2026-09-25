import { api } from '@/api/_api';
import type {
  DAY_COUNT_CONVENTION,
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_INSTRUMENT_TYPE,
  FixedIncomePositionMetricsModel,
  FixedIncomePositionModel,
  INTEREST_COMPOUNDING_FREQUENCY,
} from '@bt/shared/types/investments';

interface CreateFixedIncomePositionPayload {
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
  initialInvestment?: {
    cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE;
    transactionIds?: string[];
  };
}

type UpdateFixedIncomePositionPayload = Partial<
  Pick<
    CreateFixedIncomePositionPayload,
    | 'name'
    | 'interestRatePct'
    | 'compoundingFrequency'
    | 'dayCountConvention'
    | 'expectedEndDate'
    | 'counterpartyName'
    | 'counterpartyPayeeId'
    | 'notes'
  >
>;

export const createFixedIncomePosition = async (
  payload: CreateFixedIncomePositionPayload,
): Promise<FixedIncomePositionModel> => {
  return api.post('/fixed-income/positions', payload);
};

export const listFixedIncomePositions = async (
  params: { portfolioId?: string; instrumentType?: FIXED_INCOME_INSTRUMENT_TYPE } = {},
): Promise<FixedIncomePositionModel[]> => {
  return api.get('/fixed-income/positions', params);
};

export const getFixedIncomePosition = async (params: { positionId: string }): Promise<FixedIncomePositionModel> => {
  return api.get(`/fixed-income/positions/${params.positionId}`);
};

export const getFixedIncomePositionMetrics = async (params: {
  positionId: string;
}): Promise<FixedIncomePositionMetricsModel> => {
  return api.get(`/fixed-income/positions/${params.positionId}/metrics`);
};

export const updateFixedIncomePosition = async (params: {
  positionId: string;
  payload: UpdateFixedIncomePositionPayload;
}): Promise<FixedIncomePositionModel> => {
  return api.put(`/fixed-income/positions/${params.positionId}`, params.payload);
};

export const deleteFixedIncomePosition = async (params: { positionId: string }): Promise<void> => {
  return api.delete(`/fixed-income/positions/${params.positionId}`);
};
