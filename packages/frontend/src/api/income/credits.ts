import { api } from '@/api/_api';
import type {
  IncomeCreditLinkModel,
  IncomeCreditModel,
  INCOME_CASH_FLOW_MODE,
  INCOME_COMPONENT_KIND,
  INCOME_CREDIT_TYPE,
} from '@bt/shared/types/income';

interface CreditComponentPayload {
  name: string;
  kind: INCOME_COMPONENT_KIND;
  amount: number;
  sortOrder?: number;
}

export interface CreateIncomeCreditPayload {
  creditType?: INCOME_CREDIT_TYPE;
  creditDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  components: CreditComponentPayload[];
  cashFlowMode?: INCOME_CASH_FLOW_MODE;
  notes?: string | null;
}

export type UpdateIncomeCreditPayload = Partial<CreateIncomeCreditPayload>;

export const getIncomeCredits = async (params: {
  sourceId: string;
  creditType?: INCOME_CREDIT_TYPE;
  from?: string;
  to?: string;
}): Promise<IncomeCreditModel[]> => {
  const { sourceId, ...query } = params;
  return api.get(`/income/sources/${sourceId}/credits`, query);
};

export const createIncomeCredit = async (params: {
  sourceId: string;
  payload: CreateIncomeCreditPayload;
}): Promise<IncomeCreditModel> => {
  return api.post(`/income/sources/${params.sourceId}/credits`, params.payload);
};

export const updateIncomeCredit = async (params: {
  creditId: string;
  payload: UpdateIncomeCreditPayload;
}): Promise<IncomeCreditModel> => {
  return api.put(`/income/credits/${params.creditId}`, params.payload);
};

export const deleteIncomeCredit = async (params: { creditId: string }): Promise<void> => {
  return api.delete(`/income/credits/${params.creditId}`);
};

export const linkTransactionsToCredit = async (params: {
  creditId: string;
  transactionIds: string[];
}): Promise<IncomeCreditLinkModel[]> => {
  return api.post(`/income/credits/${params.creditId}/links`, { transactionIds: params.transactionIds });
};

export const unlinkTransactionFromCredit = async (params: {
  creditId: string;
  transactionId: string;
}): Promise<void> => {
  return api.delete(`/income/credits/${params.creditId}/links/${params.transactionId}`);
};
