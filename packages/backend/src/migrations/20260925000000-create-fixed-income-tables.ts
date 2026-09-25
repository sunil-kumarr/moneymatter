import { DataTypes, QueryInterface, Transaction } from 'sequelize';

/**
 * Fixed Income investment tracking module (Fixed Deposits, Bonds, Peer Loans) — initial schema.
 *
 * Three tables, modeled on the Venture domain's deal/event/event-link shape:
 *   - FixedIncomePositions (paranoid soft-delete) — one deposit/bond/loan, discriminated by instrumentType
 *   - FixedIncomeEvents (hard-delete; cascades on position delete) — dated interest/repayment/writedown ledger
 *   - FixedIncomeEventLinks (hard-delete) — event ↔ Transaction linking for cashFlowMode='linked'
 *
 * Unlike VentureDeals, portfolioId is required (not optional) since these positions
 * always roll into a portfolio's net worth.
 *
 * Enums stored as VARCHAR + CHECK constraints (no Postgres ENUM types) so adding
 * values later is a code-only change.
 */

const INSTRUMENT_TYPES = ['fixed_deposit', 'bond', 'peer_loan'] as const;
const POSITION_STATUSES = ['active', 'matured', 'partially_repaid', 'fully_repaid', 'written_off'] as const;
const EVENT_TYPES = [
  'initial_investment',
  'interest_accrual_payout',
  'partial_repayment',
  'full_repayment',
  'maturity',
  'writedown',
  'fee',
] as const;
const COMPOUNDING_FREQUENCIES = ['simple', 'annually', 'semi_annually', 'quarterly', 'monthly'] as const;
const DAY_COUNT_CONVENTIONS = ['actual_365', 'actual_360', 'thirty_360'] as const;
const CASH_FLOW_MODES = ['linked', 'out_of_wallet', 'none'] as const;

const inClause = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();

    try {
      // FixedIncomePositions
      await queryInterface.createTable(
        'FixedIncomePositions',
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
          portfolioId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'Portfolios', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          instrumentType: {
            type: DataTypes.STRING(32),
            allowNull: false,
          },
          name: {
            type: DataTypes.STRING(255),
            allowNull: false,
          },
          currencyCode: {
            type: DataTypes.STRING(3),
            allowNull: false,
            references: { model: 'Currencies', key: 'code' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          status: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'active',
          },
          principal: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false,
            defaultValue: '0',
          },
          interestRatePct: {
            type: DataTypes.DECIMAL(10, 6),
            allowNull: false,
            defaultValue: '0',
          },
          compoundingFrequency: {
            type: DataTypes.STRING(16),
            allowNull: true,
          },
          dayCountConvention: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: 'actual_365',
          },
          startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
          },
          expectedEndDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
          },
          counterpartyName: {
            type: DataTypes.STRING(255),
            allowNull: true,
          },
          counterpartyPayeeId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'Payees', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
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
          deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
          },
        },
        { transaction: t },
      );

      await queryInterface.addIndex('FixedIncomePositions', ['userId'], {
        name: 'fixed_income_positions_user_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['portfolioId'], {
        name: 'fixed_income_positions_portfolio_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['currencyCode'], {
        name: 'fixed_income_positions_currency_code_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['status'], {
        name: 'fixed_income_positions_status_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['instrumentType'], {
        name: 'fixed_income_positions_instrument_type_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['counterpartyPayeeId'], {
        name: 'fixed_income_positions_counterparty_payee_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['startDate'], {
        name: 'fixed_income_positions_start_date_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomePositions', ['deletedAt'], {
        name: 'fixed_income_positions_deleted_at_idx',
        transaction: t,
      });

      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_instrument_type"
         CHECK ("instrumentType" IN (${inClause(INSTRUMENT_TYPES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_status"
         CHECK ("status" IN (${inClause(POSITION_STATUSES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_compounding_frequency"
         CHECK ("compoundingFrequency" IS NULL OR "compoundingFrequency" IN (${inClause(COMPOUNDING_FREQUENCIES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_day_count_convention"
         CHECK ("dayCountConvention" IN (${inClause(DAY_COUNT_CONVENTIONS)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_principal_non_negative"
         CHECK ("principal" >= 0);`,
        { transaction: t },
      );
      // Peer loans never compound — UI forces this but enforce it at the DB too.
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_peer_loan_simple_only"
         CHECK (
           "instrumentType" != 'peer_loan'
           OR "compoundingFrequency" IS NULL
           OR "compoundingFrequency" = 'simple'
         );`,
        { transaction: t },
      );

      // FixedIncomeEvents
      await queryInterface.createTable(
        'FixedIncomeEvents',
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
          positionId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'FixedIncomePositions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          type: {
            type: DataTypes.STRING(32),
            allowNull: false,
          },
          eventDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
          },
          grossAmount: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: true,
          },
          principalComponent: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: true,
          },
          interestComponent: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: true,
          },
          principalReturnedThisEvent: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: true,
          },
          currencyCode: {
            type: DataTypes.STRING(3),
            allowNull: false,
            references: { model: 'Currencies', key: 'code' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
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

      await queryInterface.addIndex('FixedIncomeEvents', ['userId'], {
        name: 'fixed_income_events_user_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomeEvents', ['positionId'], {
        name: 'fixed_income_events_position_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomeEvents', ['type'], {
        name: 'fixed_income_events_type_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomeEvents', ['eventDate'], {
        name: 'fixed_income_events_event_date_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomeEvents', ['currencyCode'], {
        name: 'fixed_income_events_currency_code_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomeEvents', ['positionId', 'eventDate'], {
        name: 'fixed_income_events_position_event_date_idx',
        transaction: t,
      });
      // At most one initial_investment per position
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX "fixed_income_events_one_initial_investment_per_position"
         ON "FixedIncomeEvents" ("positionId") WHERE "type" = 'initial_investment';`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomeEvents" ADD CONSTRAINT "chk_fixed_income_events_type"
         CHECK ("type" IN (${inClause(EVENT_TYPES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomeEvents" ADD CONSTRAINT "chk_fixed_income_events_cash_flow_mode"
         CHECK ("cashFlowMode" IN (${inClause(CASH_FLOW_MODES)}));`,
        { transaction: t },
      );
      // writedown → cashFlowMode='none', no gross/principal/interest amounts carrying cash semantics
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomeEvents" ADD CONSTRAINT "chk_fixed_income_events_writedown_no_cash"
         CHECK (
           "type" != 'writedown'
           OR "cashFlowMode" = 'none'
         );`,
        { transaction: t },
      );

      // FixedIncomeEventLinks
      await queryInterface.createTable(
        'FixedIncomeEventLinks',
        {
          id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
          },
          fixedIncomeEventId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'FixedIncomeEvents', key: 'id' },
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
            type: DataTypes.DECIMAL(20, 10),
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

      await queryInterface.addIndex('FixedIncomeEventLinks', ['fixedIncomeEventId'], {
        name: 'fixed_income_event_links_event_id_idx',
        transaction: t,
      });
      await queryInterface.addIndex('FixedIncomeEventLinks', ['transactionId'], {
        name: 'fixed_income_event_links_transaction_id_idx',
        transaction: t,
        unique: true,
      });
      await queryInterface.addIndex('FixedIncomeEventLinks', ['currencyCode'], {
        name: 'fixed_income_event_links_currency_code_idx',
        transaction: t,
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
      await queryInterface.dropTable('FixedIncomeEventLinks', { transaction: t });
      await queryInterface.dropTable('FixedIncomeEvents', { transaction: t });
      await queryInterface.dropTable('FixedIncomePositions', { transaction: t });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
