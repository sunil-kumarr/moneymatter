import { api } from '@/api/_api';
import type {
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_EVENT_TYPE,
  FixedIncomeEventModel,
} from '@bt/shared/types/investments';

interface CreateFixedIncomeEventPayload {
  type: FIXED_INCOME_EVENT_TYPE;
  eventDate: string;
  grossAmount?: string | null;
  principalComponent?: string | null;
  interestComponent?: string | null;
  taxWithheld?: string | null;
  currencyCode: string;
  cashFlowMode?: FIXED_INCOME_CASH_FLOW_MODE;
  resetsAccrualClock?: boolean;
  transactionIds?: string[];
  notes?: string | null;
}

type UpdateFixedIncomeEventPayload = Partial<
  Pick<
    CreateFixedIncomeEventPayload,
    | 'eventDate'
    | 'grossAmount'
    | 'principalComponent'
    | 'interestComponent'
    | 'taxWithheld'
    | 'resetsAccrualClock'
    | 'notes'
  >
>;

export const createFixedIncomeEvent = async (params: {
  positionId: string;
  payload: CreateFixedIncomeEventPayload;
}): Promise<FixedIncomeEventModel> => {
  return api.post(`/fixed-income/positions/${params.positionId}/events`, params.payload);
};

export const listFixedIncomeEvents = async (params: { positionId: string }): Promise<FixedIncomeEventModel[]> => {
  return api.get(`/fixed-income/positions/${params.positionId}/events`);
};

export const updateFixedIncomeEvent = async (params: {
  eventId: string;
  payload: UpdateFixedIncomeEventPayload;
}): Promise<FixedIncomeEventModel> => {
  return api.put(`/fixed-income/events/${params.eventId}`, params.payload);
};

export const deleteFixedIncomeEvent = async (params: { eventId: string }): Promise<void> => {
  return api.delete(`/fixed-income/events/${params.eventId}`);
};
