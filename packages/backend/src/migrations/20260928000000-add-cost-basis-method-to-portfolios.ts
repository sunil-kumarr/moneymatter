import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn('Portfolios', 'costBasisMethod', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'weighted_average',
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn('Portfolios', 'costBasisMethod');
  },
};
