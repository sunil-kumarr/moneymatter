import { RecordId } from '@bt/shared/types';
import {
  BOND_TYPE,
  CREDIT_RATING,
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_INSTRUMENT_TYPE,
  FIXED_INCOME_POSITION_STATUS,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Index, Model, Table } from 'sequelize-typescript';

import Accounts from '../accounts.model';
import Currencies from '../currencies.model';
import Payees from '../payees.model';
import Users from '../users.model';
import FixedIncomeEvents from './fixed-income-events.model';
import Portfolios from './portfolios.model';

@Table({
  timestamps: true,
  paranoid: true,
  tableName: 'FixedIncomePositions',
})
export default class FixedIncomePositions extends Model {
  @Column(IdColumn())
  declare id: RecordId;

  @ForeignKey(() => Users)
  @Index
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @ForeignKey(() => Portfolios)
  @Index
  @Column({ type: DataType.UUID, allowNull: false })
  portfolioId!: RecordId;

  @Index
  @Column({ type: DataType.STRING(32), allowNull: false })
  instrumentType!: FIXED_INCOME_INSTRUMENT_TYPE;

  @Column({ type: DataType.STRING(255), allowNull: false })
  name!: string;

  @ForeignKey(() => Currencies)
  @Index
  @Column({ type: DataType.STRING(3), allowNull: false })
  currencyCode!: string;

  @Index
  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: FIXED_INCOME_POSITION_STATUS.active,
  })
  status!: FIXED_INCOME_POSITION_STATUS;

  @MoneyField({ storage: 'decimal', precision: 20, scale: 10 })
  declare principal: Money;

  /**
   * Whole-number annual percent, e.g. "10" for 10% — NOT a [0,1] fraction.
   * `computeAccruedInterest` divides this by 100 internally.
   */
  @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: '0' })
  interestRatePct!: string;

  @Column({ type: DataType.STRING(16), allowNull: true })
  compoundingFrequency!: INTEREST_COMPOUNDING_FREQUENCY | null;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: DAY_COUNT_CONVENTION.actual_365,
  })
  dayCountConvention!: DAY_COUNT_CONVENTION;

  @Index
  @Column({ type: DataType.DATEONLY, allowNull: false })
  startDate!: string;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  expectedEndDate!: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  counterpartyName!: string | null;

  @ForeignKey(() => Payees)
  @Index
  @Column({ type: DataType.UUID, allowNull: true })
  counterpartyPayeeId!: RecordId | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  variantName!: string | null;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: INTEREST_PAYOUT_FREQUENCY.cumulative,
  })
  interestPayoutFrequency!: INTEREST_PAYOUT_FREQUENCY;

  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account,
  })
  maturityInstruction!: FIXED_DEPOSIT_MATURITY_INSTRUCTION;

  @ForeignKey(() => Accounts)
  @Index
  @Column({ type: DataType.UUID, allowNull: true })
  payoutAccountId!: RecordId | null;

  // Bond-only attributes; null for fixed_deposit/peer_loan positions.
  @Column({ type: DataType.STRING(16), allowNull: true })
  bondType!: BOND_TYPE | null;

  @Column({ type: DataType.STRING(16), allowNull: true })
  creditRating!: CREDIT_RATING | null;

  /** Whole-number annual percent, same convention as `interestRatePct`. */
  @Column({ type: DataType.DECIMAL(10, 6), allowNull: true })
  ytmPct!: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: null })
  metaData!: Record<string, unknown> | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  declare updatedAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare deletedAt: Date | null;

  @BelongsTo(() => Users)
  user?: Users;

  @BelongsTo(() => Portfolios)
  portfolio?: Portfolios;

  @BelongsTo(() => Currencies, 'currencyCode')
  currency?: Currencies;

  @BelongsTo(() => Payees)
  counterpartyPayee?: Payees;

  @BelongsTo(() => Accounts)
  payoutAccount?: Accounts;

  @HasMany(() => FixedIncomeEvents)
  events?: FixedIncomeEvents[];
}
