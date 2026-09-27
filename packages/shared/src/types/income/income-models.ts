import { AccountModel, CurrencyModel, PayeeModel, TransactionModel, UserModel } from '../db-models';
import {
  INCOME_CASH_FLOW_MODE,
  INCOME_COMPONENT_KIND,
  INCOME_CREDIT_TYPE,
  INCOME_SOURCE_STATUS,
  INCOME_SOURCE_TYPE,
  PAY_CADENCE,
} from './enums';

export interface IncomeComponentTemplateItem {
  name: string;
  kind: INCOME_COMPONENT_KIND;
  defaultAmount: string | null;
  sortOrder: number;
}

export interface IncomeSourceModel {
  id: string;
  userId: number;
  name: string;
  employerName: string | null;
  employerPayeeId: string | null;
  jobTitle: string | null;
  sourceType: INCOME_SOURCE_TYPE;
  status: INCOME_SOURCE_STATUS;
  startDate: string;
  endDate: string | null;
  currencyCode: string;
  payCadence: PAY_CADENCE;
  expectedAnnualCtc: string | null;
  payoutAccountId: string | null;
  taxRegime: string | null;
  employerIdentifier: string | null;
  notes: string | null;
  color: string | null;
  componentTemplate: IncomeComponentTemplateItem[] | null;
  isEnabled: boolean;
  metaData: Record<string, unknown> | null;
  latestCreditDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  user?: UserModel;
  currency?: CurrencyModel;
  employerPayee?: PayeeModel;
  payoutAccount?: AccountModel;
  credits?: IncomeCreditModel[];
}

export interface IncomeCreditModel {
  id: string;
  userId: number;
  incomeSourceId: string;
  creditType: INCOME_CREDIT_TYPE;
  creditDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  currencyCode: string;
  grossAmount: string;
  totalDeductions: string;
  netAmount: string;
  employerContributions: string;
  refCurrencyCode: string;
  refGrossAmount: string;
  refTotalDeductions: string;
  refNetAmount: string;
  cashFlowMode: INCOME_CASH_FLOW_MODE;
  notes: string | null;
  metaData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;

  source?: IncomeSourceModel;
  currency?: CurrencyModel;
  components?: IncomeCreditComponentModel[];
  links?: IncomeCreditLinkModel[];
}

export interface IncomeCreditComponentModel {
  id: string;
  userId: number;
  incomeCreditId: string;
  name: string;
  kind: INCOME_COMPONENT_KIND;
  amount: string;
  refAmount: string;
  sortOrder: number;
  metaData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;

  credit?: IncomeCreditModel;
}

export interface IncomeCreditLinkModel {
  id: string;
  userId: number;
  incomeCreditId: string;
  transactionId: string;
  amount: string;
  currencyCode: string;
  linkedAt: Date;
  metaData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;

  credit?: IncomeCreditModel;
  transaction?: TransactionModel;
  currency?: CurrencyModel;
}
