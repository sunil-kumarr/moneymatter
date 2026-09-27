import { api } from '@/api/_api';
import type {
  IncomeComponentTemplateItem,
  IncomeSourceModel,
  IncomeSourceSummaryModel,
  IncomeTimeseriesResponse,
  INCOME_SOURCE_STATUS,
  INCOME_SOURCE_TYPE,
  PAY_CADENCE,
} from '@bt/shared/types/income';

export interface CreateIncomeSourcePayload {
  name: string;
  employerName?: string | null;
  employerPayeeId?: string | null;
  jobTitle?: string | null;
  sourceType?: INCOME_SOURCE_TYPE;
  startDate: string;
  endDate?: string | null;
  currencyCode: string;
  payCadence?: PAY_CADENCE;
  expectedAnnualCtc?: number | null;
  payoutAccountId?: string | null;
  taxRegime?: string | null;
  employerIdentifier?: string | null;
  notes?: string | null;
  color?: string | null;
  componentTemplate?: IncomeComponentTemplateItem[] | null;
}

export type UpdateIncomeSourcePayload = Partial<CreateIncomeSourcePayload> & { status?: INCOME_SOURCE_STATUS };

export const getIncomeSources = async (params?: { status?: INCOME_SOURCE_STATUS }): Promise<IncomeSourceModel[]> => {
  return api.get('/income/sources', params ?? {});
};

export const getIncomeSource = async (params: { sourceId: string }): Promise<IncomeSourceModel> => {
  return api.get(`/income/sources/${params.sourceId}`);
};

export const createIncomeSource = async (payload: CreateIncomeSourcePayload): Promise<IncomeSourceModel> => {
  return api.post('/income/sources', payload);
};

export const updateIncomeSource = async (params: {
  sourceId: string;
  payload: UpdateIncomeSourcePayload;
}): Promise<IncomeSourceModel> => {
  return api.put(`/income/sources/${params.sourceId}`, params.payload);
};

export const deleteIncomeSource = async (params: { sourceId: string }): Promise<void> => {
  return api.delete(`/income/sources/${params.sourceId}`);
};

export const getIncomeSourceSummary = async (params: {
  sourceId?: string;
  sourceIds?: string[];
}): Promise<IncomeSourceSummaryModel> => {
  const url =
    !params.sourceId || params.sourceId === 'all'
      ? '/income/sources/summary'
      : `/income/sources/${params.sourceId}/summary`;
  return api.get(url, { sourceIds: params.sourceIds?.join(',') });
};

export interface GetIncomeTimeseriesParams {
  sourceId?: string;
  sourceIds?: string[];
  period?: string;
  financialYear?: string;
  from?: string;
  to?: string;
}

export const getIncomeTimeseries = async (params: GetIncomeTimeseriesParams): Promise<IncomeTimeseriesResponse> => {
  const url =
    !params.sourceId || params.sourceId === 'all'
      ? '/income/sources/timeseries'
      : `/income/sources/${params.sourceId}/timeseries`;
  return api.get(url, {
    sourceIds: params.sourceIds?.join(','),
    period: params.period,
    financialYear: params.financialYear,
    from: params.from,
    to: params.to,
  });
};
