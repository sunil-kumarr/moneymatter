import { RecordId } from '@bt/shared/types';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import { BelongsTo, Column, DataType, ForeignKey, Index, Model, Table } from 'sequelize-typescript';

import Currencies from '../currencies.model';
import Transactions from '../transactions.model';
import Users from '../users.model';
import IncomeCredits from './income-credits.model';

@Table({
  timestamps: true,
  tableName: 'IncomeCreditLinks',
})
export default class IncomeCreditLinks extends Model {
  @Column(IdColumn())
  declare id: RecordId;

  @ForeignKey(() => Users)
  @Index
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @ForeignKey(() => IncomeCredits)
  @Index
  @Column({ type: DataType.UUID, allowNull: false })
  incomeCreditId!: RecordId;

  @ForeignKey(() => Transactions)
  @Index
  @Column({ type: DataType.UUID, allowNull: false, unique: true })
  transactionId!: RecordId;

  @MoneyField({ storage: 'cents' })
  declare amount: Money;

  @ForeignKey(() => Currencies)
  @Index
  @Column({ type: DataType.STRING(3), allowNull: false })
  currencyCode!: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  linkedAt!: Date;

  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: null })
  metaData!: Record<string, unknown> | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  declare updatedAt: Date;

  @BelongsTo(() => Users)
  user?: Users;

  @BelongsTo(() => IncomeCredits)
  credit?: IncomeCredits;

  @BelongsTo(() => Transactions)
  transaction?: Transactions;

  @BelongsTo(() => Currencies, 'currencyCode')
  currency?: Currencies;
}
