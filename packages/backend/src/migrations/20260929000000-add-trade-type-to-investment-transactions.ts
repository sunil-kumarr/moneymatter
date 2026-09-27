import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn('InvestmentTransactions', 'tradeType', {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('InvestmentTransactions', 'exchangeOrderId', {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await queryInterface.createTable('InvestmentTransactionReconciliations', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      transactionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'InvestmentTransactions', key: 'id' },
        onDelete: 'CASCADE',
      },
      growwRealisedPnl: {
        type: DataTypes.DECIMAL(20, 10),
        allowNull: false,
      },
      growwRealisedPnlPercent: {
        type: DataTypes.DECIMAL(20, 10),
        allowNull: true,
      },
      sourcePeriod: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      sourceFile: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('InvestmentTransactionReconciliations', ['transactionId']);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable('InvestmentTransactionReconciliations');
    await queryInterface.removeColumn('InvestmentTransactions', 'exchangeOrderId');
    await queryInterface.removeColumn('InvestmentTransactions', 'tradeType');
  },
};
