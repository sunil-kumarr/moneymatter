import { INCOME_SOURCE_STATUS, INCOME_SOURCE_TYPE, PAY_CADENCE, type IncomeSourceModel } from '@bt/shared/types/income';
import { describe, expect, it } from 'vitest';

import { partitionIncomeSources } from './income-source-partition';

const buildSource = (overrides: Partial<IncomeSourceModel>): IncomeSourceModel => ({
  id: '1',
  userId: 1,
  name: 'Job',
  employerName: null,
  employerPayeeId: null,
  jobTitle: null,
  sourceType: INCOME_SOURCE_TYPE.salaried,
  status: INCOME_SOURCE_STATUS.active,
  startDate: '2024-01-01',
  endDate: null,
  currencyCode: 'USD',
  payCadence: PAY_CADENCE.monthly,
  expectedAnnualCtc: null,
  payoutAccountId: null,
  taxRegime: null,
  employerIdentifier: null,
  notes: null,
  color: null,
  componentTemplate: null,
  isEnabled: true,
  metaData: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('partitionIncomeSources', () => {
  it('splits sources into active and ended buckets by status', () => {
    const active = buildSource({ id: '1', status: INCOME_SOURCE_STATUS.active });
    const ended = buildSource({ id: '2', status: INCOME_SOURCE_STATUS.ended });

    const result = partitionIncomeSources({ sources: [active, ended] });

    expect(result.active).toEqual([active]);
    expect(result.ended).toEqual([ended]);
  });

  it('returns empty buckets for an empty list', () => {
    expect(partitionIncomeSources({ sources: [] })).toEqual({ active: [], ended: [] });
  });

  it('sorts sources in descending order of the last credit date', () => {
    const recentCreditJob = buildSource({
      id: 'recent',
      name: 'Recent Job',
      status: INCOME_SOURCE_STATUS.active,
      startDate: '2020-01-01',
      latestCreditDate: '2026-09-25',
    });
    const olderCreditJob = buildSource({
      id: 'older',
      name: 'Older Credit Job',
      status: INCOME_SOURCE_STATUS.active,
      startDate: '2022-01-01',
      latestCreditDate: '2026-08-15',
    });
    const noCreditJob = buildSource({
      id: 'no-credit',
      name: 'No Credit Job',
      status: INCOME_SOURCE_STATUS.active,
      startDate: '2025-01-01',
      latestCreditDate: null,
    });

    const result = partitionIncomeSources({
      sources: [olderCreditJob, noCreditJob, recentCreditJob],
    });

    expect(result.active.map((s) => s.id)).toEqual(['recent', 'older', 'no-credit']);
  });

  it('falls back to startDate descending when latestCreditDate is absent or equal', () => {
    const newerJobNoCredit = buildSource({
      id: 'newer-no-credit',
      status: INCOME_SOURCE_STATUS.active,
      startDate: '2025-06-01',
      latestCreditDate: null,
    });
    const olderJobNoCredit = buildSource({
      id: 'older-no-credit',
      status: INCOME_SOURCE_STATUS.active,
      startDate: '2024-01-01',
      latestCreditDate: null,
    });

    const result = partitionIncomeSources({
      sources: [olderJobNoCredit, newerJobNoCredit],
    });

    expect(result.active.map((s) => s.id)).toEqual(['newer-no-credit', 'older-no-credit']);
  });
});
