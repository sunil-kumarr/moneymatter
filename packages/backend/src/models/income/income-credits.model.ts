import { RecordId } from '@bt/shared/types';
import { INCOME_CASH_FLOW_MODE, INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Index, Model, Table } from 'sequelize-typescript';

import Currencies from '../currencies.model';
import Users from '../users.model';
import IncomeCreditComponents from './income-credit-components.model';
import IncomeCreditLinks from './income-credit-links.model';
import IncomeSources from './income-sources.model';

@Table({
  timestamps: true,
  tableName: 'IncomeCredits',
})
export default class IncomeCredits extends Model {
  @Column(IdColumn())
  declare id: RecordId;

  @ForeignKey(() => Users)
  @Index
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @ForeignKey(() => IncomeSources)
  @Index
  @Column({ type: DataType.UUID, allowNull: false })
  incomeSourceId!: RecordId;

  @Index
  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: INCOME_CREDIT_TYPE.regular_salary,
  })
  creditType!: INCOME_CREDIT_TYPE;

  @Index
  @Column({ type: DataType.DATEONLY, allowNull: false })
  creditDate!: string;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  periodStart!: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  periodEnd!: string | null;

  @ForeignKey(() => Currencies)
  @Index
  @Column({ type: DataType.STRING(3), allowNull: false })
  currencyCode!: string;

  /** Sum of `earning` components; materialised for querying, components are the source of truth. */
  @MoneyField({ storage: 'cents' })
  declare grossAmount: Money;

  /** Sum of `deduction` components. */
  @MoneyField({ storage: 'cents' })
  declare totalDeductions: Money;

  /** grossAmount - totalDeductions. */
  @MoneyField({ storage: 'cents' })
  declare netAmount: Money;

  /** Sum of `employer_contribution` components; informational, not part of net. */
  @MoneyField({ storage: 'cents' })
  declare employerContributions: Money;

  @ForeignKey(() => Currencies)
  @Index
  @Column({ type: DataType.STRING(3), allowNull: false })
  refCurrencyCode!: string;

  @MoneyField({ storage: 'cents' })
  declare refGrossAmount: Money;

  @MoneyField({ storage: 'cents' })
  declare refTotalDeductions: Money;

  @MoneyField({ storage: 'cents' })
  declare refNetAmount: Money;

  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: INCOME_CASH_FLOW_MODE.none,
  })
  cashFlowMode!: INCOME_CASH_FLOW_MODE;

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

  @BelongsTo(() => IncomeSources)
  source?: IncomeSources;

  @BelongsTo(() => Currencies, 'currencyCode')
  currency?: Currencies;

  @HasMany(() => IncomeCreditComponents)
  components?: IncomeCreditComponents[];

  @HasMany(() => IncomeCreditLinks)
  links?: IncomeCreditLinks[];
}
