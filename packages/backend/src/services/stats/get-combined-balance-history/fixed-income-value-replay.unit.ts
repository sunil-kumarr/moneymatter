import {
  DAY_COUNT_CONVENTION,
  FIXED_INCOME_EVENT_TYPE,
  FIXED_INCOME_INSTRUMENT_TYPE,
  FIXED_INCOME_POSITION_STATUS,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { Money } from '@common/types/money';
import { describe, expect, it } from '@jest/globals';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';

import { computeFixedIncomeByDate } from './fixed-income-value-replay';

const createMockPosition = ({
  id = 'pos-1',
  principal = '10000',
  interestRatePct = '10',
  startDate = '2025-01-01',
  currencyCode = 'USD',
  events = [],
}: {
  id?: string;
  principal?: string;
  interestRatePct?: string;
  startDate?: string;
  currencyCode?: string;
  events?: Partial<FixedIncomeEvents>[];
}): FixedIncomePositions =>
  ({
    id,
    portfolioId: 'port-1',
    instrumentType: FIXED_INCOME_INSTRUMENT_TYPE.fixed_deposit,
    status: FIXED_INCOME_POSITION_STATUS.active,
    principal: Money.fromDecimal(principal),
    interestRatePct,
    compoundingFrequency: INTEREST_COMPOUNDING_FREQUENCY.simple,
    dayCountConvention: DAY_COUNT_CONVENTION.actual_365,
    interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY.cumulative,
    startDate,
    currencyCode,
    events,
  }) as unknown as FixedIncomePositions;

describe('computeFixedIncomeByDate', () => {
  it('tracks investedValue and currentValue across initial investment, partial early repayment, and full repayment', () => {
    const position = createMockPosition({
      id: 'fd-1',
      principal: '10000',
      interestRatePct: '0', // 0% rate so current value exactly tracks principal
      startDate: '2025-01-01',
      events: [
        {
          id: 'ev-1',
          type: FIXED_INCOME_EVENT_TYPE.initial_investment,
          eventDate: '2025-01-01',
          grossAmount: Money.fromDecimal('10000'),
          principalComponent: Money.fromDecimal('10000'),
          createdAt: new Date('2025-01-01T00:00:00Z'),
        } as unknown as FixedIncomeEvents,
        {
          id: 'ev-2',
          type: FIXED_INCOME_EVENT_TYPE.partial_repayment,
          eventDate: '2025-06-01',
          grossAmount: Money.fromDecimal('4000'),
          principalComponent: Money.fromDecimal('4000'),
          principalReturnedThisEvent: '4000',
          createdAt: new Date('2025-06-01T00:00:00Z'),
        } as unknown as FixedIncomeEvents,
        {
          id: 'ev-3',
          type: FIXED_INCOME_EVENT_TYPE.full_repayment,
          eventDate: '2025-12-01',
          grossAmount: Money.fromDecimal('6000'),
          principalComponent: Money.fromDecimal('6000'),
          principalReturnedThisEvent: '6000',
          createdAt: new Date('2025-12-01T00:00:00Z'),
        } as unknown as FixedIncomeEvents,
      ],
    });

    const uniqueDates = [
      '2024-12-31',
      '2025-01-01',
      '2025-05-31',
      '2025-06-01',
      '2025-11-30',
      '2025-12-01',
      '2025-12-02',
    ];

    const getExchangeRate = () => 1;

    const { currentValueByDate, investedValueByDate } = computeFixedIncomeByDate({
      positions: [position],
      uniqueDates,
      getExchangeRate,
    });

    // Before start: nothing invested, nothing current
    expect(investedValueByDate.get('2024-12-31')).toBe(0);
    expect(currentValueByDate.get('2024-12-31')).toBe(0);

    // Initial investment on 2025-01-01: 10,000 invested, 10,000 current
    expect(investedValueByDate.get('2025-01-01')).toBe(10000);
    expect(currentValueByDate.get('2025-01-01')).toBe(10000);
    expect(investedValueByDate.get('2025-05-31')).toBe(10000);
    expect(currentValueByDate.get('2025-05-31')).toBe(10000);

    // Early partial repayment of 4,000 on 2025-06-01: invested drops to 6,000, current drops to 6,000
    expect(investedValueByDate.get('2025-06-01')).toBe(6000);
    expect(currentValueByDate.get('2025-06-01')).toBe(6000);
    expect(investedValueByDate.get('2025-11-30')).toBe(6000);
    expect(currentValueByDate.get('2025-11-30')).toBe(6000);

    // Full repayment of remaining 6,000 on 2025-12-01: invested drops to 0, current drops to 0
    expect(investedValueByDate.get('2025-12-01')).toBe(0);
    expect(currentValueByDate.get('2025-12-01')).toBe(0);
    expect(investedValueByDate.get('2025-12-02')).toBe(0);
    expect(currentValueByDate.get('2025-12-02')).toBe(0);
  });

  it('accurately computes interest accrual alongside partial repayments', () => {
    const position = createMockPosition({
      id: 'fd-2',
      principal: '10000',
      interestRatePct: '10', // 10% per year simple interest
      startDate: '2025-01-01',
      events: [
        {
          id: 'ev-1',
          type: FIXED_INCOME_EVENT_TYPE.initial_investment,
          eventDate: '2025-01-01',
          grossAmount: Money.fromDecimal('10000'),
          principalComponent: Money.fromDecimal('10000'),
          createdAt: new Date('2025-01-01T00:00:00Z'),
        } as unknown as FixedIncomeEvents,
      ],
    });

    const uniqueDates = ['2025-01-01', '2025-07-02', '2026-01-01'];
    const getExchangeRate = () => 1;

    const { currentValueByDate, investedValueByDate } = computeFixedIncomeByDate({
      positions: [position],
      uniqueDates,
      getExchangeRate,
    });

    expect(investedValueByDate.get('2025-01-01')).toBe(10000);
    expect(currentValueByDate.get('2025-01-01')).toBe(10000);

    // After 1 full year (365 days): 10,000 + 1,000 interest = 11,000
    expect(investedValueByDate.get('2026-01-01')).toBe(10000);
    expect(currentValueByDate.get('2026-01-01')).toBeCloseTo(11000, 0);
  });
});
