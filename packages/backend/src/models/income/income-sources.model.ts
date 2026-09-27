import { RecordId } from '@bt/shared/types';
import {
  INCOME_SOURCE_STATUS,
  INCOME_SOURCE_TYPE,
  IncomeComponentTemplateItem,
  PAY_CADENCE,
} from '@bt/shared/types/income';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Index, Model, Table } from 'sequelize-typescript';

import Accounts from '../accounts.model';
import Currencies from '../currencies.model';
import Payees from '../payees.model';
import Users from '../users.model';
import IncomeCredits from './income-credits.model';

@Table({
  timestamps: true,
  paranoid: true,
  tableName: 'IncomeSources',
})
export default class IncomeSources extends Model {
  @Column(IdColumn())
  declare id: RecordId;

  @ForeignKey(() => Users)
  @Index
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  employerName!: string | null;

  @ForeignKey(() => Payees)
  @Index
  @Column({ type: DataType.UUID, allowNull: true })
  employerPayeeId!: RecordId | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  jobTitle!: string | null;

  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: INCOME_SOURCE_TYPE.salaried,
  })
  sourceType!: INCOME_SOURCE_TYPE;

  @Index
  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: INCOME_SOURCE_STATUS.active,
  })
  status!: INCOME_SOURCE_STATUS;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  startDate!: string;

  /** Null means the job is still current. */
  @Column({ type: DataType.DATEONLY, allowNull: true })
  endDate!: string | null;

  @ForeignKey(() => Currencies)
  @Index
  @Column({ type: DataType.STRING(3), allowNull: false })
  currencyCode!: string;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: PAY_CADENCE.monthly,
  })
  payCadence!: PAY_CADENCE;

  @MoneyField({ storage: 'cents', allowNull: true })
  declare expectedAnnualCtc: Money | null;

  @ForeignKey(() => Accounts)
  @Index
  @Column({ type: DataType.UUID, allowNull: true })
  payoutAccountId!: RecordId | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  taxRegime!: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  employerIdentifier!: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  color!: string | null;

  /** Pre-fills new credits' component breakdown; read/written whole, never queried into. */
  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: null })
  componentTemplate!: IncomeComponentTemplateItem[] | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  isEnabled!: boolean;

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

  @BelongsTo(() => Currencies, 'currencyCode')
  currency?: Currencies;

  @BelongsTo(() => Payees)
  employerPayee?: Payees;

  @BelongsTo(() => Accounts)
  payoutAccount?: Accounts;

  @HasMany(() => IncomeCredits)
  credits?: IncomeCredits[];

  declare latestCreditDate?: string | null;
}
