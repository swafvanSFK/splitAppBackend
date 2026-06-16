const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExpenseSplit = sequelize.define('ExpenseSplit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    expense_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount_owed: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    }
  }, {
    freezeTableName: true,
    timestamps: true,
  });

  return ExpenseSplit;
};
