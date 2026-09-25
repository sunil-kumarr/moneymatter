import { RecordId } from '@bt/shared/types';
import { FIXED_INCOME_CASH_FLOW_MODE, FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Index, Model, Table } from 'sequelize-typescript';

import Currencies from '../currencies.model';
import Users from '../users.model';
import FixedIncomeEventLinks from './fixed-income-event-links.model';
import FixedIncomePositions from './fixed-income-positions.model';

@Table({
  timestamps: true,
  tableName: 'FixedIncomeEvents',
})
export default class FixedIncomeEvents extends Model {
  @Column(IdColumn())
  declare id: RecordId;

  @ForeignKey(() => Users)
  @Index
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @ForeignKey(() => FixedIncomePositions)
  @Index
  @Column({ type: DataType.UUID, allowNull: false })
  positionId!: RecordId;

  @Index
  @Column({ type: DataType.STRING(32), allowNull: false })
  type!: FIXED_INCOME_EVENT_TYPE;

  @Index
  @Column({ type: DataType.DATEONLY, allowNull: false })
  eventDate!: string;

  @MoneyField({ storage: 'decimal', precision: 20, scale: 10, allowNull: true })
  declare grossAmount: Money | null;

  @MoneyField({ storage: 'decimal', precision: 20, scale: 10, allowNull: true })
  declare principalComponent: Money | null;

  @MoneyField({ storage: 'decimal', precision: 20, scale: 10, allowNull: true })
  declare interestComponent: Money | null;

  /**
   * Snapshot of the principal this event returned. Downstream metrics read it
   * via a running sum instead of re-deriving repayments from grossAmount, the
   * same pattern VentureEvents uses for distributions/exits.
   */
  @Column({ type: DataType.DECIMAL(20, 10), allowNull: true })
  principalReturnedThisEvent!: string | null;

  /** Tax deducted at source on this event's interest, if any (e.g. TDS on a bond coupon). */
  @MoneyField({ storage: 'decimal', precision: 20, scale: 10, allowNull: true })
  declare taxWithheld: Money | null;

  @ForeignKey(() => Currencies)
  @Index
  @Column({ type: DataType.STRING(3), allowNull: false })
  currencyCode!: string;

  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: FIXED_INCOME_CASH_FLOW_MODE.none,
  })
  cashFlowMode!: FIXED_INCOME_CASH_FLOW_MODE;

  /**
   * Whether this event flushes accrued-but-unpaid interest and resets the
   * compounding clock at its eventDate. Defaults to true (the historical
   * behavior for every event type). Set to false for a recorded interest
   * credit that didn't verifiably reach cash the user controls — e.g. an
   * internal bank sweep to an unrelated account — so it stays in the ledger
   * for history without cutting off continuous compounding through that date.
   */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  resetsAccrualClock!: boolean;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: null })
  metaData!: Record<string, unknown> | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  declare updatedAt: Date;

  @BelongsTo(() => Users)
  user?: Users;

  @BelongsTo(() => FixedIncomePositions)
  position?: FixedIncomePositions;

  @BelongsTo(() => Currencies, 'currencyCode')
  currency?: Currencies;

  @HasMany(() => FixedIncomeEventLinks)
  links?: FixedIncomeEventLinks[];
}
