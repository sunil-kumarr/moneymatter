import { RecordId } from '@bt/shared/types';
import { IdColumn } from '@common/types/id-column';
import { Table, Column, Model, ForeignKey, DataType, BelongsTo } from 'sequelize-typescript';

import InvestmentTransaction from './investment-transaction.model';

/**
 * Golden-fixture reconciliation record populated once by the Groww PnL
 * backfill script. Not read by the app at runtime — used only to assert our
 * computed realized gain against Groww's own reported number in tests, so
 * drift between our calculation and the broker's is caught immediately.
 */
@Table({
  timestamps: true,
  tableName: 'InvestmentTransactionReconciliations',
})
export default class InvestmentTransactionReconciliation extends Model {
  @Column(IdColumn())
  declare id: RecordId;

  @ForeignKey(() => InvestmentTransaction)
  @Column({ type: DataType.UUID, allowNull: false })
  transactionId!: RecordId;

  @Column({ type: DataType.DECIMAL(20, 10), allowNull: false })
  growwRealisedPnl!: string;

  @Column({ type: DataType.DECIMAL(20, 10), allowNull: true })
  growwRealisedPnlPercent!: string | null;

  @Column({ type: DataType.STRING(50), allowNull: false })
  sourcePeriod!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  sourceFile!: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  declare updatedAt: Date;

  @BelongsTo(() => InvestmentTransaction)
  transaction!: InvestmentTransaction;
}
