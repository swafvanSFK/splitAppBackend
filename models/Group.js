const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Group = sequelize.define('Group', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    invite_code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    admin_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    }
  }, {
    freezeTableName: true,
    timestamps: true,
  });

  return Group;
};
