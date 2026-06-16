const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    receipt_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    group_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    paid_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    }
  }, {
    freezeTableName: true,
    timestamps: true,
  });

  return Expense;
};
