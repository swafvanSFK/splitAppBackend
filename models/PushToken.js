const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PushToken = sequelize.define('PushToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    }
  }, {
    freezeTableName: true,
    timestamps: true,
  });

  return PushToken;
};
