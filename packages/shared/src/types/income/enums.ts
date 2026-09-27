export enum INCOME_SOURCE_TYPE {
  salaried = 'salaried',
  freelance = 'freelance',
  contract = 'contract',
  rental = 'rental',
  business = 'business',
  other = 'other',
}

export enum INCOME_SOURCE_STATUS {
  active = 'active',
  ended = 'ended',
}

export enum PAY_CADENCE {
  monthly = 'monthly',
  semi_monthly = 'semi_monthly',
  biweekly = 'biweekly',
  weekly = 'weekly',
  quarterly = 'quarterly',
  annual = 'annual',
  irregular = 'irregular',
}

export enum INCOME_CREDIT_TYPE {
  regular_salary = 'regular_salary',
  bonus = 'bonus',
  arrears = 'arrears',
  reimbursement = 'reimbursement',
  variable_pay = 'variable_pay',
  final_settlement = 'final_settlement',
  other = 'other',
}

export enum INCOME_COMPONENT_KIND {
  earning = 'earning',
  deduction = 'deduction',
  employer_contribution = 'employer_contribution',
}

/**
 * Shared with the Venture/FixedIncome cash-flow model (linked to a wallet
 * transaction, tracked without a linked transaction, or not tracked at all).
 */
export enum INCOME_CASH_FLOW_MODE {
  linked = 'linked',
  out_of_wallet = 'out_of_wallet',
  none = 'none',
}
