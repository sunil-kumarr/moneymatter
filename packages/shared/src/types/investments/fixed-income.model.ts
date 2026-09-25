import { AccountModel, CurrencyModel, PayeeModel, TransactionModel, UserModel } from '../db-models';
import { PortfolioModel } from './portfolio-models';

export enum FIXED_INCOME_INSTRUMENT_TYPE {
  fixed_deposit = 'fixed_deposit',
  bond = 'bond',
  peer_loan = 'peer_loan',
}

export enum FIXED_INCOME_POSITION_STATUS {
  active = 'active',
  matured = 'matured',
  partially_repaid = 'partially_repaid',
  fully_repaid = 'fully_repaid',
  written_off = 'written_off',
}

export enum FIXED_INCOME_EVENT_TYPE {
  initial_investment = 'initial_investment',
  interest_accrual_payout = 'interest_accrual_payout',
  partial_repayment = 'partial_repayment',
  full_repayment = 'full_repayment',
  maturity = 'maturity',
  writedown = 'writedown',
  fee = 'fee',
}

export enum INTEREST_COMPOUNDING_FREQUENCY {
  simple = 'simple',
  annually = 'annually',
  semi_annually = 'semi_annually',
  quarterly = 'quarterly',
  monthly = 'monthly',
}

export enum DAY_COUNT_CONVENTION {
  actual_365 = 'actual_365',
  actual_360 = 'actual_360',
  thirty_360 = 'thirty_360',
}

/**
 * How often accrued interest is actually paid out. Distinct from
 * `INTEREST_COMPOUNDING_FREQUENCY`, which governs how interest grows internally —
 * a deposit can compound quarterly but only pay out (or credit) half-yearly.
 * 'cumulative' means interest is reinvested and paid together with the principal at maturity.
 */
export enum INTEREST_PAYOUT_FREQUENCY {
  cumulative = 'cumulative',
  monthly = 'monthly',
  quarterly = 'quarterly',
  semi_annually = 'semi_annually',
  annually = 'annually',
}

export enum FIXED_DEPOSIT_MATURITY_INSTRUCTION {
  credit_to_account = 'credit_to_account',
  auto_renew_principal = 'auto_renew_principal',
  auto_renew_principal_and_interest = 'auto_renew_principal_and_interest',
}

export enum BOND_TYPE {
  corporate = 'corporate',
  government = 'government',
}

export enum CREDIT_RATING {
  AAA = 'AAA',
  AA_plus = 'AA_plus',
  AA = 'AA',
  AA_minus = 'AA_minus',
  A_plus = 'A_plus',
  A = 'A',
  A_minus = 'A_minus',
  BBB_plus = 'BBB_plus',
  BBB = 'BBB',
  BBB_minus = 'BBB_minus',
  BB_and_below = 'BB_and_below',
}

/**
 * Shared with the Venture domain's cash-flow model (linked to a wallet
 * transaction, tracked without a linked transaction, or not tracked at all).
 */
export enum FIXED_INCOME_CASH_FLOW_MODE {
  linked = 'linked',
  out_of_wallet = 'out_of_wallet',
  none = 'none',
}

export interface FixedIncomePositionModel {
  id: string;
  userId: number;
  portfolioId: string;
  instrumentType: FIXED_INCOME_INSTRUMENT_TYPE;
  name: string;
  currencyCode: string;
  status: FIXED_INCOME_POSITION_STATUS;
  principal: string;
  interestRatePct: string;
  compoundingFrequency: INTEREST_COMPOUNDING_FREQUENCY | null;
  dayCountConvention: DAY_COUNT_CONVENTION;
  startDate: string;
  expectedEndDate: string | null;
  counterpartyName: string | null;
  counterpartyPayeeId: string | null;
  variantName: string | null;
  interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY;
  maturityInstruction: FIXED_DEPOSIT_MATURITY_INSTRUCTION;
  payoutAccountId: string | null;
  bondType: BOND_TYPE | null;
  creditRating: CREDIT_RATING | null;
  ytmPct: string | null;
  notes: string | null;
  metaData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  user?: UserModel;
  portfolio?: PortfolioModel;
  currency?: CurrencyModel;
  counterpartyPayee?: PayeeModel;
  payoutAccount?: AccountModel;
  events?: FixedIncomeEventModel[];
}

export interface FixedIncomeEventModel {
  id: string;
  userId: number;
  positionId: string;
  type: FIXED_INCOME_EVENT_TYPE;
  eventDate: string;
  grossAmount: string | null;
  principalComponent: string | null;
  interestComponent: string | null;
  principalReturnedThisEvent: string | null;
  taxWithheld: string | null;
  currencyCode: string;
  cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE;
  resetsAccrualClock: boolean;
  notes: string | null;
  metaData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;

  position?: FixedIncomePositionModel;
  currency?: CurrencyModel;
  links?: FixedIncomeEventLinkModel[];
}

export interface FixedIncomeEventLinkModel {
  id: string;
  fixedIncomeEventId: string;
  transactionId: string;
  amount: string;
  currencyCode: string;
  linkedAt: Date;
  metaData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;

  event?: FixedIncomeEventModel;
  transaction?: TransactionModel;
  currency?: CurrencyModel;
}

export interface FixedIncomePositionMetricsModel {
  costBasis: string;
  principalOutstanding: string;
  accruedUnpaidInterest: string;
  currentValue: string;
  totalInterestReceived: string;
  totalRepaid: string;
  pnlAbsolute: string;
  pnlPct: string | null;
  // Split of pnlAbsolute: realizedGain is interest that actually reached cash the user
  // controls (cashFlowMode: linked or out_of_wallet); unrealizedGain is everything else
  // (still accruing, or rolled into a new term via cashFlowMode: none).
  realizedGain: string;
  unrealizedGain: string;
  realizedGainPct: string | null;
  unrealizedGainPct: string | null;
  // Next projected interest payout date, or null when the payout frequency is
  // cumulative (interest reinvested, nothing paid until maturity) or the position is closed.
  nextPayoutDate: string | null;
}
