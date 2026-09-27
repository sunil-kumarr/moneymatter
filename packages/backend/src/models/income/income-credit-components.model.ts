import { RecordId } from '@bt/shared/types';
import { INCOME_COMPONENT_KIND } from '@bt/shared/types/income';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import { BelongsTo, Column, DataType, ForeignKey, Index, Model, Table } from 'sequelize-typescript';

import Users from '../users.model';
import IncomeCredits from './income-credits.model';

@Table({
  timestamps: true,
  tableName: 'IncomeCreditComponents',
})
export default class IncomeCreditComponents extends Model {
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

  @Column({ type: DataType.STRING(255), allowNull: false })
  name!: string;

  @Index
  @Column({ type: DataType.STRING(32), allowNull: false })
  kind!: INCOME_COMPONENT_KIND;

  /** Always a non-negative magnitude, source currency. */
  @MoneyField({ storage: 'cents' })
  declare amount: Money;

  @MoneyField({ storage: 'cents' })
  declare refAmount: Money;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  sortOrder!: number;

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
}
