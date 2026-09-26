import { describe, expect, it } from '@jest/globals';
import * as helpers from '@tests/helpers';

describe('Portfolio Value History (GET /investments/portfolios/value-history)', () => {
  it('returns an empty list when the user has no portfolios', async () => {
    const history = await helpers.getPortfoliosValueHistory({
      from: '2025-01-01',
      to: '2025-01-31',
      raw: true,
    });

    expect(history).toEqual([]);
  });

  it('tracks cumulative net-invested cash and current value across deposits', async () => {
    const portfolio = await helpers.createPortfolio({
      payload: helpers.buildPortfolioPayload({ name: 'Value History Portfolio' }),
      raw: true,
    });
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({ name: 'Value History Cash Source' }),
      raw: true,
    });

    await helpers.accountToPortfolioTransfer({
      portfolioId: portfolio.id,
      payload: { accountId: account.id, amount: '5000', date: '2025-06-01' },
      raw: true,
    });
    await helpers.accountToPortfolioTransfer({
      portfolioId: portfolio.id,
      payload: { accountId: account.id, amount: '3000', date: '2025-07-01' },
      raw: true,
    });

    const history = await helpers.getPortfoliosValueHistory({
      from: '2025-05-01',
      to: '2025-08-01',
      raw: true,
    });

    const byDate = new Map(history.map((item) => [item.date, item]));

    // Before any deposit: nothing invested, nothing to value.
    expect(byDate.get('2025-05-15')?.investedValue).toBe(0);
    expect(byDate.get('2025-05-15')?.currentValue).toBe(0);

    // After the first deposit and before the second: no holdings were bought,
    // so the portfolio's current value (cash only) equals what was invested.
    const afterFirstDeposit = byDate.get('2025-06-15')!;
    expect(afterFirstDeposit.investedValue).toBeCloseTo(5000, 1);
    expect(afterFirstDeposit.currentValue).toBeCloseTo(5000, 1);

    // After the second deposit: both figures step up by the same amount.
    const afterSecondDeposit = byDate.get('2025-07-15')!;
    expect(afterSecondDeposit.investedValue).toBeCloseTo(8000, 1);
    expect(afterSecondDeposit.currentValue).toBeCloseTo(8000, 1);
  }, 30000);

  it('includes fixed-income position value and cost basis alongside cash/holdings', async () => {
    const portfolio = await helpers.createPortfolio({
      payload: helpers.buildPortfolioPayload({ name: 'FD Value History Portfolio' }),
      raw: true,
    });

    await helpers.createFixedIncomePosition({
      payload: helpers.buildFixedIncomePositionPayload({
        portfolioId: portfolio.id,
        principal: '10000',
        interestRatePct: '0',
        startDate: '2025-06-01',
      }),
      raw: true,
    });

    const history = await helpers.getPortfoliosValueHistory({
      from: '2025-05-01',
      to: '2025-08-01',
      raw: true,
    });

    const byDate = new Map(history.map((item) => [item.date, item]));

    // Before the position starts: no value, nothing invested.
    expect(byDate.get('2025-05-15')?.investedValue).toBe(0);
    expect(byDate.get('2025-05-15')?.currentValue).toBe(0);

    // On/after the start date: cost basis and current value both reflect the
    // principal (0% interest keeps currentValue flat instead of drifting).
    const afterStart = byDate.get('2025-07-01')!;
    expect(afterStart.investedValue).toBeCloseTo(10000, 1);
    expect(afterStart.currentValue).toBeCloseTo(10000, 1);
  }, 30000);

  it('rejects a `from` date after `to`', async () => {
    const response = await helpers.getPortfoliosValueHistory({
      from: '2025-08-01',
      to: '2025-01-01',
    });

    expect(response.statusCode).toBe(400);
  });
});
