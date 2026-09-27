import { DataTypes, QueryInterface, Transaction } from 'sequelize';

/**
 * Income Sources module (Jobs / Income Sources) — initial schema.
 *
 * Four tables, modeled on the Fixed Income domain's position/event/event-link shape:
 *   - IncomeSources (paranoid soft-delete) — one job/income stream (employer, pay cadence,
 *     currency, optional per-source payslip component template)
 *   - IncomeCredits (hard-delete; cascades on source delete) — dated payslip/credit ledger
 *   - IncomeCreditComponents (hard-delete; cascades on credit delete) — earnings/deductions/
 *     employer-contribution breakdown for a single credit
 *   - IncomeCreditLinks (hard-delete) — credit ↔ Transaction linking, mirrors
 *     FixedIncomeEventLinks; linking never re-stamps the transaction's transferNature, since
 *     salary must keep counting as income in cash-flow/net-worth stats.
 *
 * Money columns are BIGINT cents (payslips have no fractional-unit needs, unlike investment
 * quantities). Enums stored as VARCHAR + CHECK constraints (no Postgres ENUM types) so adding
 * values later is a code-only change.
 */

const SOURCE_TYPES = ['salaried', 'freelance', 'contract', 'rental', 'business', 'other'] as const;
const SOURCE_STATUSES = ['active', 'ended'] as const;
const PAY_CADENCES = ['monthly', 'semi_monthly', 'biweekly', 'weekly', 'quarterly', 'annual', 'irregular'] as const;
const CREDIT_TYPES = [
  'regular_salary',
  'bonus',
  'arrears',
  'reimbursement',
  'variable_pay',
  'final_settlement',
  'other',
] as const;
const COMPONENT_KINDS = ['earning', 'deduction', 'employer_contribution'] as const;
const CASH_FLOW_MODES = ['linked', 'out_of_wallet', 'none'] as const;

const inClause = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();

    try {
      // IncomeSources
      await queryInterface.createTable(
        'IncomeSources',
        {
          id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          name: {
            type: DataTypes.STRING(255),
            allowNull: false,
          },
          employerName: {
            type: DataTypes.STRING(255),
            allowNull: true,
          },
          employerPayeeId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'Payees', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          jobTitle: {
            type: DataTypes.STRING(255),
            allowNull: true,
          },
          sourceType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'salaried',
          },
          status: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: 'active',
          },
          startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
          },
          endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Null means the job is still current',
          },
          currencyCode: {
            type: DataTypes.STRING(3),
            allowNull: false,
            references: { model: 'Currencies', key: 'code' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          payCadence: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: 'monthly',
          },
          expectedAnnualCtc: {
            type: DataTypes.BIGINT,
            allowNull: true,
            comment: 'Expected annual CTC in cents, source currency',
          },
          payoutAccountId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'Accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          taxRegime: {
            type: DataTypes.STRING(64),
            allowNull: true,
          },
          employerIdentifier: {
            type: DataTypes.STRING(128),
            allowNull: true,
          },
          notes: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          color: {
            type: DataTypes.STRING(32),
            allowNull: true,
          },
          componentTemplate: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
            comment: 'Array of { name, kind, defaultAmount, sortOrder } used to pre-fill new credits',
          },
          isEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          metaData: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
          },
        },
        { transaction: t },
      );

      await queryInterface.addIndex('IncomeSources', ['userId'], {
        name: 'income_sources_user_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeSources', ['currencyCode'], {
        name: 'income_sources_currency_code_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeSources', ['status'], {
        name: 'income_sources_status_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeSources', ['employerPayeeId'], {
        name: 'income_sources_employer_payee_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeSources', ['payoutAccountId'], {
        name: 'income_sources_payout_account_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeSources', ['deletedAt'], {
        name: 'income_sources_deleted_at_idx',
        transaction: t,
      });

      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeSources" ADD CONSTRAINT "chk_income_sources_source_type"
         CHECK ("sourceType" IN (${inClause(SOURCE_TYPES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeSources" ADD CONSTRAINT "chk_income_sources_status"
         CHECK ("status" IN (${inClause(SOURCE_STATUSES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeSources" ADD CONSTRAINT "chk_income_sources_pay_cadence"
         CHECK ("payCadence" IN (${inClause(PAY_CADENCES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeSources" ADD CONSTRAINT "chk_income_sources_expected_ctc_non_negative"
         CHECK ("expectedAnnualCtc" IS NULL OR "expectedAnnualCtc" >= 0);`,
        { transaction: t },
      );

      // IncomeCredits
      await queryInterface.createTable(
        'IncomeCredits',
        {
          id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          incomeSourceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'IncomeSources', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          creditType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'regular_salary',
          },
          creditDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
          },
          periodStart: {
            type: DataTypes.DATEONLY,
            allowNull: true,
          },
          periodEnd: {
            type: DataTypes.DATEONLY,
            allowNull: true,
          },
          currencyCode: {
            type: DataTypes.STRING(3),
            allowNull: false,
            references: { model: 'Currencies', key: 'code' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          grossAmount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: 'Sum of earning components, in cents',
          },
          totalDeductions: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: 'Sum of deduction components, in cents',
          },
          netAmount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: 'grossAmount - totalDeductions, in cents',
          },
          employerContributions: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            comment: 'Sum of employer_contribution components, in cents (informational; not part of net)',
          },
          refCurrencyCode: {
            type: DataTypes.STRING(3),
            allowNull: false,
            references: { model: 'Currencies', key: 'code' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          refGrossAmount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
          },
          refTotalDeductions: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
          },
          refNetAmount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
          },
          cashFlowMode: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'none',
          },
          notes: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          metaData: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction: t },
      );

      await queryInterface.addIndex('IncomeCredits', ['userId'], {
        name: 'income_credits_user_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCredits', ['incomeSourceId'], {
        name: 'income_credits_income_source_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCredits', ['creditDate'], {
        name: 'income_credits_credit_date_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCredits', ['incomeSourceId', 'creditDate'], {
        name: 'income_credits_source_credit_date_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCredits', ['userId', 'creditDate'], {
        name: 'income_credits_user_credit_date_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCredits', ['creditType'], {
        name: 'income_credits_credit_type_idx',
        transaction: t,
      });

      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeCredits" ADD CONSTRAINT "chk_income_credits_credit_type"
         CHECK ("creditType" IN (${inClause(CREDIT_TYPES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeCredits" ADD CONSTRAINT "chk_income_credits_cash_flow_mode"
         CHECK ("cashFlowMode" IN (${inClause(CASH_FLOW_MODES)}));`,
        { transaction: t },
      );

      // IncomeCreditComponents
      await queryInterface.createTable(
        'IncomeCreditComponents',
        {
          id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          incomeCreditId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'IncomeCredits', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          name: {
            type: DataTypes.STRING(255),
            allowNull: false,
          },
          kind: {
            type: DataTypes.STRING(32),
            allowNull: false,
          },
          amount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            comment: 'In cents, source currency; always a non-negative magnitude',
          },
          refAmount: {
            type: DataTypes.BIGINT,
            allowNull: false,
          },
          sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          metaData: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction: t },
      );

      await queryInterface.addIndex('IncomeCreditComponents', ['incomeCreditId'], {
        name: 'income_credit_components_income_credit_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCreditComponents', ['kind'], {
        name: 'income_credit_components_kind_idx',
        transaction: t,
      });

      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeCreditComponents" ADD CONSTRAINT "chk_income_credit_components_kind"
         CHECK ("kind" IN (${inClause(COMPONENT_KINDS)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "IncomeCreditComponents" ADD CONSTRAINT "chk_income_credit_components_amount_non_negative"
         CHECK ("amount" >= 0);`,
        { transaction: t },
      );

      // IncomeCreditLinks
      await queryInterface.createTable(
        'IncomeCreditLinks',
        {
          id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          incomeCreditId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'IncomeCredits', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          transactionId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: { model: 'Transactions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          amount: {
            type: DataTypes.BIGINT,
            allowNull: false,
          },
          currencyCode: {
            type: DataTypes.STRING(3),
            allowNull: false,
            references: { model: 'Currencies', key: 'code' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          linkedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          metaData: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction: t },
      );

      await queryInterface.addIndex('IncomeCreditLinks', ['incomeCreditId'], {
        name: 'income_credit_links_income_credit_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('IncomeCreditLinks', ['transactionId'], {
        name: 'income_credit_links_transaction_id_idx',
        transaction: t,
        unique: true,
      });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.dropTable('IncomeCreditLinks', { transaction: t });
      await queryInterface.dropTable('IncomeCreditComponents', { transaction: t });
      await queryInterface.dropTable('IncomeCredits', { transaction: t });
      await queryInterface.dropTable('IncomeSources', { transaction: t });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
