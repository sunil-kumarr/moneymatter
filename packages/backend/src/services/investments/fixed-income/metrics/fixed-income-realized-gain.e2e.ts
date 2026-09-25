import {
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_EVENT_TYPE,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { beforeEach, describe, expect, it } from '@jest/globals';
import Portfolios from '@models/investments/portfolios.model';
import * as helpers from '@tests/helpers';

describe('Fixed income realized gain', () => {
  let portfolio: Portfolios;

  beforeEach(async () => {
    portfolio = await helpers.createPortfolio({
      payload: helpers.buildPortfolioPayload({ name: 'Fixed Income Realized Gain Portfolio' }),
      raw: true,
    });
  });

  it('counts interest paid out at maturity (credit_to_account) as realized, not unrealized', async () => {
    const position = await helpers.createFixedIncomePosition({
      payload: helpers.buildFixedIncomePositionPayload({
        portfolioId: portfolio.id,
        name: 'Cumulative FD, maturity payout',
        principal: '10000',
        interestRatePct: '10',
        startDate: '2023-01-01',
        interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY.cumulative,
        maturityInstruction: FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account,
      }),
      raw: true,
    });

    // Single maturity event: principal + interest credited to the bank account together,
    // the way a cumulative FD is naturally recorded (no separate interest_accrual_payout).
    await helpers.createFixedIncomeEvent({
      positionId: position.id,
      payload: {
        type: FIXED_INCOME_EVENT_TYPE.maturity,
        eventDate: '2024-01-01',
        grossAmount: '11000',
        principalComponent: '10000',
        interestComponent: '1000',
        cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE.linked,
      },
    });

    const metrics = await helpers.getFixedIncomePositionMetrics({ positionId: position.id, raw: true });

    // Bug being fixed: previously the interest paid out at maturity was never moved into
    // totalInterestReceived, so it vanished from pnlAbsolute once the position closed.
    expect(parseFloat(metrics.totalInterestReceived)).toBeCloseTo(1000, 0);
    expect(parseFloat(metrics.pnlAbsolute)).toBeCloseTo(1000, 0);
    // It reached a linked bank transaction, so it's realized, not unrealized.
    expect(parseFloat(metrics.realizedGain)).toBeCloseTo(1000, 0);
    expect(parseFloat(metrics.unrealizedGain)).toBeCloseTo(0, 0);

    const summary = await helpers.getPortfolioSummary({ portfolioId: portfolio.id, raw: true });

    expect(parseFloat(summary.realizedGainValue)).toBeCloseTo(1000, 0);
    expect(parseFloat(summary.unrealizedGainValue)).toBeCloseTo(0, 0);
  }, 30000);

  it('keeps interest rolled into an auto-renewed term unrealized (no cash left the position)', async () => {
    const position = await helpers.createFixedIncomePosition({
      payload: helpers.buildFixedIncomePositionPayload({
        portfolioId: portfolio.id,
        name: 'Auto-renewing FD',
        principal: '10000',
        interestRatePct: '10',
        startDate: '2023-01-01',
        interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY.cumulative,
        maturityInstruction: FIXED_DEPOSIT_MATURITY_INSTRUCTION.auto_renew_principal_and_interest,
      }),
      raw: true,
    });

    // Maturity event with no linked cash movement: the position rolls into a new term
    // rather than paying out to the bank.
    await helpers.createFixedIncomeEvent({
      positionId: position.id,
      payload: {
        type: FIXED_INCOME_EVENT_TYPE.maturity,
        eventDate: '2024-01-01',
        grossAmount: '11000',
        principalComponent: '10000',
        interestComponent: '1000',
        cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE.none,
      },
    });

    const metrics = await helpers.getFixedIncomePositionMetrics({ positionId: position.id, raw: true });

    expect(parseFloat(metrics.totalInterestReceived)).toBeCloseTo(1000, 0);
    expect(parseFloat(metrics.pnlAbsolute)).toBeCloseTo(1000, 0);
    expect(parseFloat(metrics.realizedGain)).toBeCloseTo(0, 0);
    expect(parseFloat(metrics.unrealizedGain)).toBeCloseTo(1000, 0);
  }, 30000);

  it('counts periodic (non-cumulative) interest payouts to the bank as realized as they occur', async () => {
    const position = await helpers.createFixedIncomePosition({
      payload: helpers.buildFixedIncomePositionPayload({
        portfolioId: portfolio.id,
        name: 'Monthly payout FD',
        principal: '10000',
        interestRatePct: '12',
        startDate: '2024-01-01',
        interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY.monthly,
        maturityInstruction: FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account,
      }),
      raw: true,
    });

    await helpers.createFixedIncomeEvent({
      positionId: position.id,
      payload: {
        type: FIXED_INCOME_EVENT_TYPE.interest_accrual_payout,
        eventDate: '2024-02-01',
        grossAmount: '100',
        interestComponent: '100',
        cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE.linked,
      },
    });

    const metrics = await helpers.getFixedIncomePositionMetrics({ positionId: position.id, raw: true });

    expect(parseFloat(metrics.realizedGain)).toBeCloseTo(100, 0);
    expect(parseFloat(metrics.unrealizedGain)).toBeCloseTo(0, 0);

    const summary = await helpers.getPortfolioSummary({ portfolioId: portfolio.id, raw: true });
    // Bug being fixed: previously this paid-out interest was dropped entirely from the
    // portfolio summary (get-fixed-income-position-values.service.ts never surfaced it).
    expect(parseFloat(summary.realizedGainValue)).toBeCloseTo(100, 0);
  });
});
