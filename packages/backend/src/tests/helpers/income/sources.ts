import { INCOME_SOURCE_TYPE, IncomeComponentTemplateItem, PAY_CADENCE } from '@bt/shared/types/income';
import { removeUndefinedKeys } from '@js/helpers';
import { createIncomeSource as _createIncomeSource } from '@services/income/sources/create.service';
import { getIncomeSource as _getIncomeSource } from '@services/income/sources/get.service';
import { listIncomeSources as _listIncomeSources } from '@services/income/sources/list.service';
import { updateIncomeSource as _updateIncomeSource } from '@services/income/sources/update.service';
import { getIncomeSourceSummary as _getIncomeSourceSummary } from '@services/income/summary/get-income-source-summary.service';
import { getIncomeTimeseries as _getIncomeTimeseries } from '@services/income/timeseries/get-income-timeseries.service';

import { makeRequest } from '../common';

export function buildIncomeSourcePayload({
  name = 'Test Job',
  employerName = 'Acme Corp',
  sourceType = INCOME_SOURCE_TYPE.salaried,
  startDate = '2024-01-01',
  currencyCode = global.BASE_CURRENCY_CODE,
  payCadence = PAY_CADENCE.monthly,
  expectedAnnualCtc,
  componentTemplate,
}: Partial<Omit<Parameters<typeof _createIncomeSource>[0], 'userId' | 'expectedAnnualCtc'>> & {
  expectedAnnualCtc?: string;
  componentTemplate?: IncomeComponentTemplateItem[] | null;
} = {}) {
  return {
    name,
    employerName,
    sourceType,
    startDate,
    currencyCode,
    payCadence,
    ...removeUndefinedKeys({ expectedAnnualCtc, componentTemplate }),
  };
}

export async function createIncomeSource<R extends boolean | undefined = false>({
  payload,
  raw,
}: {
  payload: ReturnType<typeof buildIncomeSourcePayload>;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _createIncomeSource>>, R>({
    method: 'post',
    url: '/income/sources',
    payload,
    raw,
  });
}

export async function listIncomeSources<R extends boolean | undefined = false>({ raw }: { raw?: R } = {}) {
  return makeRequest<Awaited<ReturnType<typeof _listIncomeSources>>, R>({ method: 'get', url: '/income/sources', raw });
}

export async function getIncomeSource<R extends boolean | undefined = false>({
  sourceId,
  raw,
}: {
  sourceId: string;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _getIncomeSource>>, R>({
    method: 'get',
    url: `/income/sources/${sourceId}`,
    raw,
  });
}

export async function updateIncomeSource<R extends boolean | undefined = false>({
  sourceId,
  payload,
  raw,
}: {
  sourceId: string;
  payload: Record<string, unknown>;
  raw?: R;
}) {
  return makeRequest<Awaited<ReturnType<typeof _updateIncomeSource>>, R>({
    method: 'put',
    url: `/income/sources/${sourceId}`,
    payload,
    raw,
  });
}

export async function deleteIncomeSource<R extends boolean | undefined = false>({
  sourceId,
  raw,
}: {
  sourceId: string;
  raw?: R;
}) {
  return makeRequest<unknown, R>({ method: 'delete', url: `/income/sources/${sourceId}`, raw });
}

export async function getIncomeSourceSummary<R extends boolean | undefined = false>({
  sourceId = 'all',
  raw,
}: { sourceId?: string; raw?: R } = {}) {
  return makeRequest<Awaited<ReturnType<typeof _getIncomeSourceSummary>>, R>({
    method: 'get',
    url: sourceId === 'all' ? '/income/sources/summary' : `/income/sources/${sourceId}/summary`,
    raw,
  });
}

export async function getIncomeTimeseries<R extends boolean | undefined = false>({
  sourceId = 'all',
  query,
  raw,
}: { sourceId?: string; query?: Record<string, string>; raw?: R } = {}) {
  return makeRequest<Awaited<ReturnType<typeof _getIncomeTimeseries>>, R>({
    method: 'get',
    url: sourceId === 'all' ? '/income/sources/timeseries' : `/income/sources/${sourceId}/timeseries`,
    payload: query ?? null,
    raw,
  });
}
