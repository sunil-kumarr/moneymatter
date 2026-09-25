import { DataTypes, QueryInterface, Transaction } from 'sequelize';

/**
 * Bond-specific attributes on FixedIncomePositions, plus a per-event TDS field on
 * FixedIncomeEvents. All nullable — irrelevant for fixed_deposit/peer_loan positions.
 */

const BOND_TYPES = ['corporate', 'government'] as const;
const CREDIT_RATINGS = [
  'AAA',
  'AA_plus',
  'AA',
  'AA_minus',
  'A_plus',
  'A',
  'A_minus',
  'BBB_plus',
  'BBB',
  'BBB_minus',
  'BB_and_below',
] as const;

const inClause = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        'FixedIncomePositions',
        'bondType',
        { type: DataTypes.STRING(16), allowNull: true },
        { transaction: t },
      );
      await queryInterface.addColumn(
        'FixedIncomePositions',
        'creditRating',
        { type: DataTypes.STRING(16), allowNull: true },
        { transaction: t },
      );
      await queryInterface.addColumn(
        'FixedIncomePositions',
        'ytmPct',
        { type: DataTypes.DECIMAL(10, 6), allowNull: true },
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_bond_type"
         CHECK ("bondType" IS NULL OR "bondType" IN (${inClause(BOND_TYPES)}));`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" ADD CONSTRAINT "chk_fixed_income_positions_credit_rating"
         CHECK ("creditRating" IS NULL OR "creditRating" IN (${inClause(CREDIT_RATINGS)}));`,
        { transaction: t },
      );

      // Tax deducted at source on this event's interest, if any (e.g. TDS on a bond coupon).
      await queryInterface.addColumn(
        'FixedIncomeEvents',
        'taxWithheld',
        { type: DataTypes.DECIMAL(20, 10), allowNull: true },
        { transaction: t },
      );

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn('FixedIncomeEvents', 'taxWithheld', { transaction: t });

      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" DROP CONSTRAINT "chk_fixed_income_positions_credit_rating";`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "FixedIncomePositions" DROP CONSTRAINT "chk_fixed_income_positions_bond_type";`,
        { transaction: t },
      );
      await queryInterface.removeColumn('FixedIncomePositions', 'ytmPct', { transaction: t });
      await queryInterface.removeColumn('FixedIncomePositions', 'creditRating', { transaction: t });
      await queryInterface.removeColumn('FixedIncomePositions', 'bondType', { transaction: t });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
